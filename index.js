/**
 * Host half of the usage/balance bundle.
 *
 * Owns one session projection, `usageTrack`, that folds the complete durable
 * log into per-turn token buckets and timing. The browser half reads the
 * projection through the ordinary session-projection carrier, so it can
 * collect every Session without paging conversation history.
 */
import z from '@deepseek-ai/schemastery'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Keep the complete durable turn history. The previous 500-turn cut made
// "all time" silently lose old turns; 100k is only a pathological safety cap.
const MAX_TURNS = 100_000
const PRICING_PATH = new URL('./pricing.json', import.meta.url)
const PRICING_ROUTE = '/dsh-usage-balance-card/pricing.json'
const REPORT_ROUTE = '/dsh-usage-balance-card/report-window'
const ARCHIVE_ROUTE = '/dsh-usage-balance-card/archive'
const REPORT_MAX_BYTES = 2_000_000
const ARCHIVE_MAX_BYTES = 20_000_000
const ARCHIVE_MAX_TURNS = 100_000
const ARCHIVE_FILE = path.join(
  process.env.DSH_PROFILE_DIR || process.env.DSH_HOME || path.join(process.env.USERPROFILE || '.', '.dsh'),
  'storages',
  'dsh-usage-balance',
  'archive.json',
)
const PRICING_SOURCES = [
  { url: 'https://api.github.com/repos/H-ATK/dsh-usage/contents/pricing.json?ref=main', accept: 'application/vnd.github.raw' },
  { url: 'https://raw.githubusercontent.com/H-ATK/dsh-usage/main/pricing.json', accept: 'application/json' },
  { url: 'https://cdn.jsdelivr.net/gh/H-ATK/dsh-usage@main/pricing.json', accept: 'application/json' },
]
const PRICING_TTL_MS = 6 * 60 * 60 * 1000

const EMPTY_BUCKETS = Object.freeze({
  input: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0,
})

/**
 * The Host Config shown on the bundle's plugin page. Each feature can be
 * switched independently; both default to on.
 */
export const Config = z.object({
  balanceCard: z.boolean().default(true).description({
    zh: '在对话框左侧显示余额、上一轮/本轮消费、当前时段价格和会话统计，并隐藏输入框底部的统计行',
    en: 'Show balance, previous/current-turn spend, current-window price, and session stats left of the composer, and hide the composer statistics row',
  }),
  usageTrajectory: z.boolean().default(true).description({
    zh: '显示“使用量轨迹”页签，并在首次启用或重新启用时收集所有对话窗口',
    en: 'Show the Usage trajectory tab and collect every Session when first enabled or re-enabled',
  }),
  usageOverview: z.boolean().default(true).description({
    zh: '显示“用量总览”页签，按今日、本月和全部汇总用量趋势',
    en: 'Show the Usage overview tab with today, this month, and all-time totals and trends',
  }),
})

/** @param {unknown} value @returns {number} */
function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/** @param {unknown} usage */
function bucketsOf(usage) {
  const value = usage !== null && typeof usage === 'object' ? usage : {}
  return {
    input: count(value.inputTokens),
    cacheRead: count(value.cacheReadTokens),
    cacheWrite: count(value.cacheWriteTokens),
    output: count(value.outputTokens),
    reasoning: count(value.reasoningTokens),
  }
}

/** The last usage chunk embedded in an attempt/settled stream. */
function usageFromStream(stream) {
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const chunk = stream[index]
    if (chunk !== null && typeof chunk === 'object' && chunk.type === 'usage' && chunk.usage !== undefined) {
      return chunk.usage
    }
  }
  return undefined
}

/** @param {any} left @param {any} right */
function sameBuckets(left, right) {
  return left.input === right.input
    && left.cacheRead === right.cacheRead
    && left.cacheWrite === right.cacheWrite
    && left.output === right.output
    && left.reasoning === right.reasoning
}

/** @param {number} turnNumber */
function emptyTurn(turnNumber) {
  return {
    turn: turnNumber,
    startedAt: null,
    endedAt: null,
    status: 'running',
    model: '',
    provider: '',
    ...EMPTY_BUCKETS,
  }
}

/**
 * Replace one turn's record, creating it when the log window starts mid-turn.
 * @param {{turns: readonly any[], last: any}} state
 * @param {number} turnNumber
 * @param {(turn: any) => any} update
 */
function withTurn(state, turnNumber, update) {
  const turns = state.turns.map(turn => ({ ...turn }))
  let index = turns.findIndex(turn => turn.turn === turnNumber)
  if (index === -1) {
    turns.push(emptyTurn(turnNumber))
    index = turns.length - 1
  }
  turns[index] = update(turns[index])
  return {
    ...state,
    turns: turns.length > MAX_TURNS ? turns.slice(-MAX_TURNS) : turns,
  }
}

