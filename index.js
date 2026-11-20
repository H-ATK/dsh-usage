/**
 * Host half of the usage/balance bundle.
 *
 * Owns one session projection, `usageTrack`, that folds the complete durable
 * log into per-turn token buckets and timing. The browser half reads the
 * projection through the ordinary session-projection carrier, so it can
 * collect every Session without paging conversation history.
 */
import z from '@deepseek-ai/schemastery'

const MAX_TURNS = 500

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

/** The projection registry is the Host half's whole purpose. */
export const inject = ['sessionProjections']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export async function apply(ctx) {
  await ctx.sessionProjections.register(usageTrackProjection)
}
