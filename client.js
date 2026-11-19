/**
 * Browser half of the usage/balance bundle.
 *
 * Both surfaces are independent, Host-configured features:
 *  - a rounded balance card in the sidebar footer, beside the account avatar;
 *  - a "使用量轨迹" Conversation View tab backed by the `usageTrack` session
 *    projection (complete durable log, not just the loaded chat window).
 *
 * Enabling the usage view starts one background projection collection across
 * every Session in the Session list; re-enabling repeats it. The card reads the
 * same projection for the just-finished turn and refreshes the wallet
 * independently.
 */
window.__ModuleLoader__.load({
  id: 'dsh-usage-balance-card',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React

    const NS = 'usageTrack'
    const BALANCE_KEY = 'dsh-usage-balance:balance'
    const CARD_STATE_KEY = 'dsh-usage-balance:card-state:v1'
    const CARD_STATE_MAX = 80
    const LOCAL_CONFIG_KEY = 'dsh-usage-balance:features'
    const BUNDLE_NAME = 'dsh-usage-balance-card'
    const ROW_ID = 'usage-balance-card'
    const EMPTY_TURNS = []
    const CONFIG_ENTRY_IDS = [BUNDLE_NAME, ROW_ID, `include:${ROW_ID}`]
    const COLLECT_CONCURRENCY = 3

    /** DeepSeek published CNY prices per million tokens, before tax. */
    const FLASH_PRICES = {
      off: { hit: 0.02, miss: 1, out: 4 },
      peak: { hit: 0.04, miss: 2, out: 8 },
    }
    const PRO_PRICES = {
      off: { hit: 0.15, miss: 3, out: 13.5 },
      peak: { hit: 0.3, miss: 6, out: 27 },
    }

    const zh = {
      view: {
        label: '使用量轨迹',
        title: '使用量轨迹',
        subtitle: '按轮次记录当前会话的 Token、缓存命中、费用、耗时与高峰时段',
        emptyTitle: '当前会话还没有对话记录',
        emptyHint: '开始一轮对话后，这里会按轮次记录用量和时间。',
        note: '费用按 DeepSeek 官方峰谷价估算；命中率按输入 Token 计算，进度条百分比按本轮总 Token 计算，实际以平台账单为准。',
      },
      summary: { turns: '轮次', tokens: '总 Token', cost: '累计费用' },
      table: {
        turn: '轮次',
        started: '开始时间',
        duration: '用时',
        total: '总 Token',
        cost: '消耗',
        peak: '时段',
        status: '状态',
      },
      status: {
        running: '进行中',
        complete: '完成',
        error: '出错',
        cancelled: '已取消',
        blocked: '已阻止',
        maxTokens: '达到上限',
        unknown: '未知',
      },
      peak: { on: '高峰', off: '空闲' },
      metric: {
        hit: '命中缓存',
        miss: '未命中缓存',
        hitRate: '缓存命中率',
        share: '占总量',
        detail: '输入',
        cacheWrite: '缓存写入',
        output: '输出',
      },
      card: {
        balance: '余额',
        thisTurn: '本轮',
        previous: '上轮',
        thisTurnFull: '本轮消费',
        previousFull: '上一轮消费',
        running: '进行中',
        interrupted: '被中断',
        error: '出错',
        blocked: '已阻止',
        maxTokens: '达到上限',
        unavailable: '余额 --',
        failed: '余额读取失败',
        pending: '余额读取中',
        none: '本轮 --',
        costHint: '按官方价格估算',
        turns: '轮次',
        steps: '步骤',
        speed: 'tok/s',
        tokens: 'Token',
        cache: '缓存命中',
        context: '上下文',
      },
      config: {
        title: '功能开关',
        subtitle: '三个功能相互独立，可以单独开启或关闭。',
        balanceCard: '余额卡片',
        balanceCardHint: '在对话框左侧显示余额、上一轮/本轮消费和会话统计，并隐藏对话框底部的统计行。',
        usageTrajectory: '使用量轨迹',
        usageTrajectoryHint: '在会话顶部显示“使用量轨迹”页签；首次启用或重新启用时会在后台收集所有对话窗口的完整轮次。',
        cardDetails: '显示其他信息',
        cardDetailsHint: '开启时显示轮次、步骤、Token、缓存命中率和上下文；关闭时只显示余额、上一轮消费和本轮消费。',
        note: '三个开关相互独立；关闭使用量轨迹不会移除余额卡片和原生统计行。',
        on: '已开启',
        off: '已关闭',
      },
      aria: {
        card: '账户余额与本轮消耗',
        ledger: '当前会话的用量轨迹',
      },
    }

    const en = {
      view: {
        label: 'Usage trajectory',
        title: 'Usage trajectory',
        subtitle: 'Per-turn tokens, cache hits, cost, duration, and peak window',
        emptyTitle: 'No turns in this session yet',
        emptyHint: 'Start a conversation and every turn will be recorded here.',
        note: 'Cost is estimated from DeepSeek official peak/off-peak pricing. Hit rate uses input tokens; bar percentages use the turn total. The platform bill is authoritative.',
      },
      summary: { turns: 'Turns', tokens: 'Total tokens', cost: 'Total cost' },
      table: {
        turn: 'Turn',
        started: 'Started',
        duration: 'Duration',
        total: 'Total tokens',
        cost: 'Cost',
        peak: 'Window',
        status: 'Status',
      },
      status: {
        running: 'Running',
        complete: 'Complete',
        error: 'Error',
        cancelled: 'Cancelled',
        blocked: 'Blocked',
        maxTokens: 'Max tokens',
        unknown: 'Unknown',
      },
      peak: { on: 'Peak', off: 'Off-peak' },
      metric: {
        hit: 'Cache hit',
        miss: 'Cache miss',
        hitRate: 'Cache hit rate',
        share: 'of total',
        detail: 'Input',
        cacheWrite: 'Cache write',
        output: 'Output',
      },
      card: {
        balance: 'Bal',
        thisTurn: 'Now',
        previous: 'Prev',
        thisTurnFull: 'This turn',
        previousFull: 'Previous turn',
        running: 'Running',
        interrupted: 'Interrupted',
        error: 'Error',
        blocked: 'Blocked',
        maxTokens: 'Max tokens',
        unavailable: 'Balance --',
        failed: 'Balance unavailable',
        pending: 'Loading balance',
        none: 'This turn --',
        costHint: 'estimated from official pricing',
        turns: 'Turns',
        steps: 'Steps',
        speed: 'tok/s',
        tokens: 'Token',
        cache: 'Cache hit',
        context: 'Context',
      },
      config: {
        title: 'Feature switches',
        subtitle: 'The three features are independent; each can be switched separately.',
        balanceCard: 'Balance card',
        balanceCardHint: 'Show the balance, previous/current-turn spend, and session stats left of the input card, and hide the composer statistics row.',
        usageTrajectory: 'Usage trajectory',
        usageTrajectoryHint: 'Show the Usage trajectory tab; when first enabled or re-enabled it collects every Session’s complete turn history in the background.',
        cardDetails: 'Show other information',
        cardDetailsHint: 'On: show turns, steps, tokens, cache hit rate, and context. Off: show only balance, previous-turn spend, and current-turn spend.',
        note: 'The three switches are independent; turning off Usage trajectory does not remove the balance card or the native statistics row.',
        on: 'On',
        off: 'Off',
      },
      aria: {
        card: 'Account balance and current-turn spend',
        ledger: 'Usage trajectory for the current session',
      },
    }

    /** Locale dictionaries are flat `dotted.key` → template strings. */
    function flattenDictionary(source, prefix = '', target = {}) {
      for (const [key, value] of Object.entries(source)) {
        const path = prefix === '' ? key : `${prefix}.${key}`
        if (value !== null && typeof value === 'object') {
          flattenDictionary(value, path, target)
        } else {
          target[path] = String(value)
        }
      }
      return target
    }

    const CSS = `
/* Carve a left column out of the composer seat and let the input card fill the
   rest. The card and the composer then share the same 16px outer margin. */
[data-dsub-side-card] {
  padding-left: calc(
    var(--dsub-card-width) + var(--dsub-card-gap) + var(--dsub-card-margin)
    - var(--dsh-composer-side-clearance)
  ) !important;
  padding-right: 0 !important;
}
[data-dsub-side-card] > * {
  width: 100% !important;
  max-width: none !important;
  align-self: stretch !important;
}
[data-dsub-side-card] [data-composer-card] {
  width: 100% !important;
  max-width: none !important;
}
/* With the card carrying the statistics AND "other information" on, hide the
   built-in dock; when the user turns the other information off the native row
   must stay visible. */
[data-dsub-side-card][data-dsub-card-details="true"] [data-composer-dock] > * {
  visibility: hidden !important;
}
/* Card off + other information off: the native statistics row is gone
   completely, including its reserved row height. */
[data-dsub-hide-dock] [data-composer-dock] {
  min-height: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
/* A two-line composer: the card and this input share one measured height. */
[data-dsub-side-card] [data-composer-card] {
  min-height: 108px !important;
}
[data-dsub-side-card] [data-composer-card] textarea,
[data-dsub-side-card] [data-composer-card] [contenteditable="true"] {
  min-height: 48px !important;
}
[data-dsub-side-card][data-dsub-compact="true"] [data-composer-card] {
  min-height: 86px !important;
}
[data-dsub-side-card][data-dsub-compact="true"] [data-composer-card] textarea,
[data-dsub-side-card][data-dsub-compact="true"] [data-composer-card] [contenteditable="true"] {
  min-height: 32px !important;
}
/* The toolbar is the card's last child. Extra card height must collect above
   it, so the attachment/model/send controls stay pinned to the bottom. */
[data-dsub-side-card] [data-composer-card] > :last-child {
  margin-top: auto;
}

.dsub-side-anchor { display: contents; }
.dsub-side-card {
  position: absolute;
  left: var(--dsub-card-margin, 16px);
  width: var(--dsub-card-width, 240px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-panel);
  background: var(--dsw-specific-input-major);
  box-shadow: var(--dsw-elevation-soft);
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  z-index: 1;
}
.dsub-side-top { display: flex; align-items: flex-end; gap: 2px; min-width: 0; }
.dsub-side-balance { display: flex; align-items: baseline; gap: 4px; min-width: 0; flex: none; }
.dsub-side-label { color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 18px; letter-spacing: .01em; white-space: nowrap; }
.dsub-side-amount {
  font-size: 14px; line-height: 18px; font-weight: 700;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.dsub-side-amount[data-tone="danger"] { color: var(--dsw-alias-state-error-primary); }
.dsub-side-amount[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dsub-side-amount[data-tone="ok"] { color: #3b82f6; }
.dsub-side-amount[data-tone="unknown"] { color: var(--dsw-alias-label-secondary); }
.dsub-side-amount[data-failed="true"] { opacity: .75; }
.dsub-side-costs { display: flex; align-items: flex-end; justify-content: flex-end; gap: 4px; margin-left: auto; min-width: 0; }
.dsub-side-cost { display: flex; align-items: baseline; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 18px; white-space: nowrap; }
.dsub-side-cost b { color: #f87171; font-size: 14px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-status { display: inline-flex; align-items: center; gap: 5px; font-size: 14px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dsub-side-status[data-state="running"] { color: #eab308; }
.dsub-side-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-brand-primary); flex: none; }
.dsub-side-status[data-state="running"] .dsub-side-status-dot { background: #eab308; animation: dsub-pulse 1.2s ease-in-out infinite; }
.dsub-side-status[data-state="interrupted"] .dsub-side-status-dot,
.dsub-side-status[data-state="error"] .dsub-side-status-dot { background: var(--dsw-alias-state-error-primary); }
.dsub-side-status[data-state="blocked"] .dsub-side-status-dot,
.dsub-side-status[data-state="maxTokens"] .dsub-side-status-dot { background: var(--dsw-alias-state-warn-primary); }
.dsub-side-stats { display: flex; flex-wrap: wrap; gap: 2px 10px; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 19px; font-variant-numeric: tabular-nums; }
.dsub-side-stats b { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dsub-side-bottom { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dsub-side-cache { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dsub-side-cache-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 18px; }
.dsub-side-cache-top b { color: var(--dsw-alias-label-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-bar {
  height: 7px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 3px;
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}
.dsub-side-bar > span { display: block; height: 100%; border-radius: 2px; background: #2563eb; transition: width .25s ease; }
.dsub-side-context { flex: none; display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 18px; }
.dsub-side-context b { display: block; color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-donut { display: block; flex: none; }
.dsub-side-donut .dsub-donut-track { stroke: var(--dsw-alias-bg-base); }
.dsub-side-donut .dsub-donut-fill { stroke: #2563eb; transition: stroke-dasharray .2s ease, stroke .2s ease; }
.dsub-side-donut .dsub-donut-fill[data-tone="warn"] { stroke: #f59e0b; }
.dsub-side-donut .dsub-donut-fill[data-tone="danger"] { stroke: #ef4444; }
.dsub-side-simple-balance { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.dsub-side-simple-costs { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-width: 0; }
.dsub-side-simple-cost { display: flex; flex-direction: column; gap: 0; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 18px; white-space: nowrap; }
.dsub-side-simple-cost b { color: #f87171; font-size: 14px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-simple-current { align-items: flex-end; margin-left: auto; }

.dsub-view {
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
}
.dsub-view-head {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 18px;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.dsub-view-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dsub-view-title h2 { margin: 0; font-size: 17px; line-height: 23px; font-weight: 650; letter-spacing: .01em; }
.dsub-view-title p { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 18px; }
.dsub-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; }
.dsub-chip {
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 16px; white-space: nowrap;
}
.dsub-chip b { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-scroll {
  flex: 1 1 auto; min-height: 0; overflow: auto;
  padding: 0 24px calc(var(--dsh-composer-height, 152px) + 22px);
  box-sizing: border-box;
}
.dsub-table { min-width: 0; }
.dsub-row {
  display: grid;
  grid-template-columns:
    minmax(112px, 1.25fr) minmax(104px, 1.2fr) minmax(72px, .8fr)
    minmax(94px, 1.05fr) minmax(86px, .95fr) 68px 78px;
  align-items: center;
  column-gap: 10px;
  box-sizing: border-box;
}
.dsub-table-head {
  position: sticky; top: 0; z-index: 2;
  padding: 14px 12px 9px;
  background: var(--dsw-alias-bg-layer-1);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px; line-height: 17px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
}
.dsub-turn {
  margin-top: 8px; padding: 13px 15px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 14px;
  transition: background-color .15s ease, border-color .15s ease;
}
.dsub-turn:hover { background: var(--dsw-alias-bg-overlay); border-color: var(--dsw-alias-border-l2); }
.dsub-turn[data-running="true"] { border-color: var(--dsw-alias-brand-primary); }
.dsub-turn[data-error="true"] { border-color: var(--dsw-alias-state-error-primary); }
.dsub-cell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.dsub-turn-no { display: flex; flex-direction: column; gap: 2px; }
.dsub-turn-no b { font-size: 15px; line-height: 20px; font-weight: 650; }
.dsub-turn-no span { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; }
.dsub-time { display: flex; flex-direction: column; gap: 2px; }
.dsub-time b { font-weight: 550; }
.dsub-time span { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; }
.dsub-muted { color: var(--dsw-alias-label-secondary); }
.dsub-cost { color: var(--dsw-alias-brand-primary); font-weight: 600; }
.dsub-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.dsub-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex: none; }
.dsub-turn[data-running="true"] .dsub-dot { background: var(--dsw-alias-brand-primary); animation: dsub-pulse 1.2s ease-in-out infinite; }
.dsub-turn[data-error="true"] .dsub-dot { background: var(--dsw-alias-state-error-primary); }
.dsub-turn[data-running="false"][data-error="false"] .dsub-dot { background: var(--dsw-alias-state-success-primary); }
@keyframes dsub-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .28; } }
.dsub-peak {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 3px 8px; border-radius: 7px;
  font-size: 12px; line-height: 16px; font-weight: 600; white-space: nowrap;
}
.dsub-peak[data-peak="true"] { color: #dc2626; background: rgba(220,38,38,.13); border: 1px solid rgba(220,38,38,.24); }
.dsub-peak[data-peak="false"] { color: #2563eb; background: rgba(37,99,235,.11); border: 1px solid rgba(37,99,235,.2); }
.dsub-metrics {
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 11px; padding: 11px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsub-metric-top { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-bottom: 6px; }
.dsub-metric-name { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; font-weight: 600; }
.dsub-metric-value { color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 17px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dsub-metric-value em { color: var(--dsw-alias-label-secondary); font-style: normal; font-size: 12px; margin-left: 5px; }
.dsub-bar {
  height: 8px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}
.dsub-bar > span { display: block; height: 100%; border-radius: 3px; transition: width .25s ease; }
.dsub-bar-hit > span { background: #2563eb; }
.dsub-bar-miss > span { background: #dc2626; }
.dsub-hitrate {
  display: inline-flex; align-items: center; gap: 6px;
  align-self: flex-start;
  padding: 4px 9px; border-radius: 7px;
  color: #2563eb; background: rgba(37,99,235,.1);
  border: 1px solid rgba(37,99,235,.18);
  font-size: 12px; line-height: 16px; font-weight: 600;
}
.dsub-detail { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 17px; font-variant-numeric: tabular-nums; }
.dsub-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; min-height: 280px; padding: 36px 20px; text-align: center;
}
.dsub-empty-mark {
  display: grid; place-items: center; width: 50px; height: 50px; border-radius: 16px;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
}
.dsub-empty h3 { margin: 4px 0 0; font-size: 17px; font-weight: 600; }
.dsub-empty p { margin: 0; max-width: 420px; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 21px; }
.dsub-note { margin: 18px 2px 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dsub-config {
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-config-head { display: flex; flex-direction: column; gap: 3px; }
.dsub-config-head h3 { margin: 0; font-size: 14px; line-height: 19px; font-weight: 650; }
.dsub-config-head p { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 17px; }
.dsub-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.dsub-switch-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsub-switch-copy b { font-size: 13px; line-height: 18px; font-weight: 600; }
.dsub-switch-copy span { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }
.dsub-switch {
  position: relative; flex: none;
  width: 38px; height: 22px; padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 11px;
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
  transition: background-color .18s ease, border-color .18s ease;
}
.dsub-switch[data-checked="true"] { background: #2563eb; border-color: #2563eb; }
.dsub-switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsub-switch-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.2);
  transition: left .18s ease;
}
.dsub-switch[data-checked="true"] .dsub-switch-thumb { left: 18px; }
.dsub-config-note { color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 15px; }
@media (prefers-reduced-motion: reduce) {
  .dsub-turn, .dsub-turn .dsub-dot, .dsub-bar > span, .dsub-side-bar > span, .dsub-side-status-dot, .dsub-side-donut .dsub-donut-fill, .dsub-switch, .dsub-switch-thumb { transition: none; animation: none; }
}
`

    /** Component-local styles are removed with the component. */
    function Styles() {
      return h('style', { 'data-dsh-usage-balance-styles': '' }, CSS)
    }

    const integerFormatter = new Intl.NumberFormat('zh-CN')

    /** @param {unknown} value @returns {number} */
    function num(value) {
      const n = Number(value)
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
    }

    /** @param {number} value @returns {string} */
    function formatInteger(value) {
      return integerFormatter.format(Math.max(0, Math.round(Number(value) || 0)))
    }

    /** Friendly model names with the product version for the ledger. */
    const MODEL_NAMES = {
      'deepseek-flash': 'DeepSeek V4.1 Flash',
      'deepseek-pro': 'DeepSeek V4.1 Pro',
      'deepseek-chat': 'DeepSeek V4.1 Chat',
      'deepseek-reasoner': 'DeepSeek V4.1 Reasoner',
      'deepseek-v4.1-flash': 'DeepSeek V4.1 Flash',
      'deepseek-v4.1-pro': 'DeepSeek V4.1 Pro',
    }

    /** @param {any} model @param {any} provider @returns {string} */
    function modelLabel(model, provider) {
      const raw = typeof model === 'string' ? model.trim() : ''
      if (raw === '') return '—'
      const mapped = MODEL_NAMES[raw.toLowerCase()]
      if (mapped !== undefined) return mapped
      const source = typeof provider === 'string' && provider.trim() !== ''
        ? `${provider.trim().charAt(0).toUpperCase()}${provider.trim().slice(1)}`
        : ''
      if (source !== '' && !raw.toLowerCase().startsWith(source.toLowerCase())) return `${source} ${raw}`
      return raw
    }

    /** @param {number} value @param {number} digits */
    function trimFixed(value, digits) {
      return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
    }

    /**
     * Chinese readers get direct 万/亿/万亿/兆 units; English readers keep
     * the conventional K/M/B/T suffixes.
     * @param {number} value
     * @param {boolean} zhUser
     */
    function formatTokenCount(value, zhUser) {
      const n = Math.max(0, Number(value) || 0)
      if (!zhUser) {
        if (n >= 1e12) return `${trimFixed(n / 1e12, 2)}T`
        if (n >= 1e9) return `${trimFixed(n / 1e9, 2)}B`
        if (n >= 1e6) return `${trimFixed(n / 1e6, 2)}M`
        if (n >= 1e3) return `${trimFixed(n / 1e3, 1)}K`
        return formatInteger(n)
      }
      if (n < 1e4) return formatInteger(n)
      if (n < 1e8) return `${trimFixed(n / 1e4, n / 1e4 >= 100 ? 0 : n / 1e4 >= 10 ? 1 : 2)}万`
      if (n < 1e12) return `${trimFixed(n / 1e8, n / 1e8 >= 100 ? 0 : n / 1e8 >= 10 ? 1 : 2)}亿`
      if (n < 1e16) return `${trimFixed(n / 1e12, n / 1e12 >= 100 ? 0 : n / 1e12 >= 10 ? 1 : 2)}万亿`
      return `${trimFixed(n / 1e16, n / 1e16 >= 100 ? 0 : n / 1e16 >= 10 ? 1 : 2)}兆`
    }

    /** @param {number} ms */
    function formatDuration(ms) {
      if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—'
      if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`
      const seconds = ms / 1000
      if (seconds < 60) return `${seconds.toFixed(1)}s`
      const minutes = Math.floor(seconds / 60)
      const rest = Math.round(seconds % 60)
      return `${minutes}m ${rest}s`
    }

    /** @param {number|null|undefined} value @param {string} currency @param {number} [digits] */
    function formatMoney(value, currency, digits) {
      const symbol = currency === 'USD' ? '$' : '¥'
      const n = Number(value)
      if (!Number.isFinite(n)) return `${symbol}--`
      const places = digits === undefined
        ? (Math.abs(n) > 0 && Math.abs(n) < 0.1 ? 4 : 2)
        : digits
      return `${symbol}${n.toFixed(places)}`
    }

    /** @param {number|null|undefined} ms @param {boolean} zhUser */
    function formatClock(ms, zhUser) {
      if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
      return new Date(ms).toLocaleTimeString(zhUser ? 'zh-CN' : 'en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    /** @param {number|null|undefined} ms @param {boolean} zhUser */
    function formatDay(ms, zhUser) {
      if (ms === null || ms === undefined || !Number.isFinite(ms)) return ''
      return new Date(ms).toLocaleDateString(zhUser ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit' })
    }

    /** @param {number|null|undefined} ms @param {boolean} zhUser */
    function formatFullTime(ms, zhUser) {
      if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—'
      return new Date(ms).toLocaleString(zhUser ? 'zh-CN' : 'en-US', { hour12: false })
    }

    /** @param {number} ms @returns {boolean} whether Beijing time is a published peak window. */
    function isPeak(ms) {
      const value = Number(ms)
      if (!Number.isFinite(value)) return false
      const d = new Date(value + 8 * 60 * 60 * 1000)
      const day = d.getUTCDay()
      if (day === 0 || day === 6) return false
      const hour = d.getUTCHours() + d.getUTCMinutes() / 60
      return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
    }

    /** @param {string} model @param {number} at @returns {{hit:number,miss:number,out:number}} */
    function priceFor(model, at) {
      const table = /pro/i.test(String(model || '')) ? PRO_PRICES : FLASH_PRICES
      return isPeak(at) ? table.peak : table.off
    }

    /** @param {any} turn */
    function promptTokens(turn) {
      return num(turn.input) + num(turn.cacheRead) + num(turn.cacheWrite)
    }

    /** @param {any} turn */
    function totalTokens(turn) {
      return promptTokens(turn) + num(turn.output)
    }

    /** @param {any} turn @returns {number|null} */
    function turnCost(turn) {
      const total = totalTokens(turn)
      if (total === 0) return null
      const price = priceFor(turn.model, turn.startedAt)
      return ((num(turn.input) + num(turn.cacheWrite)) * price.miss
        + num(turn.cacheRead) * price.hit
        + num(turn.output) * price.out) / 1e6
    }

    /** @param {any} turn @returns {string} */
    function cardStatusOf(turn) {
      if (turn === null || turn === undefined) return 'unknown'
      if (turn.endedAt === null || turn.endedAt === undefined) return 'running'
      const status = String(turn.status || 'completed')
      if (status === 'aborted' || status === 'cancelled' || status === 'interrupted') return 'interrupted'
      if (status === 'error') return 'error'
      if (status === 'blocked') return 'blocked'
      if (status === 'max-tokens') return 'maxTokens'
      return 'completed'
    }

    /** @param {any} turn @returns {number|null} */
    function cacheHitRate(turn) {
      const prompt = promptTokens(turn)
      return prompt === 0 ? null : num(turn.cacheRead) / prompt * 100
    }

    /** @param {any} pressure @returns {number|null} */
    function contextUsage(pressure) {
      if (pressure === null || pressure === undefined) return null
      const window = Number(pressure.contextWindow)
      if (!Number.isFinite(window) || window <= 0) return null
      const tokens = Number.isFinite(pressure.projectedTokens) ? pressure.projectedTokens : pressure.pressureTokens
      if (!Number.isFinite(tokens)) return null
      return Math.max(0, Math.min(100, tokens / window * 100))
    }

    function readStoredJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw === null ? null : JSON.parse(raw)
      } catch (_error) {
        return null
      }
    }

    function writeStoredJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (_error) {
        // Private storage / quota: the in-memory state still renders.
      }
    }

    /** @param {string|undefined} sessionId */
    function readCardSnapshot(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const all = readStoredJson(CARD_STATE_KEY)
      const value = all !== null && typeof all === 'object' ? all[sessionId] : null
      return value !== null && typeof value === 'object' ? value : null
    }

    /** @param {string|undefined} sessionId @param {any} snapshot */
    function writeCardSnapshot(sessionId, snapshot) {
      if (typeof sessionId !== 'string' || sessionId === '') return
      const all = readStoredJson(CARD_STATE_KEY)
      const map = all !== null && typeof all === 'object' ? { ...all } : {}
      map[sessionId] = { ...snapshot, updatedAt: Date.now() }
      const entries = Object.entries(map)
        .sort((left, right) => Number(right[1] && right[1].updatedAt || 0) - Number(left[1] && left[1].updatedAt || 0))
        .slice(0, CARD_STATE_MAX)
      writeStoredJson(CARD_STATE_KEY, Object.fromEntries(entries))
    }

    function readLocalConfig() {
      try {
        const raw = window.localStorage.getItem(LOCAL_CONFIG_KEY)
        return raw === null ? {} : JSON.parse(raw)
      } catch (_error) {
        return {}
      }
    }

    function writeLocalConfig(value) {
      try {
        window.localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(value))
      } catch (_error) {
        // The in-memory config still applies for this page lifetime.
      }
    }

    /** @param {any} details */
    function sumWallets(details) {
      const wallets = [
        ...(Array.isArray(details && details.value) ? details.value : []),
        ...(Array.isArray(details && details.bonusWallets) ? details.bonusWallets : []),
      ]
      let cny = 0
      let usd = 0
      let hasCny = false
      let hasUsd = false
      for (const wallet of wallets) {
        const amount = Number(wallet && wallet.balance)
        if (!Number.isFinite(amount)) continue
        if (wallet.currency === 'USD') {
          usd += amount
          hasUsd = true
        } else {
          cny += amount
          hasCny = true
        }
      }
      return { cny, usd, hasCny, hasUsd, at: Date.now() }
    }

    function clientMetadata(ctx) {
      let version = '0.0.0'
      try {
        if (typeof process !== 'undefined' && process.env && process.env.DSH_CLIENT_VERSION) {
          version = String(process.env.DSH_CLIENT_VERSION)
        }
      } catch (_error) {
        // A page without the build define still answers the required metadata.
      }
      let locale = 'en'
      try {
        locale = ctx.locale.getSnapshot().active || locale
      } catch (_error) {
        // Keep the fallback.
      }
      return {
        version,
        locale,
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      }
    }

    /** @param {import('@deepseek-ai/cordis').Context} ctx */
    function useLocaleId(ctx) {
      const [locale, setLocale] = useState(() => ctx.locale.getSnapshot().active)
      useEffect(() => ctx.locale.subscribe(() => { setLocale(ctx.locale.getSnapshot().active) }), [])
      return locale
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'configForms', 'remote', 'remote.account'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, {
          zh: flattenDictionary(zh),
          en: flattenDictionary(en),
        }), 'usage-balance: dictionaries')

        // ---- Feature configuration -------------------------------------
        const forms = CONFIG_ENTRY_IDS.map(id => ctx.configForms.get(id))
        const configListeners = new Set()
        let featureConfig = { balanceCard: true, usageTrajectory: true, cardDetails: true }
        let lastCollectEnabled = null
        const readConfig = () => {
          for (const form of forms) {
            const snapshot = form.getSnapshot()
            if (snapshot.status === 'ready' && snapshot.value !== undefined && snapshot.value !== null) {
              return snapshot.value
            }
          }
          return undefined
        }
        const useFeatureConfig = () => {
          const [snapshot, setSnapshot] = useState(featureConfig)
          useEffect(() => {
            const listener = () => { setSnapshot(featureConfig) }
            configListeners.add(listener)
            listener()
            return () => { configListeners.delete(listener) }
          }, [])
          return snapshot
        }

        // ---- Complete-log projection cache -----------------------------
        const collected = new Map()
        const knownSessions = new Set()
        let collectGeneration = 0
        let listSubscription
        let cardDisposer
        let statPillDisposers = []
        let viewDisposer
        let configPanelDisposer

        const projectionTurns = sessionId => {
          try {
            const state = ctx.sessions.list.getSnapshot()
            const value = state.projectionsBySession
              && state.projectionsBySession[sessionId]
              && state.projectionsBySession[sessionId].values
              ? state.projectionsBySession[sessionId].values.usageTrack
              : undefined
            return Array.isArray(value) ? value : undefined
          } catch (_error) {
            return undefined
          }
        }

        const collectSession = async (sessionId, generation) => {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await ctx.sessions.refreshProjections(sessionId)
            } catch (_error) {
              if (attempt === 0) {
                await new Promise(resolve => setTimeout(resolve, 350))
                continue
              }
              return false
            }
            if (generation !== collectGeneration) return false
            const turns = projectionTurns(sessionId)
            if (turns !== undefined) {
              collected.set(sessionId, turns)
              return true
            }
            if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 300))
          }
          return false
        }

        const collectAllSessions = async () => {
          const generation = ++collectGeneration
          let ids = []
          try {
            ids = [...ctx.sessions.list.getSnapshot().ids]
          } catch (_error) {
            return
          }
          knownSessions.clear()
          for (const id of ids) knownSessions.add(id)
          const queue = ids.slice()
          const workers = Array.from({ length: COLLECT_CONCURRENCY }, async () => {
            while (queue.length > 0 && generation === collectGeneration) {
              const id = queue.shift()
              if (id === undefined) break
              await collectSession(id, generation)
            }
          })
          await Promise.all(workers)
        }

        const startCollection = () => {
          collected.clear()
          knownSessions.clear()
          void collectAllSessions()
          if (listSubscription === undefined) {
            try {
              listSubscription = ctx.sessions.list.subscribe(() => {
                if (!featureConfig.balanceCard && !featureConfig.usageTrajectory) return
                try {
                  const ids = ctx.sessions.list.getSnapshot().ids
                  for (const id of ids) {
                    if (knownSessions.has(id)) continue
                    knownSessions.add(id)
                    void collectSession(id, collectGeneration)
                  }
                } catch (_error) {
                  // A retiring client generation must not throw from a store
                  // subscriber; the active generation re-collects on load.
                }
              })
            } catch (_error) {
              // No live Session list yet; the next enable/load retries.
            }
          }
        }

        // ---- Balance card beside the composer ---------------------------
        const SideBalanceCard = ({ useProjection, useSession, sessionId }) => {
          const config = useFeatureConfig()
          const locale = useLocaleId(ctx)
          const zhUser = String(locale || '').toLowerCase().startsWith('zh')
          const liveTurns = useProjection('usageTrack')
          const stats = useProjection('sessionStats')
          const usage = useProjection('tokenUsage')
          const pressure = useProjection('contextPressure')
          const running = typeof useSession === 'function' ? useSession(snapshot => snapshot.running) : false
          const blank = typeof useSession === 'function' ? useSession(snapshot => snapshot.blank) : true
          const [turns, setTurns] = useState(() => collected.get(sessionId))
          const [balance, setBalance] = useState(() => readStoredJson(BALANCE_KEY))
          const [stored, setStored] = useState(() => readCardSnapshot(sessionId))
          const [failed, setFailed] = useState(false)
          const [geometry, setGeometry] = useState(null)
          const anchorRef = useRef(null)
          const alive = useRef(true)
          const refreshing = useRef(false)
          const lastSnapshotRef = useRef('')
          const previousRunning = useRef(running)

          useEffect(() => {
            alive.current = true
            return () => { alive.current = false }
          }, [])

          useEffect(() => {
            setStored(readCardSnapshot(sessionId))
            lastSnapshotRef.current = ''
          }, [sessionId])

          const refreshBalance = useCallback(async () => {
            if (refreshing.current || !alive.current) return
            refreshing.current = true
            try {
              const result = await ctx.remote.account.getBalance(clientMetadata(ctx))
              if (!alive.current) return
              if (!result || result.ok !== true || !result.value || result.value.status !== 'ready') {
                setFailed(true)
                return
              }
              const next = sumWallets(result.value)
              setBalance(next)
              writeStoredJson(BALANCE_KEY, next)
              setFailed(false)
            } catch (_error) {
              if (alive.current) setFailed(true)
            } finally {
              refreshing.current = false
            }
          }, [])

          // Refresh on first mount and on every Session switch.
          useEffect(() => { void refreshBalance() }, [refreshBalance, sessionId])
          useEffect(() => {
            const timer = window.setInterval(() => { void refreshBalance() }, 60_000)
            return () => { window.clearInterval(timer) }
          }, [refreshBalance])

          // The last completed turn belongs to this Session; the projection is
          // whole-log, so switching Sessions shows that window's own last turn.
          useEffect(() => {
            let active = true
            setTurns(collected.get(sessionId))
            void (async () => {
              try {
                await ctx.sessions.refreshProjections(sessionId)
              } catch (_error) {
                // Fall through to the cache.
              }
              if (!active) return
              const value = projectionTurns(sessionId)
              if (Array.isArray(value)) {
                collected.set(sessionId, value)
                setTurns(value)
              }
            })()
            return () => { active = false }
          }, [sessionId])

          useEffect(() => {
            if (Array.isArray(liveTurns) && liveTurns.length > 0) {
              collected.set(sessionId, liveTurns)
              setTurns(liveTurns)
            } else if (!Array.isArray(liveTurns)) {
              setTurns(collected.get(sessionId))
            }
          }, [liveTurns, sessionId])

          useEffect(() => {
            const wasRunning = previousRunning.current === true
            previousRunning.current = running
            if (wasRunning === running) return undefined
            let active = true
            void (async () => {
              try {
                await ctx.sessions.refreshProjections(sessionId)
              } catch (_error) {
                // The live projection still updates; the cache is a fallback.
              }
              if (!active) return
              const value = projectionTurns(sessionId)
              if (Array.isArray(value)) {
                collected.set(sessionId, value)
                setTurns(value)
              }
              if (wasRunning && !running) {
                void refreshBalance()
                window.setTimeout(() => { void refreshBalance() }, 2_500)
              }
            })()
            return () => { active = false }
          }, [running, refreshBalance, sessionId])

          // The card matches the input card exactly and sits in a left column
          // carved out of the composer seat. The seat carries the layout switch
          // and the CSS variables; the ResizeObserver follows every draft grow.
          useLayoutEffect(() => {
            const anchor = anchorRef.current
            const seat = anchor === null ? null : anchor.closest('[data-composer-seat]')
            if (seat === null) return undefined
            const composerCard = seat.querySelector('[data-composer-card]')
            if (composerCard === null) return undefined
            let frame = 0
            const update = () => {
              const seatRect = seat.getBoundingClientRect()
              const width = seatRect.width
              const baseWidth = width >= 1000
                ? 280
                : width >= 800
                  ? 264
                  : 0
              const compact = config.cardDetails === false
              const cardWidth = baseWidth === 0
                ? 0
                : compact
                  ? Math.round(baseWidth * 0.8)
                  : baseWidth
              if (cardWidth === 0) {
                seat.removeAttribute('data-dsub-side-card')
                seat.removeAttribute('data-dsub-compact')
                seat.removeAttribute('data-dsub-card-details')
                seat.style.removeProperty('--dsub-card-width')
                seat.style.removeProperty('--dsub-card-gap')
                seat.style.removeProperty('--dsub-card-margin')
                setGeometry(null)
                return
              }
              const gap = 16
              const margin = 16
              seat.dataset.dsubSideCard = 'true'
              if (compact) seat.dataset.dsubCompact = 'true'
              else seat.removeAttribute('data-dsub-compact')
              if (!compact) seat.dataset.dsubCardDetails = 'true'
              else seat.removeAttribute('data-dsub-card-details')
              seat.style.setProperty('--dsub-card-width', `${cardWidth}px`)
              seat.style.setProperty('--dsub-card-gap', `${gap}px`)
              seat.style.setProperty('--dsub-card-margin', `${margin}px`)
              const paddedSeatRect = seat.getBoundingClientRect()
              const cardRect = composerCard.getBoundingClientRect()
              setGeometry({ top: cardRect.top - paddedSeatRect.top, height: cardRect.height })
            }
            update()
            const observer = new ResizeObserver(() => {
              cancelAnimationFrame(frame)
              frame = requestAnimationFrame(update)
            })
            observer.observe(composerCard)
            observer.observe(seat)
            return () => {
              cancelAnimationFrame(frame)
              observer.disconnect()
              seat.removeAttribute('data-dsub-side-card')
              seat.removeAttribute('data-dsub-compact')
              seat.removeAttribute('data-dsub-card-details')
              seat.style.removeProperty('--dsub-card-width')
              seat.style.removeProperty('--dsub-card-gap')
              seat.style.removeProperty('--dsub-card-margin')
            }
          }, [sessionId, blank, config.cardDetails])

          const primary = balance && balance.hasCny
            ? { amount: balance.cny, currency: 'CNY' }
            : balance && balance.hasUsd
              ? { amount: balance.usd, currency: 'USD' }
              : null
          const tone = primary === null
            ? 'unknown'
            : primary.amount > 50
              ? 'ok'
              : primary.amount < 10
                ? 'danger'
                : 'warn'
          const completed = (Array.isArray(turns) ? turns : EMPTY_TURNS)
            .filter(turn => turn.endedAt !== null && turn.endedAt !== undefined)
            .sort((left, right) => left.turn - right.turn)
          const sortedTurns = (Array.isArray(turns) ? turns : EMPTY_TURNS)
            .slice()
            .sort((left, right) => left.turn - right.turn)
          const latestTurn = sortedTurns.at(-1)
          const latestCompleted = completed.at(-1)
          const previousCompleted = completed.at(-2)
          const sessionRunning = running === true
            || (latestTurn !== undefined && (latestTurn.endedAt === null || latestTurn.endedAt === undefined))
          const currentTurn = sessionRunning ? null : latestTurn
          const currentStatus = sessionRunning
            ? 'running'
            : currentTurn === undefined
              ? null
              : cardStatusOf(currentTurn)
          const currentCost = currentTurn !== null && currentTurn !== undefined && currentStatus === 'completed'
            ? turnCost(currentTurn)
            : null
          const previousTurn = sessionRunning ? latestCompleted : previousCompleted
          const previousCost = previousTurn === undefined ? null : turnCost(previousTurn)
          const billed = usage === undefined
            ? 0
            : num(usage.uncachedInputTokens) + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens)
          const sessionTotal = usage === undefined
            ? (Array.isArray(turns) ? turns.reduce((sum, turn) => sum + totalTokens(turn), 0) : 0)
            : billed + num(usage.outputTokens)
          const hitRate = usage === undefined || billed === 0
            ? null
            : num(usage.cacheReadTokens) / billed * 100
          const speed = stats === undefined || !(Number(stats.decodeMs) > 0)
            ? null
            : Number(stats.decodeTokens) / (Number(stats.decodeMs) / 1000)
          const context = contextUsage(pressure)
          const completedUsage = completed.some(turn => totalTokens(turn) > 0)
          const liveHasUsage = sessionTotal > 0
            || (stats !== undefined && Number(stats.steps) > 0)
            || completedUsage
            || (latestTurn !== undefined && totalTokens(latestTurn) > 0)
          const liveShowDetails = completed.length > 0 && liveHasUsage
          const hasLiveTurns = sortedTurns.length > 0
          const useLiveState = hasLiveTurns || running === true
          const storedStats = stored !== null && stored.stats !== null && typeof stored.stats === 'object'
            ? stored.stats
            : null
          const liveStats = liveShowDetails
            ? {
              turns: stats !== undefined && Number(stats.turns) > 0
                ? Number(stats.turns)
                : (storedStats !== null && Number(storedStats.turns) > 0 ? Number(storedStats.turns) : completed.length),
              steps: stats !== undefined && Number(stats.steps) > 0
                ? Number(stats.steps)
                : (storedStats !== null ? Number(storedStats.steps) || 0 : 0),
              speed: speed !== null
                ? speed
                : (storedStats !== null && Number(storedStats.speed) > 0 ? Number(storedStats.speed) : null),
              tokens: sessionTotal > 0
                ? sessionTotal
                : (storedStats !== null ? Number(storedStats.tokens) || 0 : 0),
            }
            : null
          const display = useLiveState
            ? {
              hasTurn: sortedTurns.length > 0 || running === true,
              currentStatus,
              currentAmount: currentCost,
              previousAmount: previousCost !== null
                ? previousCost
                : (sortedTurns.length === 0 && stored !== null ? stored.previousAmount ?? null : null),
              showDetails: liveShowDetails,
              stats: liveStats,
              cache: hitRate ?? (stored !== null ? stored.cache ?? null : null),
              context: context ?? (stored !== null ? stored.context ?? null : null),
            }
            : {
              hasTurn: stored !== null ? Boolean(stored.hasTurn) : false,
              currentStatus: stored !== null ? stored.currentStatus ?? null : null,
              currentAmount: stored !== null ? stored.currentAmount ?? null : null,
              previousAmount: stored !== null ? stored.previousAmount ?? null : null,
              showDetails: stored !== null ? Boolean(stored.showDetails) : false,
              stats: storedStats,
              cache: stored !== null ? stored.cache ?? null : null,
              context: stored !== null ? stored.context ?? null : null,
            }
          const snapshotJson = JSON.stringify(display)
          useEffect(() => {
            if (!display.hasTurn || typeof sessionId !== 'string' || sessionId === '') return
            if (snapshotJson === lastSnapshotRef.current) return
            lastSnapshotRef.current = snapshotJson
            writeCardSnapshot(sessionId, display)
          }, [snapshotJson, sessionId, display.hasTurn])
          if (!config.balanceCard) return null

          const donutRadius = 10
          const donutCircumference = 2 * Math.PI * donutRadius
          const contextWidth = display.context === null ? 0 : donutCircumference * display.context / 100
          const contextTone = display.context === null
            ? 'normal'
            : display.context >= 90
              ? 'danger'
              : display.context >= 60
                ? 'warn'
                : 'normal'
          const compactCard = config.cardDetails === false
          const simpleBalance = h('div', { className: 'dsub-side-simple-balance' },
            h('span', { className: 'dsub-side-label' }, t('card.balance')),
            h('span', {
              className: 'dsub-side-amount',
              'data-tone': tone,
              'data-failed': failed ? 'true' : 'false',
            }, primary === null ? t('card.unavailable') : formatMoney(primary.amount, primary.currency, 2)),
          )
          const simpleCosts = display.hasTurn
            ? h('div', { className: 'dsub-side-simple-costs' },
              display.previousAmount !== null
                ? h('div', { className: 'dsub-side-simple-cost dsub-side-simple-previous' },
                  h('span', null, t('card.previousFull')),
                  h('b', null, `-${formatMoney(display.previousAmount, 'CNY')}`),
                )
                : null,
              h('div', { className: 'dsub-side-simple-cost dsub-side-simple-current' },
                h('span', null, t('card.thisTurnFull')),
                display.currentStatus !== null && display.currentStatus !== 'completed'
                  ? h('span', {
                    className: 'dsub-side-status',
                    'data-state': display.currentStatus,
                  },
                    h('span', { className: 'dsub-side-status-dot', 'aria-hidden': 'true' }),
                    t(`card.${display.currentStatus}`),
                  )
                  : h('b', null, display.currentAmount === null ? '--' : `-${formatMoney(display.currentAmount, 'CNY')}`),
              ),
            )
            : null
          const cardProps = {
            className: 'dsub-side-card',
            role: 'status',
            'aria-label': t('aria.card'),
            style: geometry === null ? undefined : { top: geometry.top, height: geometry.height },
          }
          const card = geometry !== null && geometry.height > 20
            ? compactCard
              ? h('div', cardProps, simpleBalance, simpleCosts)
              : h('div', cardProps,
              h('div', { className: 'dsub-side-top' },
                h('div', { className: 'dsub-side-balance' },
                  h('span', { className: 'dsub-side-label' }, t('card.balance')),
                  h('span', {
                    className: 'dsub-side-amount',
                    'data-tone': tone,
                    'data-failed': failed ? 'true' : 'false',
                  }, primary === null ? t('card.unavailable') : formatMoney(primary.amount, primary.currency, 2)),
                ),
                display.hasTurn
                  ? h('div', { className: 'dsub-side-costs' },
                    display.previousAmount !== null
                      ? h('div', { className: 'dsub-side-cost dsub-side-previous' },
                        h('span', null, t('card.previous')),
                        h('b', null, `-${formatMoney(display.previousAmount, 'CNY')}`),
                      )
                      : null,
                    h('div', {
                      className: 'dsub-side-cost dsub-side-current',
                      'data-current': display.currentStatus === 'completed' ? 'amount' : 'status',
                    },
                      h('span', null, t('card.thisTurn')),
                      display.currentStatus !== null && display.currentStatus !== 'completed'
                        ? h('span', {
                          className: 'dsub-side-status',
                          'data-state': display.currentStatus,
                        },
                          h('span', { className: 'dsub-side-status-dot', 'aria-hidden': 'true' }),
                          t(`card.${display.currentStatus}`),
                        )
                        : h('b', null, display.currentAmount === null ? '--' : `-${formatMoney(display.currentAmount, 'CNY')}`),
                    ),
                  )
                  : null,
              ),
              display.showDetails && display.stats !== null
                ? h('div', { className: 'dsub-side-stats' },
                  h('span', null, h('b', null, formatInteger(display.stats.turns)), ' ', t('card.turns')),
                  display.stats.steps > 0
                    ? h('span', null, h('b', null, formatInteger(display.stats.steps)), ' ', t('card.steps'))
                    : null,
                  display.stats.speed !== null
                    ? h('span', null, h('b', null, formatInteger(display.stats.speed)), ' ', t('card.speed'))
                    : null,
                  h('span', null, h('b', null, formatTokenCount(display.stats.tokens, zhUser)), ' ', t('card.tokens')),
                )
                : null,
              display.showDetails && (display.cache !== null || display.context !== null)
                ? h('div', { className: 'dsub-side-bottom' },
                  h('div', { className: 'dsub-side-cache' },
                    h('div', { className: 'dsub-side-cache-top' },
                      h('span', null, t('card.cache')),
                      h('b', null, display.cache === null ? '--' : `${display.cache.toFixed(1)}%`),
                    ),
                    h('div', { className: 'dsub-side-bar' },
                      h('span', { style: { width: `${display.cache === null ? 0 : Math.max(0, Math.min(100, display.cache))}%` } }),
                    ),
                  ),
                  display.context === null
                    ? null
                    : h('div', { className: 'dsub-side-context' },
                      h('svg', {
                        className: 'dsub-side-donut',
                        viewBox: '0 0 24 24',
                        width: 30,
                        height: 30,
                        'aria-hidden': 'true',
                      },
                        h('circle', {
                          className: 'dsub-donut-track',
                          cx: 12,
                          cy: 12,
                          r: donutRadius,
                          fill: 'none',
                          strokeWidth: 3,
                        }),
                        h('circle', {
                          className: 'dsub-donut-fill',
                          'data-tone': contextTone,
                          cx: 12,
                          cy: 12,
                          r: donutRadius,
                          fill: 'none',
                          strokeWidth: 3,
                          strokeLinecap: 'round',
                          strokeDasharray: `${contextWidth} ${donutCircumference}`,
                          transform: 'rotate(-90 12 12)',
                        }),
                      ),
                      h('span', null,
                        h('b', null, `${display.context.toFixed(0)}%`),
                        t('card.context'),
                      ),
                    ),
                )
                : null,
            )
            : null

          return h(React.Fragment, null,
            h(Styles),
            h('div', { ref: anchorRef, className: 'dsub-side-anchor' }, card),
          )
        }

        // ---- Usage trajectory view -------------------------------------
        const UsageTrackView = ({ useProjection, sessionId }) => {
          const config = useFeatureConfig()
          const live = useProjection('usageTrack')
          const locale = useLocaleId(ctx)
          const zhUser = String(locale || '').toLowerCase().startsWith('zh')
          const [cached, setCached] = useState(() => collected.get(sessionId))
          const [clock, setClock] = useState(() => Date.now())

          useEffect(() => {
            if (Array.isArray(live) && live.length > 0) {
              collected.set(sessionId, live)
              setCached(live)
            } else if (!Array.isArray(live)) {
              setCached(collected.get(sessionId))
            }
          }, [live, sessionId])

          const turns = useMemo(() => {
            const source = Array.isArray(live) && live.length > 0 ? live : (cached || EMPTY_TURNS)
            return [...source].sort((left, right) => left.turn - right.turn)
          }, [live, cached])

          const anyRunning = turns.some(turn => turn.endedAt === null || turn.endedAt === undefined)
          useEffect(() => {
            if (!anyRunning) return undefined
            const timer = window.setInterval(() => { setClock(Date.now()) }, 1_000)
            return () => { window.clearInterval(timer) }
          }, [anyRunning])

          const totals = useMemo(() => {
            let total = 0
            let cost = 0
            let priced = false
            for (const turn of turns) {
              total += totalTokens(turn)
              const value = turnCost(turn)
              if (value !== null) {
                cost += value
                priced = true
              }
            }
            return { total, cost, priced }
          }, [turns])

          const header = h('header', { className: 'dsub-view-head' },
            h('div', { className: 'dsub-view-title' },
              h('h2', null, t('view.title')),
              h('p', null, t('view.subtitle')),
            ),
            h('div', { className: 'dsub-summary' },
              h('span', { className: 'dsub-chip' },
                h('span', null, t('summary.turns')),
                h('b', null, String(turns.length))),
              h('span', { className: 'dsub-chip' },
                h('span', null, t('summary.tokens')),
                h('b', null, formatTokenCount(totals.total, zhUser))),
              h('span', { className: 'dsub-chip' },
                h('span', null, t('summary.cost')),
                h('b', null, totals.priced ? formatMoney(totals.cost, 'CNY') : '--')),
            ),
          )

          if (!config.usageTrajectory) return null

          if (turns.length === 0) {
            return h('div', {
              className: 'dsub-view',
              'data-conversation-composer-overlay': '',
              'aria-label': t('aria.ledger'),
            },
              h(Styles),
              header,
              h('div', { className: 'dsub-scroll' },
                h('div', { className: 'dsub-empty' },
                  h('span', { className: 'dsub-empty-mark', 'aria-hidden': 'true' },
                    h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none' },
                      h('path', { d: 'M5 6.5h14v11H5z', stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: 'round' }),
                      h('path', { d: 'M5 10h14M9 14h3', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
                    )),
                  h('h3', null, t('view.emptyTitle')),
                  h('p', null, t('view.emptyHint')),
                ),
              ),
            )
          }

          return h('div', {
            className: 'dsub-view',
            'data-conversation-composer-overlay': '',
            'aria-label': t('aria.ledger'),
          },
            h(Styles),
            header,
            h('div', { className: 'dsub-scroll' },
              h('div', { className: 'dsub-table' },
                h('div', { className: 'dsub-row dsub-table-head' },
                  h('span', null, t('table.turn')),
                  h('span', null, t('table.started')),
                  h('span', null, t('table.duration')),
                  h('span', null, t('table.total')),
                  h('span', null, t('table.cost')),
                  h('span', null, t('table.peak')),
                  h('span', null, t('table.status')),
                ),
                turns.map(turn => {
                  const started = turn.startedAt
                  const ended = turn.endedAt
                  const running = ended === null || ended === undefined
                  const duration = started === null || started === undefined
                    ? null
                    : Math.max(0, (running ? clock : ended) - started)
                  const total = totalTokens(turn)
                  const hit = num(turn.cacheRead)
                  const miss = num(turn.input) + num(turn.cacheWrite)
                  const hitPercent = total === 0 ? 0 : hit / total * 100
                  const missPercent = total === 0 ? 0 : miss / total * 100
                  const rate = cacheHitRate(turn)
                  const peak = isPeak(started)
                  const cost = turnCost(turn)
                  const status = running
                    ? 'running'
                    : turn.status === 'error'
                      ? 'error'
                      : turn.status === 'aborted'
                        ? 'cancelled'
                        : turn.status === 'blocked'
                          ? 'blocked'
                          : turn.status === 'max-tokens'
                            ? 'maxTokens'
                            : turn.status === 'completed' || turn.status === 'interrupted' || turn.status === 'forked'
                              ? 'complete'
                              : 'unknown'
                  return h('div', {
                    key: turn.turn,
                    className: 'dsub-turn',
                    'data-running': running ? 'true' : 'false',
                    'data-error': status === 'error' ? 'true' : 'false',
                  },
                    h('div', { className: 'dsub-row' },
                      h('div', { className: 'dsub-cell dsub-turn-no' },
                        h('b', null, `#${turn.turn}`),
                        h('span', { title: turn.model || '' }, modelLabel(turn.model, turn.provider)),
                      ),
                      h('div', { className: 'dsub-cell dsub-time', title: formatFullTime(started, zhUser) },
                        h('b', null, formatClock(started, zhUser)),
                        h('span', null, formatDay(started, zhUser) || '—'),
                      ),
                      h('div', { className: 'dsub-cell' }, formatDuration(duration)),
                      h('div', { className: 'dsub-cell', title: `${formatInteger(total)} ${t('table.total')}` }, formatTokenCount(total, zhUser)),
                      h('div', { className: 'dsub-cell dsub-cost' }, cost === null ? '--' : formatMoney(cost, 'CNY')),
                      h('div', { className: 'dsub-cell' },
                        h('span', { className: 'dsub-peak', 'data-peak': peak ? 'true' : 'false' },
                          peak ? t('peak.on') : t('peak.off'))),
                      h('div', { className: 'dsub-cell' },
                        h('span', { className: 'dsub-status' },
                          h('span', { className: 'dsub-dot', 'aria-hidden': 'true' }),
                          t(`status.${status}`),
                        ),
                      ),
                    ),
                    h('div', { className: 'dsub-metrics' },
                      h('span', { className: 'dsub-hitrate' },
                        t('metric.hitRate'), ' ', rate === null ? '--' : `${rate.toFixed(1)}%`),
                      h('div', null,
                        h('div', { className: 'dsub-metric-top' },
                          h('span', { className: 'dsub-metric-name' }, t('metric.hit')),
                          h('span', { className: 'dsub-metric-value' },
                            `${formatTokenCount(hit, zhUser)}`,
                            h('em', null, `${hitPercent.toFixed(1)}% ${t('metric.share')}`)),
                        ),
                        h('div', { className: 'dsub-bar dsub-bar-hit' },
                          h('span', { style: { width: `${Math.max(0, Math.min(100, hitPercent))}%` } }),
                        ),
                      ),
                      h('div', null,
                        h('div', { className: 'dsub-metric-top' },
                          h('span', { className: 'dsub-metric-name' }, t('metric.miss')),
                          h('span', { className: 'dsub-metric-value' },
                            `${formatTokenCount(miss, zhUser)}`,
                            h('em', null, `${missPercent.toFixed(1)}% ${t('metric.share')}`)),
                        ),
                        h('div', { className: 'dsub-bar dsub-bar-miss' },
                          h('span', { style: { width: `${Math.max(0, Math.min(100, missPercent))}%` } }),
                        ),
                      ),
                      h('div', { className: 'dsub-detail' },
                        `${t('metric.detail')} ${formatTokenCount(num(turn.input), zhUser)}`
                        + ` · ${t('metric.cacheWrite')} ${formatTokenCount(num(turn.cacheWrite), zhUser)}`
                        + ` · ${t('metric.output')} ${formatTokenCount(num(turn.output), zhUser)}`,
                      ),
                    ),
                  )
                }),
                h('p', { className: 'dsub-note' }, t('view.note')),
              ),
            ),
          )
        }

        // ---- Slot wiring and the plugin-page switches -----------------
        const syncSlots = () => {
          const hideDock = !featureConfig.balanceCard && featureConfig.cardDetails === false
          if (typeof document !== 'undefined') {
            if (hideDock) document.documentElement.setAttribute('data-dsub-hide-dock', 'true')
            else document.documentElement.removeAttribute('data-dsub-hide-dock')
          }
          if (featureConfig.balanceCard && cardDisposer === undefined) {
            cardDisposer = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
              name: 'conversation.input.dock',
              id: 'usage-balance-card-side',
              order: 30,
              locale: NS,
            }, SideBalanceCard))
          } else if (!featureConfig.balanceCard && cardDisposer !== undefined) {
            cardDisposer()
            cardDisposer = undefined
            // The card is gone; release the seat layout switch so the built-in
            // composer statistics row is not left hidden by the card CSS.
            for (const seat of document.querySelectorAll('[data-dsub-side-card]')) {
              seat.removeAttribute('data-dsub-side-card')
              seat.removeAttribute('data-dsub-compact')
              seat.style.removeProperty('--dsub-card-width')
              seat.style.removeProperty('--dsub-card-gap')
              seat.style.removeProperty('--dsub-card-margin')
            }
          }
          // The card's own CSS hides the shipped statistics row while the card
          // is visible. The replacement entries are needed only when the card
          // is off and the user explicitly turns "other information" off; the
          // card must not shadow the built-in row when it is hidden at narrow
          // widths, and it must not hide it when the card feature is off.
          const replaceStats = !featureConfig.balanceCard && featureConfig.cardDetails === false
          if (replaceStats && statPillDisposers.length === 0) {
            // The shipped pills register at list priority 0. Reusing their ids
            // at the same priority throws during boot, so a replacement must
            // register at a lower priority: the lowest live entry wins and the
            // shipped pill is shadowed rather than duplicated.
            statPillDisposers = [
              ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
                name: 'conversation.composer.dock',
                id: 'activity',
                order: 0,
                priority: -1,
              }, () => null)),
              ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
                name: 'conversation.composer.dock',
                id: 'usage',
                order: 1,
                priority: -1,
              }, () => null)),
            ]
          } else if (!replaceStats && statPillDisposers.length > 0) {
            for (const dispose of statPillDisposers) dispose()
            statPillDisposers = []
          }
          if (featureConfig.usageTrajectory && viewDisposer === undefined) {
            viewDisposer = ctx.slots.inject('conversation.view', () => ctx.slots.register({
              name: 'conversation.view',
              id: 'usage-track',
              order: 20,
              locale: NS,
              label: () => t('view.label'),
            }, UsageTrackView))
          } else if (!featureConfig.usageTrajectory && viewDisposer !== undefined) {
            viewDisposer()
            viewDisposer = undefined
          }
        }

        const applyConfig = next => {
          const changed = next.balanceCard !== featureConfig.balanceCard
            || next.usageTrajectory !== featureConfig.usageTrajectory
            || next.cardDetails !== featureConfig.cardDetails
          featureConfig = next
          if (changed) {
            for (const listener of configListeners) listener()
          }
          // Register the visible surfaces first. Background projection work is
          // deferred so a service-context hiccup can never block the card/tab.
          syncSlots()
          const shouldCollect = next.balanceCard || next.usageTrajectory
          if (shouldCollect && lastCollectEnabled !== true) {
            window.setTimeout(() => {
              try {
                startCollection()
              } catch (_error) {
                // The card and ledger still work from the active Session's live
                // projections; collection retries on the next enable/load.
              }
            }, 0)
          } else if (!shouldCollect) {
            collectGeneration += 1
          }
          lastCollectEnabled = shouldCollect
        }

        const setFeature = (field, value) => {
          const local = readLocalConfig()
          local[field] = value
          writeLocalConfig(local)
          applyConfig({ ...featureConfig, [field]: value })
          for (const form of forms) {
            if (form.getSnapshot().status === 'ready') {
              void form.set(field, value).catch(() => undefined)
              break
            }
          }
        }

        const FeatureConfigPanel = () => {
          const config = useFeatureConfig()
          const row = (field, label, hint) => h('div', { className: 'dsub-switch-row' },
            h('div', { className: 'dsub-switch-copy' },
              h('b', null, t(label)),
              h('span', null, t(hint)),
            ),
            h('button', {
              type: 'button',
              className: 'dsub-switch',
              role: 'switch',
              'aria-checked': config[field] ? 'true' : 'false',
              'aria-label': t(label),
              'data-checked': config[field] ? 'true' : 'false',
              onClick: () => { setFeature(field, !config[field]) },
            }, h('span', { className: 'dsub-switch-thumb', 'aria-hidden': 'true' })),
          )
          return h(React.Fragment, null,
            h(Styles),
            h('div', { className: 'dsub-config' },
              h('div', { className: 'dsub-config-head' },
                h('h3', null, t('config.title')),
                h('p', null, t('config.subtitle')),
              ),
              row('balanceCard', 'config.balanceCard', 'config.balanceCardHint'),
              row('usageTrajectory', 'config.usageTrajectory', 'config.usageTrajectoryHint'),
              row('cardDetails', 'config.cardDetails', 'config.cardDetailsHint'),
              h('p', { className: 'dsub-config-note' }, t('config.note')),
            ))
        }

        const ensureConfigDefaults = () => {
          const local = readLocalConfig()
          let changed = false
          for (const field of ['balanceCard', 'usageTrajectory', 'cardDetails']) {
            if (local[field] === undefined) {
              local[field] = true
              changed = true
            }
          }
          if (changed) writeLocalConfig(local)
          return local
        }

        const syncConfig = () => {
          const host = readConfig()
          const local = ensureConfigDefaults()
          applyConfig({
            balanceCard: local.balanceCard !== undefined
              ? local.balanceCard !== false
              : host === undefined ? true : host.balanceCard !== false,
            usageTrajectory: local.usageTrajectory !== undefined
              ? local.usageTrajectory !== false
              : host === undefined ? true : host.usageTrajectory !== false,
            cardDetails: local.cardDetails !== undefined
              ? local.cardDetails !== false
              : host === undefined ? true : host.cardDetails !== false,
          })
        }

        configPanelDisposer = ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: BUNDLE_NAME,
          locale: NS,
        }, FeatureConfigPanel))

        ctx.effect(() => {
          const unsubscribers = forms.map(form => form.subscribe(syncConfig))
          syncConfig()
          return () => {
            for (const off of unsubscribers) off()
            collectGeneration += 1
            if (listSubscription !== undefined) { listSubscription(); listSubscription = undefined }
            if (cardDisposer !== undefined) { cardDisposer(); cardDisposer = undefined }
            for (const dispose of statPillDisposers) dispose()
            statPillDisposers = []
            if (viewDisposer !== undefined) { viewDisposer(); viewDisposer = undefined }
            if (configPanelDisposer !== undefined) { configPanelDisposer(); configPanelDisposer = undefined }
            if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-dsub-hide-dock')
          }
        }, 'usage-balance: feature switches')
      },
    }
  },
})