/** Per-turn fold over the complete durable log. */
const usageTrackProjection = {
  key: 'usageTrack',
  stateVersion: 1,
  stateSchema: {
    /** The state is plugin-owned JSON; a malformed cached row starts empty. */
    parse(value) {
      return value !== null
        && typeof value === 'object'
        && Array.isArray(value.turns)
        && (value.last === null || typeof value.last === 'object')
        ? value
        : { turns: [], last: null }
    },
  },
  init: () => ({ turns: [], last: null }),
  /**
   * @param {{turns: readonly any[], last: any}} state
   * @param {any} event
   */
  apply: (state, event) => {
    switch (event.type) {
      case 'turn/start': {
        const turnNumber = Number(event.data.turn)
        if (!Number.isSafeInteger(turnNumber) || turnNumber < 0) return state
        const existing = state.turns.find(turn => turn.turn === turnNumber)
        if (existing !== undefined && existing.startedAt !== null) return state
        return withTurn(state, turnNumber, turn => ({
          ...turn,
          startedAt: turn.startedAt === null ? event.time : turn.startedAt,
          status: 'running',
        }))
      }
      case 'llm/retry-started': {
        const last = state.last
        if (last === null || last.turn !== event.data.turn || last.step !== event.data.step) return state
        return { ...state, last: null }
      }
      case 'assistant/message':
      case 'assistant/attempt': {
        const turnNumber = Number(event.data.turn)
        if (!Number.isSafeInteger(turnNumber) || turnNumber < 0) return state
        const sample = event.type === 'assistant/message'
          ? (event.data.usage ?? usageFromStream(event.data.stream))
          : usageFromStream(event.data.stream)
        const source = event.type === 'assistant/message' && event.data.message !== undefined
          ? event.data.message.source
          : undefined
        if (sample === undefined && source === undefined) return state
        const next = sample === undefined ? undefined : bucketsOf(sample)
        const last = state.last
        const previous = next !== undefined
          && last !== null
          && last.turn === turnNumber
          && last.step === event.data.step
          ? last
          : null
        if (next !== undefined && previous !== null && sameBuckets(previous, next)) return state
        const updated = withTurn(state, turnNumber, turn => {
          const record = { ...turn }
          if (source !== undefined) {
            if (typeof source.provider === 'string' && source.provider !== '') record.provider = source.provider
            if (typeof source.model === 'string' && source.model !== '') record.model = source.model
          }
          if (next === undefined) return record
          if (previous !== null) {
            record.input -= previous.input
            record.cacheRead -= previous.cacheRead
            record.cacheWrite -= previous.cacheWrite
            record.output -= previous.output
            record.reasoning -= previous.reasoning
          }
          record.input += next.input
          record.cacheRead += next.cacheRead
          record.cacheWrite += next.cacheWrite
          record.output += next.output
          record.reasoning += next.reasoning
          return record
        })
        return {
          ...updated,
          last: next === undefined ? state.last : {
            turn: turnNumber,
            step: event.data.step,
            ...next,
          },
        }
      }
      case 'turn/end': {
        const turnNumber = Number(event.data.turn)
        if (!Number.isSafeInteger(turnNumber) || turnNumber < 0) return state
        const reason = event.data.reason
        const kind = reason !== null && typeof reason === 'object' && typeof reason.kind === 'string'
          ? reason.kind
          : 'completed'
        const updated = withTurn(state, turnNumber, turn => ({
          ...turn,
          endedAt: event.time,
          status: kind,
        }))
        return {
          ...updated,
          last: state.last !== null && state.last.turn === turnNumber ? null : state.last,
        }
      }
      default:
        return state
    }
  },
  wire: {
    viewSchema: {
      parse(value) {
        return Array.isArray(value) ? value : []
      },
    },
    view: state => state.turns,
    summary: true,
  },
}

/** @param {unknown} value */
function validPricing(value) {  if (value === null || typeof value !== 'object' || !Array.isArray(value.models)) return false
  if (typeof value.version !== 'string' || value.version === '') return false
  return value.models.every(entry => entry !== null
    && typeof entry === 'object'
    && typeof entry.provider === 'string'
    && typeof entry.model === 'string'
    && typeof entry.currency === 'string'
    && Number.isFinite(Number(entry.input))
    && Number.isFinite(Number(entry.output)))
}

async function readBundledPricing() {
  const text = await readFile(PRICING_PATH, 'utf8')
  const value = JSON.parse(text)
  if (!validPricing(value)) throw new Error('Invalid bundled pricing catalog')
  return value
}

async function fetchJson(source) {
  const response = await fetch(source.url, {
    headers: { accept: source.accept, 'user-agent': 'dsh-usage-balance-card' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  if (text.length > 1_000_000) throw new Error('Pricing catalog is too large')
  const value = JSON.parse(text)
  if (!validPricing(value)) throw new Error('Invalid pricing catalog')
  return value
}

let pricingCache = null
let pricingCachedAt = 0
let pricingFailed = false
let pricingInFlight = null
let bundledPricing = null

async function currentPricing() {
  const now = Date.now()
  if (pricingCache !== null && now - pricingCachedAt < PRICING_TTL_MS) {
    return {
      source: pricingFailed ? 'cache' : 'remote',
      error: pricingFailed,
      catalog: pricingCache,
    }
  }
  if (pricingInFlight !== null) return pricingInFlight
  pricingInFlight = (async () => {
    for (const source of PRICING_SOURCES) {
      try {
        const catalog = await fetchJson(source)
        pricingCache = catalog
        pricingCachedAt = Date.now()
        pricingFailed = false
        return { source: 'remote', error: false, catalog }
      } catch (_error) {
        // Try the mirror, then fall back to the last good/bundled catalog.
      }
    }
    pricingFailed = true
    if (pricingCache !== null) {
      return { source: 'cache', error: true, catalog: pricingCache }
    }
    if (bundledPricing === null) bundledPricing = await readBundledPricing()
    return { source: 'builtin', error: true, catalog: bundledPricing }
  })()
  try {
    return await pricingInFlight
  } finally {
    pricingInFlight = null
  }
}

/** @param {import('node:http').IncomingMessage} req */
function isLoopbackRequest(req) {
  const address = String(req.socket.remoteAddress || '')
  return address === '127.0.0.1'
    || address === '::1'
    || address.startsWith('::ffff:127.')
}

/** @param {import('node:http').IncomingMessage} req */
async function readRequestBody(req, maxBytes = REPORT_MAX_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('report body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** @param {string} title @param {string} html @param {number} width @param {number} height */
async function openNativeReport(title, html, width, height) {
  const file = path.join(tmpdir(), `dsh-usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`)
  await writeFile(file, html, 'utf8')
  const url = pathToFileURL(file).href
  const candidates = [
    process.env.DSH_USAGE_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(value => typeof value === 'string' && value !== '' && existsSync(value))
  const size = `${Math.max(560, Math.min(1600, Math.round(width)))}`
    + `,${Math.max(420, Math.min(1200, Math.round(height)))}`
  let opened = false
  for (const exe of candidates) {
    try {
      const child = spawn(exe, [`--app=${url}`, `--window-size=${size}`, '--new-window'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      })
      child.unref()
      opened = true
      break
    } catch (_error) {
      // Try the next Chromium/Edge installation.
    }
  }
  if (!opened) {
    try {
      const child = spawn('cmd.exe', ['/c', 'start', '', file], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      opened = true
    } catch (_error) {
      opened = false
    }
  }
  if (!opened) {
    await unlink(file).catch(() => {})
    throw new Error('No Edge/Chrome executable found')
  }
  setTimeout(() => { void unlink(file).catch(() => {}) }, 15 * 60 * 1000).unref()
  return file
}

/** Persistent Host-side archive for deleted Sessions and long all-time history. */
let archiveCache
let archiveWriteChain = Promise.resolve()

function validArchiveSession(value) {
  return value !== null && typeof value === 'object' && Array.isArray(value.turns)
}

function mergeArchiveTurns(existing, incoming) {
  const byTurn = new Map()
  for (const turn of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (turn === null || typeof turn !== 'object') continue
    const number = Number(turn.turn)
    if (!Number.isSafeInteger(number) || number < 0) continue
    byTurn.set(number, turn)
  }
  return [...byTurn.values()].sort((left, right) => Number(left.turn) - Number(right.turn))
}

function pruneArchiveSessions(sessions) {
  const records = Object.entries(sessions)
    .filter(([id, record]) => id !== '' && validArchiveSession(record))
    .sort((left, right) => Number(right[1].updatedAt ?? 0) - Number(left[1].updatedAt ?? 0))
  const result = {}
  let kept = 0
  for (const [id, record] of records) {
    if (kept >= ARCHIVE_MAX_TURNS) break
    const turns = mergeArchiveTurns([], record.turns).slice(-(ARCHIVE_MAX_TURNS - kept))
    result[id] = { turns, updatedAt: Number(record.updatedAt ?? Date.now()) }
    kept += turns.length
  }
  return result
}

async function readHostArchive() {
  if (archiveCache !== undefined) return archiveCache
  try {
    const raw = await readFile(ARCHIVE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    archiveCache = parsed !== null && typeof parsed === 'object' && parsed.sessions !== null && typeof parsed.sessions === 'object'
      ? pruneArchiveSessions(parsed.sessions)
      : {}
  } catch (_error) {
    archiveCache = {}
  }
  return archiveCache
}

function writeHostArchive(sessions) {
  const next = pruneArchiveSessions(sessions)
  archiveCache = next
  archiveWriteChain = archiveWriteChain.then(async () => {
    await mkdir(path.dirname(ARCHIVE_FILE), { recursive: true })
    const temporary = `${ARCHIVE_FILE}.tmp`
    await writeFile(temporary, JSON.stringify({ version: 1, sessions: next }), 'utf8')
    await rename(temporary, ARCHIVE_FILE)
  }).catch(() => {})
  return archiveWriteChain
}

async function mergeHostArchive(incoming) {
  const current = await readHostArchive()
  const next = { ...current }
  if (incoming === null || typeof incoming !== 'object') return current
  for (const [id, record] of Object.entries(incoming)) {
    if (typeof id !== 'string' || id === '' || id.length > 300 || !validArchiveSession(record)) continue
    const turns = mergeArchiveTurns(next[id]?.turns, record.turns)
    if (turns.length === 0) continue
    next[id] = { turns, updatedAt: Number(record.updatedAt ?? Date.now()) }
  }
  await writeHostArchive(next)
  return archiveCache ?? current
}

/** The projection registry and the same-origin pricing route. */
export const inject = ['sessionProjections', 'webServer', 'connection']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export async function apply(ctx) {
  await ctx.sessionProjections.register(usageTrackProjection)
  const webServer = ctx.get('webServer')
  const connection = ctx.get('connection')
  if (webServer !== undefined) {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: PRICING_ROUTE,
      resource: async request => {
        const rejection = connection === undefined ? 503 : connection.requestRejection(request)
        if (rejection !== undefined) {
          return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
            status: rejection,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            },
          })
        }
        const payload = await currentPricing()
        return new Response(JSON.stringify(payload), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        })
      },
    }), 'usage-balance: pricing route')

    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: REPORT_ROUTE,
      handler: async (req, res) => {
        const reply = (status, payload) => {
          res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify(payload))
        }
        const rejection = connection === undefined ? 503 : connection.requestRejection(req)
        if (rejection !== undefined) {
          reply(rejection, { ok: false, error: 'unauthorized' })
          return
        }
        if (!isLoopbackRequest(req)) {
          reply(403, { ok: false, error: 'loopback only' })
          return
        }
        if (req.method !== 'POST') {
          reply(405, { ok: false, error: 'POST required' })
          return
        }
        try {
          const body = JSON.parse(await readRequestBody(req))
          if (body === null || typeof body !== 'object'
            || typeof body.title !== 'string' || body.title.length > 300
            || typeof body.html !== 'string' || body.html.length > REPORT_MAX_BYTES) {
            reply(400, { ok: false, error: 'invalid report' })
            return
          }
          await openNativeReport(body.title, body.html, Number(body.width), Number(body.height))
          reply(200, { ok: true })
        } catch (error) {
          reply(500, { ok: false, error: error instanceof Error ? error.message : 'failed to open report' })
        }
      },
    }), 'usage-balance: native report window route')

    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: ARCHIVE_ROUTE,
      handler: async (req, res) => {
        const reply = (status, payload) => {
          res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify(payload))
        }
        const rejection = connection === undefined ? 503 : connection.requestRejection(req)
        if (rejection !== undefined) {
          reply(rejection, { ok: false, error: 'unauthorized' })
          return
        }
        if (!isLoopbackRequest(req)) {
          reply(403, { ok: false, error: 'loopback only' })
          return
        }
        try {
          if (req.method === 'GET' || req.method === 'HEAD') {
            const sessions = await readHostArchive()
            reply(200, { ok: true, sessions })
            return
          }
          if (req.method !== 'POST') {
            reply(405, { ok: false, error: 'GET or POST required' })
            return
          }
          const body = JSON.parse(await readRequestBody(req, ARCHIVE_MAX_BYTES))
          if (body === null || typeof body !== 'object' || body.sessions === null || typeof body.sessions !== 'object') {
            reply(400, { ok: false, error: 'invalid archive' })
            return
          }
          await mergeHostArchive(body.sessions)
          reply(200, { ok: true })
        } catch (error) {
          reply(500, { ok: false, error: error instanceof Error ? error.message : 'archive failed' })
        }
      },
    }), 'usage-balance: durable archive route')
  }
}
