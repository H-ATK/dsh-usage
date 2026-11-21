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
    const ARCHIVE_KEY = 'dsh-usage-balance:archive:v1'
    const ARCHIVE_ROUTE = '/dsh-usage-balance-card/archive'
    const ARCHIVE_MAX_TURNS = 30000
    const PRICING_OVERRIDE_KEY = 'dsh-usage-balance:pricing-override:v1'
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
    // 2026 State Council holiday schedule. Holiday dates are off-peak all day;
    // make-up weekend workdays use the normal weekday peak hours.
    const CN_HOLIDAYS_2026 = new Set([
      '2026-01-01', '2026-01-02', '2026-01-03',
      '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
      '2026-04-04', '2026-04-05', '2026-04-06',
      '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
      '2026-06-19', '2026-06-20', '2026-06-21',
      '2026-09-25', '2026-09-26', '2026-09-27',
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
    ])
    const CN_MAKEUP_WORKDAYS_2026 = new Set([
      '2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10',
    ])
    /** Official pricing date shown in the price table. Update with the tables above. */
    const PRICING_DATE = '2026-11-21'



    const zh = {
      view: {
        label: '使用量轨迹',
        title: '使用量轨迹',
        subtitle: '按轮次记录当前会话的 Token、缓存命中、费用、耗时与高峰时段',
        emptyTitle: '当前会话还没有对话记录',
        emptyHint: '开始一轮对话后，这里会按轮次记录用量和时间。',
        note: '费用按 DeepSeek 官方峰谷价估算；缓存命中率按输入 Token 计算，进度条百分比也按本轮输入 Token 计算，实际以平台账单为准。',
      },
      overview: {
        label: '用量总览',
        title: '用量总览',
        subtitle: '今日、本月和全部用量的清晰汇总',
        today: '今日',
        month: '本月',
        all: '全部',
        last7: '近 7 天',
        last30: '近 30 天',
        last90: '近 90 天',
        custom: '自定义',
        moreRanges: '更多范围',
        range: '范围',
        startDate: '开始日期',
        endDate: '结束日期',
        filterWorkspace: '工作区',
        filterModel: '模型',
        allWorkspaces: '全部工作区',
        allModels: '全部模型',
        exportCsv: '导出 CSV',
        exportCsvHint: 'CSV 是逗号分隔的表格文件，可用 Excel、WPS 或 Numbers 打开。',
        exportExcel: '导出 Excel',
        exportExcelHint: 'Excel 文件已预设列宽，适合直接用 WPS/Excel 查看和筛选。',
        pricingTable: '价格表',
        pricingHint: '按 USD/CNY 每百万 Token 填写 input、cached、cacheWrite、output；保存后只影响之后的新报价。',
        pricingViewHint: '只读预览；价格单位为每百万 Token。DeepSeek 官方价格单独列出，第三方表只显示有参考价的模型，本地模型不计费。点击“恢复默认”右侧的“编辑”修改 JSON。',
        pricingCatalogNote: 'DeepSeek 官方按 CNY / 百万 Token 单列；下方第三方表只列出有参考价的模型；本地模型不计费。',
        pricingModel: '模型',
        pricingCurrency: '币种',
        pricingInput: '输入',
        pricingCached: '缓存命中',
        pricingWrite: '缓存写入',
        pricingOutput: '输出',
        edit: '编辑',
        save: '保存',
        reset: '恢复默认',
        cancel: '取消',
        invalidPricing: 'JSON 格式或字段不完整，需要 provider/model/currency/input/output。',
        totalTokens: '总 Token',
        deepseekCost: 'DeepSeek 消费',
        thirdCost: '第三方 API 消费',
        turns: '轮次',
        local: '本地',
        free: '免费',
        paid: '付费',
        trend: 'Token 趋势',
        trendHint: '按 Token 展示，费用按币种分别汇总',
        official: 'DeepSeek 官方',
        third: '第三方 API',
        noData: '暂无用量数据',
        noDataHint: '开始对话后，这里会自动汇总所有会话。',
        footnote: '费用为估算：DeepSeek 按官方峰谷价，第三方按参考价格表；实际以平台账单为准。',
        allSessions: '所有会话',
        workspaces: '工作区',
        workspaceHint: '按工作区实时汇总 · 当前范围',
        workspaceCount: '个工作区',
        workspaceSessions: '个对话窗口',
        workspaceTokens: 'Token',
        workspaceOfficial: 'DeepSeek',
        workspaceThird: '第三方',
        workspaceTurns: '轮次',
        workspaceLocal: '本地',
        tokenComposition: 'Token 构成',
        tokenCompositionHint: '输入、缓存命中、缓存写入与输出',
        cacheHit: '缓存命中率',
        avgPerTurn: '平均每轮',
        input: '输入',
        output: '输出',
        cacheRead: '缓存命中',
        cacheWrite: '缓存写入',
        models: '模型详情',
        modelsHint: '按模型汇总当前范围 · 含费用和轮次',
        unknownModel: '未知模型',
        model: '模型',
        modelCount: '个模型',
        category: '类型',
        share: '占比',
        cost: '费用',
        turns: '轮次',
        close: '关闭',
      },
      summary: { turns: '轮次', tokens: '总 Token', cost: '累计费用' },
      workspace: {
        label: '工作区 · 付费模型',
        sessions: '个对话窗口',
        tokens: '总 Token',
        cost: '总消费',
        turns: '总轮次',
        local: '本地',
        free: '不计费',
        average: '当前窗口平均缓存命中率',
        ungrouped: '未分组',
        default: '默认工作区',
        scope: '全部对话',
      },
      current: {
        label: '当前窗口 · 付费模型',
        average: '当前窗口平均缓存命中率',
        scope: '当前对话',
      },

      split: {
        title: '模型用量拆分',
        subtitle: '本地模型不计入付费总览；第三方付费 API 计入总览并单独列出',
        local: '本地模型 · 不计费',
        third: '第三方付费 API · 计入总览',
        model: '模型',
        current: '当前窗口',
        workspace: '工作区',
        cost: '费用',
        tag: '归类',
        tokens: 'Token',
        turns: '轮次',
        free: '不计费',
        included: '计入总览',
        unknownCost: '费用以厂商账单为准',
        rules: '统计规则',
        rule1: 'DeepSeek 官方模型计入工作区/当前窗口总 Token、总消费和平均缓存命中率；费用按官方峰谷价估算。',
        rule2: '其他付费 API 的 Token、费用也计入工作区/当前窗口总量，同时在下方按 provider/model 单独列出；费用以厂商账单为准，没有可用价格时显示 --。',
        rule3: '本地模型单独统计，不计入总量、总费用和平均缓存命中率，也不扣 DeepSeek 余额；轮次明细仍保留本地 Token。',
        rule4: '模型拆分同时显示当前窗口和工作区：本地模型用于查看本地用量，第三方 API 用于查看各家 API 自己的用量和费用。',
        rule5: '总轮次包含本地轮次，旁边的“本地 N · 不计费”用于解释总量差异；空白新会话不计入工作区窗口数，价格表 Flash/Pro 只适用于 DeepSeek 官方模型。',
      },
      billing: {
        reference: '参考价',
        peak: '高峰',
        off: '空闲',
        flat: '无峰谷',
        flatPrice: '统一价',
        input: '输入',
        cached: '缓存',
        cacheWrite: '缓存写入',
        output: '输出',
        perM: '每 百万 Token',
        updated: '目录更新',
        unknown: '未收录该模型的官方参考价，费用以厂商账单为准',
        catalogRemote: '远程价格',
        catalogCache: '缓存价格',
        catalogBuiltin: '内置价格',
        catalogFailed: '远程获取失败',
      },
      price: {
        official: '官方价',
        title: '官方价格',
        version: '版本',
        model: '模型',
        peak: '高峰时价格',
        off: '空闲时价格',
        legend: '缓存 / 输入 / 输出',
        current: '当前',
        hit: '缓存',
        input: '输入',
        output: '输出',
        local: '本地模型',
        localNote: '无 DeepSeek 官方价格，费用以实际渠道为准',
        thirdParty: '第三方 API',
        thirdPartyNote: '费用以厂商账单为准；Token 已计入总计',
        perM: '每 百万 Token',
      },
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
      peak: { on: '高峰', off: '空闲', local: '本地', flat: '统一价', error: '出错' },
      metric: {
        hit: '命中缓存',
        miss: '未命中缓存',
        hitRate: '缓存命中率',
        share: '占输入',
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
        peak: '高峰时段',
        offPeak: '空闲时段',
        input: '输入',
        output: '输出',
        localModel: '本地模型',
        localFree: '不消耗余额',
        thirdParty: '第三方 API',
        vendorBill: '费用以厂商账单为准',
        unifiedPrice: '统一价格',
        thirdNote: '第三方 API 实际消费以官网为准，插件仅按参考价计算，不保证 100% 准确。',
        perM: '/ 百万 Token',
      },
      config: {
        title: '功能开关',
        subtitle: '两个功能相互独立，可以单独开启或关闭。',
        balanceCard: '余额卡片',
        balanceCardHint: '在对话框左侧显示余额、上一轮/本轮消费、当前时段价格和会话统计，并隐藏对话框底部的原生统计行。',
        usageTrajectory: '使用量轨迹',
        usageTrajectoryHint: '在会话顶部显示“使用量轨迹”页签；首次启用或重新启用时会在后台收集所有对话窗口的完整轮次。',
        usageOverview: '用量总览',
        usageOverviewHint: '显示独立的“用量总览”页签，汇总今日、本月和全部用量趋势。',
        note: '三个开关相互独立；关闭余额卡片会恢复原生统计行，关闭使用量轨迹不影响余额卡片和用量总览。',
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
        note: 'Cost is estimated from DeepSeek official peak/off-peak pricing. Cache hit rate and bar percentages both use this turn’s input tokens. The platform bill is authoritative.',
      },
      overview: {
        label: 'Usage overview',
        title: 'Usage overview',
        subtitle: 'A clean view of today, this month, and all-time usage',
        today: 'Today',
        month: 'This month',
        all: 'All time',
        last7: 'Last 7 days',
        last30: 'Last 30 days',
        last90: 'Last 90 days',
        custom: 'Custom',
        moreRanges: 'More ranges',
        range: 'Range',
        startDate: 'Start date',
        endDate: 'End date',
        filterWorkspace: 'Workspace',
        filterModel: 'Model',
        allWorkspaces: 'All workspaces',
        allModels: 'All models',
        exportCsv: 'Export CSV',
        exportCsvHint: 'CSV is a comma-separated table file; open it with Excel, WPS, or Numbers.',
        exportExcel: 'Export Excel',
        exportExcelHint: 'Excel export includes preset column widths for direct viewing and filtering.',
        pricingTable: 'Pricing',
        pricingHint: 'USD/CNY per million tokens: input, cached, cacheWrite, output. Saves affect future quotes only.',
        pricingViewHint: 'Read-only preview; prices are per million tokens. DeepSeek official prices are listed separately; the third-party table includes only priced models, and local models are free. Use Edit to the right of Reset to change the JSON.',
        pricingCatalogNote: 'DeepSeek official prices are CNY per million tokens; the table below lists third-party models with a reference price, and local models are free.',
        pricingModel: 'Model',
        pricingCurrency: 'Currency',
        pricingInput: 'Input',
        pricingCached: 'Cached',
        pricingWrite: 'Cache write',
        pricingOutput: 'Output',
        edit: 'Edit',
        save: 'Save',
        reset: 'Reset',
        cancel: 'Cancel',
        invalidPricing: 'Invalid JSON or missing provider/model/currency/input/output.',
        totalTokens: 'Total tokens',
        deepseekCost: 'DeepSeek spend',
        thirdCost: 'Third-party spend',
        turns: 'Turns',
        local: 'Local',
        free: 'free',
        paid: 'paid',
        trend: 'Token trend',
        trendHint: 'Tokens are charted; costs stay separated by currency',
        official: 'DeepSeek official',
        third: 'Third-party API',
        noData: 'No usage data yet',
        noDataHint: 'Start a conversation and all Sessions will be summarized here.',
        footnote: 'Costs are estimates: DeepSeek uses official peak/off-peak prices, third parties use the reference catalog. The platform bill is authoritative.',
        allSessions: 'All Sessions',
        workspaces: 'Workspaces',
        workspaceHint: 'Live totals by workspace · current range',
        workspaceCount: 'workspaces',
        workspaceSessions: 'sessions',
        workspaceTokens: 'Tokens',
        workspaceOfficial: 'DeepSeek',
        workspaceThird: 'Third-party',
        workspaceTurns: 'Turns',
        workspaceLocal: 'Local',
        tokenComposition: 'Token composition',
        tokenCompositionHint: 'Input, cache hits, cache writes, and output',
        cacheHit: 'Cache hit rate',
        avgPerTurn: 'Average per turn',
        input: 'Input',
        output: 'Output',
        cacheRead: 'Cache read',
        cacheWrite: 'Cache write',
        models: 'Model details',
        modelsHint: 'Totals by model for the current range, including cost and turns',
        unknownModel: 'Unknown model',
        model: 'Model',
        modelCount: 'models',
        category: 'Type',
        share: 'Share',
        cost: 'Cost',
        turns: 'Turns',
        close: 'Close',
      },
      summary: { turns: 'Turns', tokens: 'Total tokens', cost: 'Total cost' },
      workspace: {
        label: 'Workspace · paid models',
        sessions: 'sessions',
        tokens: 'Total tokens',
        cost: 'Total cost',
        turns: 'Total turns',
        local: 'Local',
        free: 'free',
        average: 'Current session avg cache hit',
        ungrouped: 'Ungrouped',
        default: 'Default workspace',
        scope: 'All conversations',
      },
      current: {
        label: 'Current window · paid models',
        average: 'Current window avg cache hit',
        scope: 'Current conversation',
      },

      split: {
        title: 'Model usage split',
        subtitle: 'Local models are excluded from paid totals; third-party paid APIs are included and listed separately',
        local: 'Local models · free',
        third: 'Third-party paid APIs · included in totals',
        model: 'Model',
        current: 'Current window',
        workspace: 'Workspace',
        cost: 'Cost',
        tag: 'Category',
        tokens: 'tokens',
        turns: 'turns',
        free: 'free',
        included: 'in totals',
        unknownCost: 'Billing follows the provider',
        rules: 'Statistics rules',
        rule1: 'DeepSeek official models count toward workspace/current-window tokens, cost, and average cache hit rate; cost uses official peak/off-peak prices.',
        rule2: 'Other paid APIs also count toward workspace/current-window totals and are listed separately by provider/model below; billing follows the provider, and cost shows -- when no price is available.',
        rule3: 'Local models are counted separately, excluded from totals/cost/average cache, and never charged to the DeepSeek balance; their per-turn tokens remain in the ledger.',
        rule4: 'The split shows both the current window and the workspace: local rows show local usage, while third-party rows show each vendor’s own usage and cost.',
        rule5: 'Total turns include local turns; the “Local N · free” chip explains the difference. Blank new Sessions are excluded from the workspace window count, and Flash/Pro prices apply only to DeepSeek official models.',
      },
      billing: {
        reference: 'reference',
        peak: 'Peak',
        off: 'Off-peak',
        flat: 'flat',
        flatPrice: 'Flat price',
        input: 'Input',
        cached: 'Cached',
        cacheWrite: 'Cache write',
        output: 'Output',
        perM: 'per 1M tokens',
        updated: 'catalog',
        unknown: 'No reference price for this model; billing follows the provider',
        catalogRemote: 'Remote pricing',
        catalogCache: 'Cached pricing',
        catalogBuiltin: 'Built-in pricing',
        catalogFailed: 'remote fetch failed',
      },
      price: {
        official: 'Official price',
        title: 'Official pricing',
        version: 'Version',
        model: 'Model',
        peak: 'Peak price',
        off: 'Off-peak price',
        legend: 'Cache / Input / Output',
        current: 'Current',
        hit: 'Cache',
        input: 'Input',
        output: 'Output',
        local: 'Local model',
        localNote: 'No official DeepSeek price; billing follows the local route',
        thirdParty: 'Third-party API',
        thirdPartyNote: 'Billing follows the provider; tokens are included in totals',
        perM: 'per 1M tokens',
      },
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
      peak: { on: 'Peak', off: 'Off-peak', local: 'Local', flat: 'Flat price', error: 'Error' },
      metric: {
        hit: 'Cache hit',
        miss: 'Cache miss',
        hitRate: 'Cache hit rate',
        share: 'of input',
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
        peak: 'Peak hours',
        offPeak: 'Off-peak',
        input: 'Input',
        output: 'Output',
        localModel: 'Local model',
        localFree: 'No balance charge',
        thirdParty: 'Third-party API',
        vendorBill: 'Billing follows the provider',
        unifiedPrice: 'Flat price',
        thirdNote: 'Actual third-party charges follow the vendor bill; this card only estimates from reference prices and may not be exact.',
        perM: '/ 1M tokens',
      },
      config: {
        title: 'Feature switches',
        subtitle: 'The two features are independent; each can be switched separately.',
        balanceCard: 'Balance card',
        balanceCardHint: 'Show balance, previous/current-turn spend, current-window price, and Session stats left of the input card, and hide the composer statistics row.',
        usageTrajectory: 'Usage trajectory',
        usageTrajectoryHint: 'Show the Usage trajectory tab; when first enabled or re-enabled it collects every Session’s complete turn history in the background.',
        usageOverview: 'Usage overview',
        usageOverviewHint: 'Show a separate Usage overview tab with today, this month, and all-time trends.',
        note: 'The three switches are independent; turning off Balance card restores the native statistics row, and Usage trajectory does not affect the card or the overview.',
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
  position: relative !important;
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
/* A two-line composer: the card and this input share one measured height. */
[data-dsub-side-card] [data-composer-card] {
  min-height: 108px !important;
}
[data-dsub-side-card] [data-composer-card] textarea,
[data-dsub-side-card] [data-composer-card] [contenteditable="true"] {
  min-height: 48px !important;
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
  gap: 1px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-panel);
  background: var(--dsw-specific-input-major);
  box-shadow: var(--dsw-elevation-soft);
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  z-index: 1;
  opacity: 1;
  animation: dsub-side-fade-in .18s ease both;
  transition: opacity .16s ease;
}
.dsub-side-card[data-closing="true"] { opacity: 0; }
.dsub-side-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1px 2px; min-width: 0; }
.dsub-side-balance { display: flex; align-items: baseline; gap: 3px; min-width: 0; flex: 1 0 100%; }
.dsub-side-label { color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 16px; letter-spacing: .01em; white-space: nowrap; }
.dsub-side-amount {
  font-size: 12.5px; line-height: 16px; font-weight: 700;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.dsub-side-amount[data-tone="danger"] { color: var(--dsw-alias-state-error-primary); }
.dsub-side-amount[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dsub-side-amount[data-tone="ok"] { color: #3b82f6; }
.dsub-side-amount[data-tone="unknown"] { color: var(--dsw-alias-label-secondary); }
.dsub-side-amount[data-failed="true"] { opacity: .75; }
.dsub-side-costs { display: flex; align-items: flex-end; justify-content: flex-start; gap: 3px; margin-left: 0; margin-bottom: 4px; min-width: 0; width: 100%; }
.dsub-side-cost { display: flex; align-items: baseline; gap: 2px; color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 16px; white-space: nowrap; }
.dsub-side-cost b { color: #f87171; font-size: 12.5px; line-height: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-current { margin-left: auto; }
.dsub-side-status { display: inline-flex; align-items: center; gap: 3px; font-size: 12.5px; line-height: 16px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.dsub-side-status[data-state="running"] { color: #eab308; }
.dsub-side-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dsw-alias-brand-primary); flex: none; }
.dsub-side-status[data-state="running"] .dsub-side-status-dot { background: #eab308; animation: dsub-pulse 1.2s ease-in-out infinite; }
.dsub-side-status[data-state="interrupted"] .dsub-side-status-dot,
.dsub-side-status[data-state="error"] .dsub-side-status-dot { background: var(--dsw-alias-state-error-primary); }
.dsub-side-status[data-state="blocked"] .dsub-side-status-dot,
.dsub-side-status[data-state="maxTokens"] .dsub-side-status-dot { background: var(--dsw-alias-state-warn-primary); }
.dsub-side-window { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 16px; }
.dsub-side-window-state { display: inline-flex; align-items: center; gap: 4px; min-width: 0; font-weight: 600; line-height: 16px; white-space: nowrap; }
.dsub-side-window-state[data-peak="true"] { color: #ef4444; }
.dsub-side-window-state[data-peak="false"] { color: #2dd4bf; }
.dsub-side-window-state[data-local="true"] { color: #a78bfa; }
.dsub-side-window-state[data-external="true"] { color: #60a5fa; }
.dsub-side-window-state[data-flat="true"] { color: #fbbf24; }
.dsub-side-window-dot { width: 6px; height: 6px; border-radius: 50%; background: #2dd4bf; flex: none; }
.dsub-side-window-state[data-peak="true"] .dsub-side-window-dot { background: #ef4444; }
.dsub-side-window-state[data-local="true"] .dsub-side-window-dot { background: #a78bfa; }
.dsub-side-window-state[data-external="true"] .dsub-side-window-dot { background: #60a5fa; }
.dsub-side-window-state[data-flat="true"] .dsub-side-window-dot { background: #fbbf24; }
.dsub-side-window-local .dsub-side-window-price { color: #c4b5fd; }
.dsub-side-window-third .dsub-side-window-price b { color: #fbbf24; }
.dsub-side-window-price { display: flex; flex-direction: column; align-items: flex-end; gap: 0; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 16px; font-variant-numeric: tabular-nums; }
.dsub-side-window-price-line { white-space: nowrap; }
.dsub-side-window-price b { color: #3b82f6; font-weight: 650; }
.dsub-side-third-note {
  margin-top: 2px; padding-top: 3px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary);
  font-size: 9.5px; line-height: 12px;
}
.dsub-side-stats { display: flex; flex-wrap: wrap; gap: 0 5px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 15px; font-variant-numeric: tabular-nums; }
.dsub-side-stats b { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dsub-side-bottom { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dsub-side-cache { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dsub-side-cache-top { display: flex; align-items: baseline; justify-content: space-between; gap: 5px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 15px; }
.dsub-side-cache-top b { color: var(--dsw-alias-label-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-bar {
  height: 7px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 3px;
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}
.dsub-side-bar > span { display: block; width: 0; height: 100%; border-radius: 2px; background: #2563eb; transition: width .6s cubic-bezier(.2, .8, .2, 1); }
.dsub-side-bar.is-inview > span { width: var(--dsub-fill, 0%); }
.dsub-side-context { flex: none; display: flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; }
.dsub-side-context b { display: block; color: var(--dsw-alias-label-primary); font-size: 12.5px; line-height: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.dsub-side-donut { display: block; flex: none; }
.dsub-side-donut .dsub-donut-track { stroke: var(--dsw-alias-bg-base); }
.dsub-side-donut .dsub-donut-fill { stroke: #2563eb; transition: stroke-dasharray .2s ease, stroke .2s ease; }
.dsub-side-donut .dsub-donut-fill[data-tone="warn"] { stroke: #f59e0b; }
.dsub-side-donut .dsub-donut-fill[data-tone="danger"] { stroke: #ef4444; }

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
  padding: 18px 0 14px;
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
.dsub-workspace {
  flex: none;
  display: flex; flex-direction: column; gap: 9px;
  margin: 12px 0 0; padding: 12px 14px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-workspace-card {
  border: 1px solid rgba(96, 165, 250, .30);
  background: rgba(59, 130, 246, .12);
}
.dsub-current-card {
  margin-top: 8px; margin-bottom: 12px;
  border: 1px solid rgba(167, 139, 250, .30);
  background: rgba(139, 92, 246, .12);
}
.dsub-scope {
  display: inline-flex; align-items: center;
  padding: 1px 6px; border-radius: 999px;
  background: rgba(59, 130, 246, .16);
  color: #93c5fd;
  font-size: 10.5px; line-height: 15px; font-weight: 650;
  white-space: nowrap;
}
.dsub-scope-current { background: rgba(167, 139, 250, .18); color: #c4b5fd; }
.dsub-workspace-card .dsub-workspace-title,
.dsub-workspace-card .dsub-workspace-title span,
.dsub-workspace-card .dsub-workspace-title em,
.dsub-workspace-card .dsub-workspace-chip span { color: #93c5fd; }
.dsub-workspace-card .dsub-workspace-title b,
.dsub-workspace-card .dsub-workspace-chip b { color: #60a5fa; }
.dsub-workspace-card .dsub-workspace-chip { border-color: rgba(96, 165, 250, .35); background: rgba(59, 130, 246, .08); }
.dsub-current-card .dsub-workspace-title,
.dsub-current-card .dsub-workspace-title span,
.dsub-current-card .dsub-workspace-title em,
.dsub-current-card .dsub-workspace-chip span,
.dsub-current-card .dsub-workspace-current { color: #c4b5fd; }
.dsub-current-card .dsub-workspace-chip b,
.dsub-current-card .dsub-workspace-current b { color: #a78bfa; }
.dsub-current-card .dsub-workspace-chip { border-color: rgba(167, 139, 250, .35); background: rgba(139, 92, 246, .08); }
.dsub-current-card .dsub-workspace-current { border-top-color: rgba(167, 139, 250, .28); }
.dsub-model-split {
  margin: 12px 0 0; padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-split-head h3 { margin: 0; font-size: 16px; line-height: 21px; font-weight: 650; }
.dsub-split-head p { margin: 2px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 18px; }
.dsub-split-group { margin-top: 10px; }
.dsub-split-group h4 { margin: 0 0 3px; font-size: 13px; line-height: 18px; font-weight: 650; }
.dsub-split-local-title { color: #a78bfa; }
.dsub-split-third-title { color: #60a5fa; }
.dsub-split-row {
  display: grid;
  grid-template-columns: minmax(160px, 1.25fr) minmax(190px, 1fr) minmax(190px, 1fr) auto;
  align-items: baseline; gap: 9px;
  padding: 5px 0;
  border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 13.5px; line-height: 18px;
}
.dsub-split-header {
  border-top: 0;
  padding-top: 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px; line-height: 16px; font-weight: 600;
}
.dsub-split-billing {
  margin: -1px 0 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px; line-height: 17px;
}
.dsub-split-name { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.dsub-split-row[data-local="true"] .dsub-split-name { color: #a78bfa; }
.dsub-split-row[data-local="false"] .dsub-split-name { color: #60a5fa; }
.dsub-split-metric { color: var(--dsw-alias-label-secondary); white-space: normal; font-variant-numeric: tabular-nums; }
.dsub-split-cost { color: var(--dsw-alias-label-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dsub-split-row[data-local="false"] .dsub-split-cost { color: #60a5fa; }
.dsub-split-included {
  padding: 1px 6px; border-radius: 999px;
  background: rgba(59, 130, 246, .12); color: #93c5fd;
  font-size: 11px; line-height: 15px; font-style: normal; white-space: nowrap;
}
.dsub-rules { margin-top: 9px; padding-top: 7px; border-top: 1px solid var(--dsw-alias-border-l1); }
.dsub-rules summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 17px; font-weight: 600; }
.dsub-rules ul { margin: 6px 0 0; padding-left: 17px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 17px; }
.dsub-rules li + li { margin-top: 2px; }
.dsub-workspace-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 9px 16px; min-width: 0; }
.dsub-workspace-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 7px; min-width: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 17px; }
.dsub-workspace-title b { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 19px; font-weight: 650; }
.dsub-workspace-title em { color: var(--dsw-alias-label-tertiary); font-size: 11.5px; font-style: normal; line-height: 16px; white-space: nowrap; }
.dsub-workspace-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-left: auto; }
.dsub-workspace-chip {
  display: inline-flex; align-items: baseline; gap: 5px;
  padding: 3px 9px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 16px; white-space: nowrap;
}
.dsub-workspace-chip b { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-local-chip { border-color: rgba(167, 139, 250, .35); background: rgba(139, 92, 246, .10); }
.dsub-local-chip span,
.dsub-local-chip em { color: #c4b5fd; }
.dsub-local-chip b { color: #a78bfa; }
.dsub-workspace-current {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 16px;
}
.dsub-workspace-current b { color: #2563eb; font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-current-card .dsub-workspace-current b { color: #a78bfa; }
.dsub-sticky-head {
  position: sticky; top: 0; z-index: 3;
  background: var(--dsw-alias-bg-layer-1);
}
.dsub-price-table {
  padding: 9px 12px 8px;
  background: var(--dsw-alias-bg-layer-1);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 13.5px; line-height: 19px;
}
.dsub-price-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 5px; }
.dsub-price-official {
  padding: 1px 6px; border-radius: 999px;
  border: 1px solid rgba(96, 165, 250, .3);
  color: #93c5fd;
  font-size: 11.5px; line-height: 16px; white-space: nowrap;
}
.dsub-price-version { margin-left: 8px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 17px; white-space: nowrap; }
.dsub-price-catalog { margin-left: auto; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; white-space: nowrap; }
.dsub-price-grid {
  display: grid; grid-template-columns: 84px minmax(0, 1fr) minmax(0, 1fr);
  align-items: center; gap: 12px;
  padding: 3px 4px; border-radius: 4px;
}
.dsub-price-grid-head { color: var(--dsw-alias-label-tertiary); font-size: 12.5px; font-weight: 600; letter-spacing: .02em; }
.dsub-price-grid[data-current="true"] { background: rgba(59, 130, 246, .08); }
.dsub-price-grid-foot { padding-top: 2px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 17px; }
.dsub-price-foot { white-space: nowrap; }
.dsub-price-local {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px;
  margin-top: 6px; padding: 6px 4px 0;
  border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 13px; line-height: 18px;
}
.dsub-price-local-label { color: var(--dsw-alias-label-tertiary); }
.dsub-price-local-name { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; color: #a78bfa; font-weight: 650; }
.dsub-price-local-current {
  padding: 0 5px; border-radius: 999px;
  background: rgba(139, 92, 246, .16); color: #c4b5fd;
  font-size: 11px; line-height: 15px; font-style: normal;
}
.dsub-price-local-note { color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.dsub-price-model { color: #60a5fa; font-weight: 650; white-space: nowrap; }
.dsub-price-model em {
  margin-left: 4px; padding: 0 5px; border-radius: 999px;
  background: rgba(59, 130, 246, .16); color: #93c5fd;
  font-size: 11px; line-height: 15px; font-style: normal;
}
.dsub-price-cell { display: flex; align-items: baseline; gap: 1px; min-width: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
.dsub-price-cell b { color: #60a5fa; font-weight: 650; }
.dsub-price-cell i { color: var(--dsw-alias-label-tertiary); font-style: normal; }
.dsub-price-legend { margin-top: 4px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 17px; }
.dsub-scroll {
  flex: 1 1 auto; min-height: 0; overflow: auto;
  padding: 0 24px calc(var(--dsh-composer-height, 152px) + 22px);
  box-sizing: border-box;
}
.dsub-table { min-width: 0; }
.dsub-model-icon { display: block; width: 16px; height: 16px; flex: none; }
.dsub-model-name { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; vertical-align: middle; }
.dsub-model-name-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsub-model-picker { position: relative; width: 100%; min-width: 0; }
.dsub-model-picker-trigger {
  display: flex; align-items: center; gap: 8px;
  width: 100%; height: 36px; box-sizing: border-box;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer; text-align: left;
}
.dsub-model-picker-trigger:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsub-model-picker-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsub-model-picker-chevron { width: 14px; height: 14px; flex: none; color: var(--dsw-alias-label-tertiary); }
.dsub-model-picker-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
  width: 100%; max-height: 300px; overflow: hidden auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft);
}
.dsub-model-picker-option {
  display: flex; align-items: center; gap: 8px;
  width: 100%; min-height: 36px; box-sizing: border-box;
  padding: 6px 8px;
  border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; text-align: left; cursor: pointer;
}
.dsub-model-picker-option:hover, .dsub-model-picker-option[data-selected="true"] { background: var(--dsw-alias-bg-layer-2); }
.dsub-model-picker-option > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsub-model-picker-option-text { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.dsub-model-picker-option-text b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 17px; font-weight: 600; }
.dsub-model-picker-option-text small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 15px; }
.dsub-model-picker-check { flex: none; color: #60a5fa; font-size: 13px; }
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
  position: static;
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
.dsub-turn-no span { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; }
.dsub-local-tag {
  align-self: flex-start;
  padding: 0 4px; border-radius: 999px;
  background: rgba(139, 92, 246, .16); color: #c4b5fd;
  font-size: 10px; line-height: 14px; font-style: normal;
}
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
.dsub-peak[data-local="true"] { color: #a78bfa; background: rgba(139,92,246,.12); border: 1px solid rgba(167,139,250,.26); }
.dsub-peak[data-flat="true"] { color: #fbbf24; background: rgba(245,158,11,.13); border: 1px solid rgba(245,158,11,.28); }
.dsub-peak[data-error="true"] { color: #dc2626; background: rgba(220,38,38,.13); border: 1px solid rgba(220,38,38,.24); }
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
.dsub-bar > span { display: block; height: 100%; border-radius: 3px; transform: scaleX(0); transform-origin: left center; transition: transform .42s cubic-bezier(.2, .8, .2, 1); will-change: transform; }
.dsub-bar.is-inview > span { transform: scaleX(1); }
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
.dsub-view.dsub-overview-page {
  position: absolute;
  inset: 0;
  height: auto;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
}
.dsub-overview-scroll {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-y: scroll;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 0 24px calc(var(--dsh-composer-height, 152px) + 24px);
}
.dsub-reveal-card {
  opacity: 0;
  transform: translateY(7px);
  transition: opacity .24s ease, transform .24s cubic-bezier(.2, .8, .2, 1);
}
.dsub-reveal-card.is-inview { opacity: 1; transform: translateY(0); }
.dsub-overview-stat,
.dsub-overview-workspace,
.dsub-overview-chart,
.dsub-overview-composition,
.dsub-overview-models {
  transition: border-color .16s ease, box-shadow .16s ease;
}
.dsub-overview-stat:hover,
.dsub-overview-workspace:hover { border-color: var(--dsw-alias-border-l2); }
.dsub-overview {
  box-sizing: border-box;
  min-height: 0;
  padding: 26px 4px 10px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 14px; line-height: 20px;
}
.dsub-overview-head {
  max-width: 1120px; margin: 0 auto 18px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 18px;
}
.dsub-overview-title h2 { margin: 0; font-size: 27px; line-height: 34px; font-weight: 650; letter-spacing: .01em; }
.dsub-overview-title p { margin: 5px 0 0; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 20px; }
.dsub-overview-range {
  display: inline-flex; flex: none; gap: 3px; padding: 4px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-range-button {
  padding: 6px 15px; border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer;
  transition: color .15s ease, background-color .15s ease;
}
.dsub-overview-range-button[data-active="true"] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 1px 2px rgba(0,0,0,.18);
}
.dsub-overview-range-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsub-overview-range-select {
  max-width: 120px;
  padding: 5px 7px;
  border: 0; border-left: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dsub-overview-filterbar {
  max-width: 1120px; margin: -6px auto 16px;
  display: flex; flex-wrap: wrap; align-items: end; gap: 10px;
}
.dsub-overview-context {
  flex: 1 1 100%;
  display: flex; flex-wrap: wrap; align-items: end; gap: 14px;
  box-sizing: border-box;
  padding: 11px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsub-overview-context-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.dsub-overview-filterbar .dsub-overview-context-field > span {
  color: var(--dsw-alias-label-primary);
  font-size: 13.5px; line-height: 18px; font-weight: 650;
}
.dsub-overview-context-workspace { flex: 0 0 220px; }
.dsub-overview-context-model { flex: 0 0 420px; }
.dsub-overview-filterbar .dsub-overview-context select {
  width: 100%; min-width: 0; height: 36px;
  box-sizing: border-box;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 14px; font-weight: 600;
  text-overflow: ellipsis;
}
.dsub-overview-context select:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsub-overview-filterbar label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dsub-overview-filterbar label > span {
  color: var(--dsw-alias-label-primary);
  font-size: 13.5px; line-height: 18px; font-weight: 650;
}
.dsub-overview-filterbar select,
.dsub-overview-filterbar input {
  height: 30px; min-width: 132px; box-sizing: border-box;
  padding: 3px 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px;
}
.dsub-overview-filterbar input { min-width: 132px; }
.dsub-overview-export {
  height: 30px; margin-left: auto; padding: 3px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dsub-overview-pricing-button {
  height: 30px; margin-left: auto; padding: 3px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dsub-overview-pricing-edit {
  height: 30px; padding: 3px 12px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dsub-overview-pricing-edit:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsub-overview-pricing-button:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dsub-overview-export { margin-left: 0; }
.dsub-overview-export:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dsub-overview-export:disabled { opacity: .45; cursor: default; }
.dsub-overview-grid {
  max-width: 1120px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px;
}
.dsub-overview-stat {
  min-height: 108px; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 5px;
  padding: 16px 18px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-stat span { color: var(--dsw-alias-label-primary); font-size: 17px; line-height: 22px; font-weight: 650; }
.dsub-overview-stat b { color: var(--dsw-alias-label-primary); font-size: 24px; line-height: 30px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-stat small { margin-top: auto; color: var(--dsw-alias-label-tertiary); font-size: 12.5px; line-height: 17px; }
.dsub-overview-chart {
  max-width: 1120px; margin: 18px auto 0;
  padding: 18px 20px 14px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-workspaces { max-width: 1120px; margin: 18px auto 0; }
.dsub-overview-composition { max-width: 1120px; margin: 18px auto 0; }
.dsub-overview-composition-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.dsub-overview-composition-meta span {
  padding: 4px 9px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums;
}
.dsub-overview-composition-bar {
  display: flex; width: 100%; height: 12px; margin-top: 2px;
  overflow: hidden; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-composition-bar span { display: block; width: var(--dsub-fill, 0%); height: 100%; min-width: 0; transform: scaleX(0); transform-origin: left center; transition: transform .48s cubic-bezier(.2, .8, .2, 1); will-change: transform; }
.dsub-overview-composition-bar span.is-inview { transform: scaleX(1); }
.dsub-overview-composition-bar span[data-kind="input"] { background: #60a5fa; }
.dsub-overview-composition-bar span[data-kind="cacheRead"] { background: #34d399; }
.dsub-overview-composition-bar span[data-kind="cacheWrite"] { background: #fbbf24; }
.dsub-overview-composition-bar span[data-kind="output"] { background: #c084fc; }
.dsub-overview-composition-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.dsub-overview-composition-item {
  display: grid; grid-template-columns: 1fr auto; gap: 3px 8px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-composition-item span { grid-column: 1 / -1; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; }
.dsub-overview-composition-item strong { color: var(--dsw-alias-label-primary); font-size: 16px; line-height: 21px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-composition-item em { align-self: end; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 17px; font-style: normal; font-variant-numeric: tabular-nums; }
.dsub-overview-models { max-width: 1120px; margin: 18px auto 0; }
.dsub-overview-model-table {
  overflow: hidden auto; max-height: 360px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-model-row {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) 104px 104px 64px 122px 54px;
  align-items: center; gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsub-overview-model-row:first-child { border-top: 0; }
.dsub-overview-model-head {
  position: sticky; top: 0; z-index: 1;
  border-top: 0; background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary); font-size: 11.5px; line-height: 16px;
}
.dsub-overview-model-head span:nth-child(n+3) { justify-self: end; text-align: right; }
.dsub-overview-model-row:not(.dsub-overview-model-head):hover { background: rgba(255, 255, 255, .035); }
.dsub-overview-model-name { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dsub-overview-model-name b { display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); font-size: 13.5px; line-height: 18px; font-weight: 600; }
.dsub-overview-model-name small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 11.5px; line-height: 15px; }
.dsub-overview-model-badge { justify-self: start; padding: 2px 7px; border-radius: 999px; font-size: 11.5px; line-height: 16px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); }
.dsub-overview-model-badge[data-kind="official"] { color: #93c5fd; background: rgba(59,130,246,.12); }
.dsub-overview-model-badge[data-kind="third"] { color: #c4b5fd; background: rgba(167,139,250,.12); }
.dsub-overview-model-badge[data-kind="local"] { color: var(--dsw-alias-label-tertiary); background: rgba(100,116,139,.14); }
.dsub-overview-model-num { justify-self: end; color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 17px; font-variant-numeric: tabular-nums; text-align: right; }
.dsub-overview-model-cost { justify-self: end; color: var(--dsw-alias-label-primary); font-size: 12.5px; line-height: 17px; font-variant-numeric: tabular-nums; text-align: right; }
.dsub-overview-section-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  margin-bottom: 10px;
}
.dsub-overview-section-head h3 { margin: 0; font-size: 17px; line-height: 22px; font-weight: 650; }
.dsub-overview-section-head p { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 18px; }
.dsub-overview-section-head > span {
  flex: none; padding: 4px 9px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums;
}
.dsub-overview-workspace-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;
}
.dsub-overview-workspace {
  min-width: 0; box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-workspace-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.dsub-overview-workspace-head b {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-primary); font-size: 15px; line-height: 20px; font-weight: 650;
}
.dsub-overview-workspace-head em { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; font-style: normal; }
.dsub-overview-workspace-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; margin-top: 12px; }
.dsub-overview-workspace-metrics span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsub-overview-workspace-metrics i { color: var(--dsw-alias-label-tertiary); font-size: 11.5px; line-height: 15px; font-style: normal; }
.dsub-overview-workspace-metrics strong { color: var(--dsw-alias-label-primary); font-size: 14.5px; line-height: 19px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-workspace-local { display: block; margin-top: 9px; color: var(--dsw-alias-label-tertiary); font-size: 11.5px; line-height: 16px; }
.dsub-overview-chart-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  margin-bottom: 8px;
}
.dsub-overview-chart-head h3 { margin: 0; font-size: 17px; line-height: 22px; font-weight: 650; }
.dsub-overview-chart-head p { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 18px; }
.dsub-overview-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 17px; }
.dsub-overview-legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.dsub-overview-legend .dsub-model-icon { width: 14px; height: 14px; }
.dsub-overview-svg { display: block; width: 100%; height: auto; overflow: visible; }
.dsub-overview-plot { position: relative; }
.dsub-overview-grid-line { stroke: #2f3540; stroke-width: 1; }
.dsub-overview-y, .dsub-overview-x { fill: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.dsub-overview-bar-official, .dsub-overview-bar-third, .dsub-overview-bar-local, .dsub-overview-bar-warn, .dsub-overview-bar-danger {
  transform-box: fill-box;
  transform-origin: bottom;
  transform: scaleY(0);
  opacity: .45;
  animation: dsub-overview-rise .5s cubic-bezier(.2, .8, .2, 1) both;
  animation-play-state: paused;
}
.dsub-overview-bar-official.is-inview, .dsub-overview-bar-third.is-inview, .dsub-overview-bar-local.is-inview, .dsub-overview-bar-warn.is-inview, .dsub-overview-bar-danger.is-inview { animation-play-state: running; }
.dsub-overview-bar-official { fill: #3b82f6; }
.dsub-overview-bar-third { fill: #a78bfa; }
.dsub-overview-bar-local { fill: #64748b; }
.dsub-overview-bar-warn { fill: #f59e0b; }
.dsub-overview-bar-danger { fill: #ef4444; }
.dsub-overview-hover-bar {
  position: absolute; top: 0; z-index: 1;
  border-radius: 4px;
  background: rgba(255, 255, 255, .055);
  pointer-events: none;
  transition: left .06s linear, width .06s linear;
}
.dsub-overview-hit { fill: transparent; cursor: pointer; }
.dsub-overview-modal {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, .55);
  backdrop-filter: blur(2px);
  animation: dsub-overview-modal-in .16s ease both;
}
.dsub-overview-modal-panel {
  width: min(620px, 100%);
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 48px);
  min-width: 360px;
  min-height: 280px;
  box-sizing: border-box;
  overflow: auto;
  resize: both;
  padding: 24px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft);
  animation: dsub-overview-panel-in .2s cubic-bezier(.2, .8, .2, 1) both;
}
.dsub-pricing-panel { width: min(760px, 100%); }
.dsub-pricing-textarea {
  display: block; width: 100%; height: 360px; box-sizing: border-box;
  margin-top: 16px; padding: 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px; line-height: 18px; resize: vertical;
}
.dsub-pricing-error { margin: 8px 0 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 17px; }
.dsub-pricing-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 16px; }
.dsub-pricing-section-head b { color: var(--dsw-alias-label-primary); font-size: 16px; line-height: 21px; font-weight: 650; }
.dsub-pricing-section-head span { color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 18px; }
.dsub-pricing-section-head-third { margin-top: 18px; }
.dsub-pricing-official-table {
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-pricing-official-row {
  display: grid;
  grid-template-columns: 90px 80px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: center; gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary); font-size: 13.5px; line-height: 19px;
}
.dsub-pricing-official-row:first-child { border-top: 0; }
.dsub-pricing-official-head { border-top: 0; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-tertiary); font-size: 12.5px; }
.dsub-pricing-official-head span:nth-child(n+3) { justify-self: end; text-align: right; }
.dsub-pricing-official-model { color: var(--dsw-alias-label-primary); font-weight: 650; }
.dsub-pricing-table {
  max-height: 420px; margin-top: 16px;
  overflow: hidden auto;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-pricing-row {
  display: grid;
  grid-template-columns: minmax(180px, 2.2fr) 72px 72px 80px 80px 70px;
  align-items: center; gap: 10px;
  padding: 11px 12px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsub-pricing-row:first-child { border-top: 0; }
.dsub-pricing-row:not(.dsub-pricing-head):hover { background: rgba(255, 255, 255, .035); }
.dsub-pricing-head {
  position: sticky; top: 0; z-index: 1;
  border-top: 0; background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-tertiary); font-size: 12.5px; line-height: 17px;
}
.dsub-pricing-head span:nth-child(n+3) { justify-self: end; text-align: right; }
.dsub-pricing-model { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dsub-pricing-model b { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-primary); font-size: 15.5px; line-height: 20px; font-weight: 650; }
.dsub-pricing-model small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 12.5px; line-height: 16px; }
.dsub-pricing-currency { justify-self: center; padding: 2px 7px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 5px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 15px; }
.dsub-pricing-number { justify-self: end; color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 19px; font-variant-numeric: tabular-nums; text-align: right; }
.dsub-pricing-note { margin: 10px 0 0; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 19px; }
.dsub-pricing-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.dsub-pricing-actions button {
  height: 30px; padding: 3px 13px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dsub-pricing-actions button:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dsub-pricing-actions .dsub-pricing-save,
.dsub-pricing-actions .dsub-pricing-edit { color: #fff; background: #2563eb; border-color: #2563eb; }
.dsub-pricing-actions .dsub-pricing-save:hover,
.dsub-pricing-actions .dsub-pricing-edit:hover { color: #fff; background: #1d4ed8; border-color: #1d4ed8; }
.dsub-overview-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.dsub-overview-modal-head h3 { margin: 0; color: var(--dsw-alias-label-primary); font-size: 22px; line-height: 28px; font-weight: 650; }
.dsub-overview-modal-head p { margin: 5px 0 0; color: var(--dsw-alias-label-secondary); font-size: 15px; line-height: 21px; font-variant-numeric: tabular-nums; }
.dsub-overview-modal-close {
  flex: none; width: 32px; height: 32px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 21px; line-height: 28px; cursor: pointer;
}
.dsub-overview-ring-layout { display: flex; align-items: center; gap: 24px; margin-top: 22px; }
.dsub-overview-modal-models { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.dsub-overview-modal-model {
  display: inline-flex; align-items: center; gap: 6px; min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  font-size: 14px; line-height: 18px;
}
.dsub-overview-modal-model .dsub-model-icon { width: 18px; height: 18px; }
.dsub-overview-modal-model em { color: var(--dsw-alias-label-tertiary); font-style: normal; font-variant-numeric: tabular-nums; }
.dsub-overview-single-ring { position: relative; flex: none; width: 196px; height: 196px; }
.dsub-overview-single-ring svg { display: block; width: 196px; height: 196px; }
.dsub-overview-ring-track { fill: none; stroke: var(--dsw-alias-border-l2); stroke-width: 22; }
.dsub-overview-ring-fill { fill: none; stroke-width: 22; stroke-linecap: butt; transform: rotate(-90deg); transform-origin: 50% 50%; }
.dsub-overview-ring-reveal { transform: rotate(-90deg); transform-origin: 50% 50%; animation: dsub-overview-ring-progress .8s cubic-bezier(.2, .8, .2, 1) both; }
.dsub-overview-ring-fill[data-kind="official"] { stroke: #3b82f6; }
.dsub-overview-ring-fill[data-kind="third"] { stroke: #a78bfa; }
.dsub-overview-ring-fill[data-kind="local"] { stroke: #64748b; }
.dsub-overview-single-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; text-align: center; }
.dsub-overview-single-ring-center strong { color: var(--dsw-alias-label-primary); font-size: 28px; line-height: 34px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-single-ring-center small { color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 17px; }
.dsub-overview-ring-legend { flex: 1; display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.dsub-overview-ring-legend-row {
  display: flex; align-items: baseline; gap: 9px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
}
.dsub-overview-ring-legend-row .dsub-model-icon, .dsub-overview-ring-cost-row .dsub-model-icon { width: 18px; height: 18px; flex: none; }
.dsub-overview-ring-legend-row[data-kind="official"] i { background: #3b82f6; }
.dsub-overview-ring-legend-row[data-kind="third"] i { background: #a78bfa; }
.dsub-overview-ring-legend-row[data-kind="local"] i { background: #64748b; }
.dsub-overview-ring-legend-row span { flex: 1; color: var(--dsw-alias-label-secondary); font-size: 15px; line-height: 20px; }
.dsub-overview-ring-legend-row strong { color: var(--dsw-alias-label-primary); font-size: 22px; line-height: 27px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-ring-legend-row em { color: var(--dsw-alias-label-tertiary); font-size: 15px; line-height: 20px; font-style: normal; font-variant-numeric: tabular-nums; }
.dsub-overview-ring-costs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.dsub-overview-ring-cost-row { display: flex; align-items: center; gap: 7px; padding: 9px 11px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; background: var(--dsw-alias-bg-layer-2); }
.dsub-overview-ring-cost-row[data-kind="official"] i { background: #3b82f6; }
.dsub-overview-ring-cost-row[data-kind="third"] i { background: #a78bfa; }
.dsub-overview-ring-cost-row[data-kind="local"] i { background: #64748b; }
.dsub-overview-ring-cost-row span { flex: 1; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 19px; }
.dsub-overview-ring-cost-row b { color: var(--dsw-alias-label-primary); font-size: 16px; line-height: 20px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-modal-foot { margin: 18px 0 0; padding-top: 12px; border-top: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-tertiary); font-size: 12.5px; line-height: 18px; }
@media (max-width: 560px) { .dsub-overview-ring-layout { flex-direction: column; align-items: stretch; } .dsub-overview-single-ring { align-self: center; } .dsub-overview-ring-costs { grid-template-columns: 1fr; } }
.dsub-overview-tooltip {
  position: absolute; z-index: 2;
  display: flex; flex-direction: column; gap: 2px;
  min-width: 184px; max-width: 260px;
  padding: 8px 10px;
  transform: translateX(-50%);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-soft);
  pointer-events: none;
  transition: none;
}
.dsub-overview-tooltip b { color: var(--dsw-alias-label-secondary); font-size: 12.5px; line-height: 17px; font-weight: 600; }
.dsub-overview-tooltip strong { color: var(--dsw-alias-label-primary); font-size: 15px; line-height: 20px; font-weight: 650; font-variant-numeric: tabular-nums; }
.dsub-overview-tooltip small { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; }
.dsub-overview-tooltip-row { display: flex; align-items: center; gap: 5px; }
.dsub-overview-tooltip-row .dsub-model-icon { width: 13px; height: 13px; }
.dsub-overview-tooltip-row span { flex: 1; }
.dsub-overview-tooltip-row em { color: var(--dsw-alias-label-secondary); font-style: normal; font-variant-numeric: tabular-nums; }
.dsub-overview-tooltip .dsub-overview-tooltip-cost { margin-top: 2px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.dsub-overview-period { margin-top: 9px; color: var(--dsw-alias-label-tertiary); font-size: 12.5px; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }
@keyframes dsub-overview-rise {
  from { transform: scaleY(0); opacity: .45; }
  to { transform: scaleY(1); opacity: 1; }
}
@keyframes dsub-overview-ring-progress {
  from { stroke-dasharray: 0 100; }
  to { stroke-dasharray: 100 0; }
}
@keyframes dsub-overview-modal-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dsub-overview-panel-in {
  from { opacity: 0; transform: translateY(6px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes dsub-side-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.dsub-overview-empty {
  min-height: 220px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  color: var(--dsw-alias-label-secondary);
}
.dsub-overview-empty b { font-size: 14px; line-height: 20px; font-weight: 600; }
.dsub-overview-empty span { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 17px; }
.dsub-overview-foot { max-width: 1120px; margin: 14px auto 0; color: var(--dsw-alias-label-tertiary); font-size: 12.5px; line-height: 18px; }
@media (max-width: 760px) {
  .dsub-overview { padding: 20px 18px 30px; }
  .dsub-overview-head { align-items: flex-start; flex-direction: column; }
  .dsub-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dsub-overview-chart-head { flex-direction: column; gap: 8px; }
  .dsub-overview-context { flex-direction: column; align-items: stretch; }
  .dsub-overview-context-workspace, .dsub-overview-context-model { flex: 1 1 auto; width: 100%; }
  .dsub-overview-composition-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dsub-overview-model-row { grid-template-columns: minmax(130px, 2fr) 78px 74px 52px 88px 42px; gap: 6px; padding: 9px 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .dsub-turn, .dsub-turn .dsub-dot, .dsub-bar > span, .dsub-side-bar > span, .dsub-side-status-dot, .dsub-side-donut .dsub-donut-fill, .dsub-switch, .dsub-switch-thumb, .dsub-overview-bar-official, .dsub-overview-bar-third, .dsub-overview-bar-local, .dsub-overview-bar-warn, .dsub-overview-bar-danger, .dsub-overview-ring-reveal, .dsub-overview-modal, .dsub-overview-modal-panel, .dsub-side-card, .dsub-reveal-card, .dsub-overview-composition-bar span { transition: none; animation: none; }
  .dsub-reveal-card { opacity: 1; transform: none; }
  .dsub-overview-bar-official, .dsub-overview-bar-third, .dsub-overview-bar-local, .dsub-overview-bar-warn, .dsub-overview-bar-danger { opacity: 1; transform: none; }
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
    const PROVIDER_NAMES = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      openrouter: 'OpenRouter',
      lmstudio: 'LM Studio',
      'lm-studio': 'LM Studio',
      ollama: 'Ollama',
      'azure-openai': 'Azure OpenAI',
      xai: 'xAI',
      groq: 'Groq',
      deepseek: 'DeepSeek',
      'deepseek-account': 'DeepSeek',
    }

    /**
     * Reference bills for common third-party APIs. Vendors rarely publish a
     * machine-readable price feed, so this is a dated catalog rather than a
     * live quote. Update the entries when the vendor changes its bill.
     * Prices are per 1M tokens in the vendor's own currency.
     */
    const BUILTIN_BILLING_VERSION = "2026-11-21.1"
    const BUILTIN_BILLING_CATALOG = [
      {"provider":"openai","model":"gpt-4o","name":"OpenAI GPT-4o","currency":"USD","mode":"flat","input":2.5,"cached":1.25,"cacheWrite":2.5,"output":10},
      {"provider":"openai","model":"gpt-4o-mini","name":"OpenAI GPT-4o mini","currency":"USD","mode":"flat","input":0.15,"cached":0.075,"cacheWrite":0.15,"output":0.6},
      {"provider":"openai","model":"gpt-4.1","name":"OpenAI GPT-4.1","currency":"USD","mode":"flat","input":2,"cached":0.5,"cacheWrite":2,"output":8},
      {"provider":"openai","model":"gpt-4.1-mini","name":"OpenAI GPT-4.1 mini","currency":"USD","mode":"flat","input":0.4,"cached":0.1,"cacheWrite":0.4,"output":1.6},
      {"provider":"openai","model":"gpt-4.1-nano","name":"OpenAI GPT-4.1 nano","currency":"USD","mode":"flat","input":0.1,"cached":0.025,"cacheWrite":0.1,"output":0.4},
      {"provider":"openai","model":"o3","name":"OpenAI o3","currency":"USD","mode":"flat","input":2,"cached":0.5,"cacheWrite":2,"output":8},
      {"provider":"openai","model":"o3-mini","name":"OpenAI o3-mini","currency":"USD","mode":"flat","input":1.1,"cached":0.55,"cacheWrite":1.1,"output":4.4},
      {"provider":"openai","model":"o4-mini","name":"OpenAI o4-mini","currency":"USD","mode":"flat","input":1.1,"cached":0.275,"cacheWrite":1.1,"output":4.4},
      {"provider":"anthropic","model":"claude-3.5-sonnet","name":"Anthropic Claude 3.5 Sonnet","currency":"USD","mode":"flat","input":3,"cached":0.3,"cacheWrite":3.75,"output":15},
      {"provider":"anthropic","model":"claude-3.5-haiku","name":"Anthropic Claude 3.5 Haiku","currency":"USD","mode":"flat","input":0.8,"cached":0.08,"cacheWrite":1,"output":4},
      {"provider":"anthropic","model":"claude-sonnet-4-5","name":"Anthropic Claude Sonnet 4.5","currency":"USD","mode":"flat","input":3,"cached":0.3,"cacheWrite":3.75,"output":15},
      {"provider":"anthropic","model":"claude-opus-4-5","name":"Anthropic Claude Opus 4.5","currency":"USD","mode":"flat","input":5,"cached":0.5,"cacheWrite":6.25,"output":25},
      {"provider":"anthropic","model":"claude-haiku-4-5","name":"Anthropic Claude Haiku 4.5","currency":"USD","mode":"flat","input":1,"cached":0.1,"cacheWrite":1.25,"output":5},
      {"provider":"google","model":"gemini-1.5-pro","name":"Google Gemini 1.5 Pro","currency":"USD","mode":"flat","input":1.25,"cached":0.31,"cacheWrite":1.25,"output":5},
      {"provider":"google","model":"gemini-1.5-flash","name":"Google Gemini 1.5 Flash","currency":"USD","mode":"flat","input":0.075,"cached":0.018,"cacheWrite":0.075,"output":0.3},
      {"provider":"google","model":"gemini-2.5-pro","name":"Google Gemini 2.5 Pro","currency":"USD","mode":"flat","input":1.25,"cached":0.31,"cacheWrite":1.25,"output":10},
      {"provider":"google","model":"gemini-2.5-flash","name":"Google Gemini 2.5 Flash","currency":"USD","mode":"flat","input":0.3,"cached":0.075,"cacheWrite":0.3,"output":2.5},
      {"provider":"google","model":"gemini-2.5-flash-lite","name":"Google Gemini 2.5 Flash-Lite","currency":"USD","mode":"flat","input":0.1,"cached":0.025,"cacheWrite":0.1,"output":0.4},
      {"provider":"google","model":"gemini-2.0-flash","name":"Google Gemini 2.0 Flash","currency":"USD","mode":"flat","input":0.1,"cached":0.025,"cacheWrite":0.1,"output":0.4},
      {"provider":"xai","model":"grok-4.3","name":"xAI Grok 4.3","currency":"USD","mode":"flat","input":1.25,"cached":0.2,"cacheWrite":1.25,"output":2.5},
    ]
    let billingCatalog = BUILTIN_BILLING_CATALOG
    let pricingStatus = { source: 'builtin', version: BUILTIN_BILLING_VERSION, error: false }
    const pricingListeners = new Set()
    const notifyPricing = () => { for (const listener of pricingListeners) listener() }
    const usePricingRevision = () => {
      const [, setRevision] = useState(0)
      useEffect(() => {
        const listener = () => setRevision(value => value + 1)
        pricingListeners.add(listener)
        return () => { pricingListeners.delete(listener) }
      }, [])
    }
    const validPricingCatalog = value => {
      if (value === null || typeof value !== 'object' || !Array.isArray(value.models)) return false
      return value.models.every(entry => entry !== null
        && typeof entry === 'object'
        && typeof entry.provider === 'string'
        && typeof entry.model === 'string'
        && typeof entry.currency === 'string'
        && Number.isFinite(Number(entry.input))
        && Number.isFinite(Number(entry.output)))
    }
    let pricingOverride = null
    let pricingOverrideLoaded = false
    const loadPricingOverride = () => {
      if (pricingOverrideLoaded) return
      pricingOverrideLoaded = true
      try {
        const raw = window.localStorage.getItem(PRICING_OVERRIDE_KEY)
        const parsed = raw === null ? null : JSON.parse(raw)
        if (validPricingCatalog(parsed)) pricingOverride = parsed.models
      } catch (_error) {
        pricingOverride = null
      }
    }
    const setPricingOverride = models => {
      if (!Array.isArray(models)) return false
      if (models.length === 0) {
        pricingOverride = null
        try { window.localStorage.removeItem(PRICING_OVERRIDE_KEY) } catch (_error) { /* private mode */ }
      } else {
        const candidate = { version: 'local-override', models }
        if (!validPricingCatalog(candidate)) return false
        pricingOverride = models
        try {
          window.localStorage.setItem(PRICING_OVERRIDE_KEY, JSON.stringify(candidate))
        } catch (_error) {
          return false
        }
      }
      pricingOverrideLoaded = true
      notifyPricing()
      return true
    }
    const effectiveBillingCatalog = () => {
      loadPricingOverride()
      return pricingOverride !== null && pricingOverride.length > 0 ? pricingOverride : billingCatalog
    }
    const setPricingPayload = payload => {
      if (payload === null || typeof payload !== 'object') return false
      const catalog = payload.catalog
      if (!validPricingCatalog(catalog)) return false
      if (typeof catalog.version === 'string'
        && catalog.version.localeCompare(BUILTIN_BILLING_VERSION, undefined, { numeric: true }) < 0) {
        return false
      }
      billingCatalog = catalog.models
      pricingStatus = {
        source: typeof payload.source === 'string' ? payload.source : 'remote',
        version: typeof catalog.version === 'string' ? catalog.version : 'unknown',
        error: payload.error === true,
      }
      notifyPricing()
      return true
    }
    let pricingLoading = false
    const loadPricing = async () => {
      if (pricingLoading) return
      pricingLoading = true
      try {
        const response = await fetch('/dsh-usage-balance-card/pricing.json', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json()
        if (!setPricingPayload(payload)) throw new Error('Invalid pricing catalog')
      } catch (_error) {
        pricingStatus = {
          source: 'builtin',
          version: BUILTIN_BILLING_VERSION,
          error: true,
        }
        billingCatalog = BUILTIN_BILLING_CATALOG
        notifyPricing()
      } finally {
        pricingLoading = false
      }
    }

    function billingFor(provider, model) {
      const p = String(provider || '').trim().toLowerCase()
      const m = String(model || '').trim().toLowerCase().replace(/[._]/g, '-')
      const matches = effectiveBillingCatalog().filter(entry => {
        if (entry.provider !== p) return false
        const ruleModel = entry.model
        if (ruleModel instanceof RegExp) return ruleModel.test(model)
        const rule = String(ruleModel || '').trim().toLowerCase().replace(/[._]/g, '-')
        return rule !== '' && (rule === m || m.startsWith(`${rule}-`) || m.startsWith(`${rule}:`))
      })
      return matches.sort((left, right) => String(right.model).length - String(left.model).length)[0] ?? null
    }

    // Per-turn prices are written once and then reused. A later catalog update
    // must not rewrite an old invoice.
    const QUOTE_KEY = 'dsh-usage-balance:quotes:v1'
    let quoteStore = null
    const loadQuoteStore = () => {
      if (quoteStore !== null) return quoteStore
      try {
        const value = JSON.parse(localStorage.getItem(QUOTE_KEY) || '{}')
        quoteStore = value !== null && typeof value === 'object' ? value : {}
      } catch (_error) {
        quoteStore = {}
      }
      return quoteStore
    }
    const quoteSignature = turn => [
      num(turn.input), num(turn.cacheRead), num(turn.cacheWrite), num(turn.output),
      String(turn.provider || ''), String(turn.model || ''),
    ].join('|')
    const quoteKey = (sessionId, turn) => `${sessionId}:${turn.turn}`
    const quoteForTurn = (sessionId, turn) => {
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const value = loadQuoteStore()[quoteKey(sessionId, turn)]
      if (value === null || typeof value !== 'object' || value.sig !== quoteSignature(turn)) return null
      return Number.isFinite(Number(value.amount)) && typeof value.currency === 'string'
        ? { amount: Number(value.amount), currency: value.currency }
        : null
    }
    const rememberQuote = (sessionId, turn, info) => {
      if (typeof sessionId !== 'string' || sessionId === '' || info === null) return
      if (turn.endedAt === null || turn.endedAt === undefined) return
      const store = loadQuoteStore()
      store[quoteKey(sessionId, turn)] = {
        sig: quoteSignature(turn),
        amount: info.amount,
        currency: info.currency,
        version: pricingStatus.version,
        source: pricingStatus.source,
        at: Date.now(),
      }
      const keys = Object.keys(store)
      if (keys.length > 4000) {
        for (const key of keys.sort((left, right) => (store[left].at || 0) - (store[right].at || 0)).slice(0, keys.length - 4000)) {
          delete store[key]
        }
      }
      try { localStorage.setItem(QUOTE_KEY, JSON.stringify(store)) } catch (_error) { /* best effort */ }
    }

    /** @param {any} model @param {any} provider @returns {string} */
    function modelLabel(model, provider) {
      const raw = typeof model === 'string' ? model.trim() : ''
      if (raw === '') return '—'
      const mapped = MODEL_NAMES[raw.toLowerCase()]
      if (mapped !== undefined) return mapped
      const source = typeof provider === 'string' && provider.trim() !== ''
        ? (PROVIDER_NAMES[provider.trim().toLowerCase()]
          ?? `${provider.trim().charAt(0).toUpperCase()}${provider.trim().slice(1)}`)
        : ''
      if (source !== '' && !raw.toLowerCase().startsWith(source.toLowerCase())) return `${source} ${raw}`
      return raw
    }

    /** @param {string} provider @param {string} model @returns {string} */
    function modelVendor(provider, model) {
      if (isLocalRoute(provider, model)) return 'local'
      const p = String(provider || '').trim().toLowerCase()
      const m = String(model || '').trim().toLowerCase()
      if (/deepseek/.test(p) || /deepseek/.test(m)) return 'deepseek'
      if (/openai|azure/.test(p) || /^(gpt|o1|o3|o4|chatgpt)|gpt-/.test(m)) return 'openai'
      if (/anthropic|claude/.test(p) || /claude/.test(m)) return 'anthropic'
      if (/google|gemini|vertex/.test(p) || /gemini|gemma/.test(m)) return 'google'
      if (/xai|x-ai/.test(p) || /grok/.test(m)) return 'xai'
      if (/meta|llama/.test(p) || /llama/.test(m)) return 'meta'
      if (/mistral/.test(p) || /mistral|mixtral/.test(m)) return 'mistral'
      if (/qwen|alibaba|dashscope/.test(p) || /qwen/.test(m)) return 'qwen'
      if (/moonshot|kimi/.test(p) || /kimi|moonshot/.test(m)) return 'moonshot'
      if (/minimax/.test(p) || /minimax/.test(m)) return 'minimax'
      if (/zhipu|bigmodel|glm/.test(p) || /glm|zhipu/.test(m)) return 'zhipu'
      return 'generic'
    }

    /** Inline vendor mark used next to every model name. */
    const ModelIcon = ({ provider, model, kind }) => {
      const vendor = kind || modelVendor(provider, model)
      const svg = (children, background) => h('svg', {
        className: 'dsub-model-icon',
        viewBox: '0 0 16 16',
        preserveAspectRatio: 'xMidYMid meet',
        'data-vendor': vendor,
        'aria-hidden': 'true',
      },
        h('rect', { x: 0.5, y: 0.5, width: 15, height: 15, rx: 4, fill: background }),
        children,
      )
      if (vendor === 'deepseek') {
        return svg([
          h('path', { d: 'M3 9.3c2.1.1 3.2-.8 4.5-.8 1.3 0 2.2.8 3.3 1.8 1.1 1 2.2 1.3 2.2 1.3-.6 1.5-2.2 2.3-4.1 2.3-3 0-5.1-1.5-5.9-4.6Z', fill: '#fff' }),
          h('circle', { cx: 10.9, cy: 6.2, r: 0.85, fill: '#fff' }),
        ], '#4d6bfe')
      }
      if (vendor === 'openai') {
        return svg([
          h('path', { d: 'M8 2.5 12.7 5.2v5.6L8 13.5l-4.7-2.7V5.2L8 2.5Z', fill: 'none', stroke: '#fff', strokeWidth: 1.2 }),
          h('circle', { cx: 8, cy: 8, r: 1.5, fill: '#fff' }),
        ], '#10a37f')
      }
      if (vendor === 'anthropic') {
        return svg([
          h('path', { d: 'M4.1 12.4 7.3 3.6h1.4l3.2 8.8h-1.9l-.7-2.2H6.7l-.7 2.2H4.1Zm3.1-3.7h2.4L8.4 5.6 7.2 8.7Z', fill: '#fff' }),
        ], '#d97757')
      }
      if (vendor === 'google') {
        return svg([
          h('path', { d: 'M8 2.2 9.7 6.3 13.8 8 9.7 9.7 8 13.8 6.3 9.7 2.2 8 6.3 6.3 8 2.2Z', fill: '#4285f4' }),
          h('circle', { cx: 12.8, cy: 3.2, r: 1.2, fill: '#ea4335' }),
          h('circle', { cx: 3.2, cy: 12.8, r: 1.2, fill: '#34a853' }),
        ], '#fff')
      }
      if (vendor === 'xai') {
        return svg([
          h('path', { d: 'M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8', stroke: '#fff', strokeWidth: 1.4, strokeLinecap: 'round' }),
        ], '#111')
      }
      if (vendor === 'meta') {
        return svg([
          h('path', { d: 'M3 9.7c0-2.8 1.3-4.8 3.2-4.8 1.4 0 2.2 1.3 2.8 2.4.6-1.1 1.4-2.4 2.8-2.4 1.9 0 3.2 2 3.2 4.8 0 1.4-.7 2.3-1.8 2.3-1.2 0-1.9-1.1-2.7-2.4-.8 1.3-1.5 2.4-2.7 2.4-1.1 0-1.8-.9-1.8-2.3Z', fill: 'none', stroke: '#fff', strokeWidth: 1.15 }),
        ], '#0866ff')
      }
      if (vendor === 'mistral') {
        return svg([
          h('path', { d: 'M3 3h3v3h4V3h3v10h-3V9H6v4H3V3Z', fill: '#fff' }),
        ], '#ff7000')
      }
      if (vendor === 'qwen') {
        return svg([
          h('circle', { cx: 8, cy: 8, r: 4.6, fill: 'none', stroke: '#fff', strokeWidth: 1.5 }),
          h('path', { d: 'm10.6 10.6 2 2', stroke: '#fff', strokeWidth: 1.5, strokeLinecap: 'round' }),
        ], '#615ced')
      }
      if (vendor === 'moonshot') {
        return svg([
          h('path', { d: 'M10.7 3.2A5.2 5.2 0 1 0 12.8 10 4.2 4.2 0 0 1 10.7 3.2Z', fill: '#fff' }),
        ], '#111')
      }
      if (vendor === 'minimax') {
        return svg([
          h('path', { d: 'M3 11V5.5L6 8l2-2.5L10 8l3-2.5V11', fill: 'none', stroke: '#fff', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        ], '#6d5dfc')
      }
      if (vendor === 'zhipu') {
        return svg([
          h('path', { d: 'M4 4h8l-5.2 6H12v2H4l5.2-6H4V4Z', fill: '#fff' }),
        ], '#3859ff')
      }
      if (vendor === 'local') {
        return svg([
          h('rect', { x: 3, y: 3.5, width: 10, height: 7.5, rx: 1.2, fill: 'none', stroke: '#fff', strokeWidth: 1.2 }),
          h('path', { d: 'M6.7 13h2.6M8 11v2', stroke: '#fff', strokeWidth: 1.2, strokeLinecap: 'round' }),
        ], '#4b5563')
      }
      if (vendor === 'all') {
        return svg([
          h('rect', { x: 3.4, y: 3.4, width: 3.7, height: 3.7, rx: 1.1, fill: '#fff' }),
          h('rect', { x: 8.9, y: 3.4, width: 3.7, height: 3.7, rx: 1.1, fill: '#fff' }),
          h('rect', { x: 3.4, y: 8.9, width: 3.7, height: 3.7, rx: 1.1, fill: '#fff' }),
          h('rect', { x: 8.9, y: 8.9, width: 3.7, height: 3.7, rx: 1.1, fill: '#fff' }),
        ], '#52525b')
      }
      return svg([
        h('circle', { cx: 5.3, cy: 8, r: 1.1, fill: '#fff' }),
        h('circle', { cx: 8, cy: 8, r: 1.1, fill: '#fff' }),
        h('circle', { cx: 10.7, cy: 8, r: 1.1, fill: '#fff' }),
      ], '#6b7280')
    }

    const ModelName = ({ provider, model, className = '' }) => h('span', {
      className: `dsub-model-name${className === '' ? '' : ` ${className}`}`,
      title: model || '',
    },
      h(ModelIcon, { provider, model }),
      h('span', { className: 'dsub-model-name-text' }, modelLabel(model, provider)),
    )

    const escapeHtml = value => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')

    /** Static SVG marks for the standalone report windows. */
    const iconMarkup = (provider, model, kind) => {
      const vendor = kind || modelVendor(provider, model)
      const icons = {
        deepseek: ['#4d6bfe', '<path d="M3 9.3c2.1.1 3.2-.8 4.5-.8 1.3 0 2.2.8 3.3 1.8 1.1 1 2.2 1.3 2.2 1.3-.6 1.5-2.2 2.3-4.1 2.3-3 0-5.1-1.5-5.9-4.6Z" fill="#fff"/><circle cx="10.9" cy="6.2" r=".85" fill="#fff"/>'],
        openai: ['#10a37f', '<path d="M8 2.5 12.7 5.2v5.6L8 13.5l-4.7-2.7V5.2L8 2.5Z" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="8" cy="8" r="1.5" fill="#fff"/>'],
        anthropic: ['#d97757', '<path d="M4.1 12.4 7.3 3.6h1.4l3.2 8.8h-1.9l-.7-2.2H6.7l-.7 2.2H4.1Zm3.1-3.7h2.4L8.4 5.6 7.2 8.7Z" fill="#fff"/>'],
        google: ['#fff', '<path d="M8 2.2 9.7 6.3 13.8 8 9.7 9.7 8 13.8 6.3 9.7 2.2 8 6.3 6.3 8 2.2Z" fill="#4285f4"/><circle cx="12.8" cy="3.2" r="1.2" fill="#ea4335"/><circle cx="3.2" cy="12.8" r="1.2" fill="#34a853"/>'],
        xai: ['#111', '<path d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>'],
        meta: ['#0866ff', '<path d="M3 9.7c0-2.8 1.3-4.8 3.2-4.8 1.4 0 2.2 1.3 2.8 2.4.6-1.1 1.4-2.4 2.8-2.4 1.9 0 3.2 2 3.2 4.8 0 1.4-.7 2.3-1.8 2.3-1.2 0-1.9-1.1-2.7-2.4-.8 1.3-1.5 2.4-2.7 2.4-1.1 0-1.8-.9-1.8-2.3Z" fill="none" stroke="#fff" stroke-width="1.15"/>'],
        mistral: ['#ff7000', '<path d="M3 3h3v3h4V3h3v10h-3V9H6v4H3V3Z" fill="#fff"/>'],
        qwen: ['#615ced', '<circle cx="8" cy="8" r="4.6" fill="none" stroke="#fff" stroke-width="1.5"/><path d="m10.6 10.6 2 2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'],
        moonshot: ['#111', '<path d="M10.7 3.2A5.2 5.2 0 1 0 12.8 10 4.2 4.2 0 0 1 10.7 3.2Z" fill="#fff"/>'],
        minimax: ['#6d5dfc', '<path d="M3 11V5.5L6 8l2-2.5L10 8l3-2.5V11" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'],
        zhipu: ['#3859ff', '<path d="M4 4h8l-5.2 6H12v2H4l5.2-6H4V4Z" fill="#fff"/>'],
        local: ['#4b5563', '<rect x="3" y="3.5" width="10" height="7.5" rx="1.2" fill="none" stroke="#fff" stroke-width="1.2"/><path d="M6.7 13h2.6M8 11v2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>'],
        all: ['#52525b', '<rect x="3.4" y="3.4" width="3.7" height="3.7" rx="1.1" fill="#fff"/><rect x="8.9" y="3.4" width="3.7" height="3.7" rx="1.1" fill="#fff"/><rect x="3.4" y="8.9" width="3.7" height="3.7" rx="1.1" fill="#fff"/><rect x="8.9" y="8.9" width="3.7" height="3.7" rx="1.1" fill="#fff"/>'],
        generic: ['#6b7280', '<circle cx="5.3" cy="8" r="1.1" fill="#fff"/><circle cx="8" cy="8" r="1.1" fill="#fff"/><circle cx="10.7" cy="8" r="1.1" fill="#fff"/>'],
      }
      const icon = icons[vendor] ?? icons.generic
      return `<svg class="mi" viewBox="0 0 16 16" aria-hidden="true"><rect x=".5" y=".5" width="15" height="15" rx="4" fill="${icon[0]}"/>${icon[1]}</svg>`
    }

    const openHtmlWindow = async (title, body, width = 760, height = 720) => {
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
        :root{color-scheme:dark;--bg:#141516;--l1:#1d1e20;--l2:#242527;--p:#ededed;--s:#a3a3a3;--t:#7a7d82;--line:#34363a;--line2:#44474c}
        :root[data-theme="light"]{color-scheme:light;--bg:#f7f8fa;--l1:#ffffff;--l2:#f1f3f6;--p:#17191d;--s:#4b5563;--t:#6b7280;--line:#e1e4e8;--line2:#d4d8de}
        *{box-sizing:border-box}body{margin:0;padding:20px;background:var(--bg);color:var(--p);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        h1{margin:0 0 4px;font-size:24px;line-height:30px}h2{margin:18px 0 8px;font-size:17px}.muted{color:var(--s)}.sub{color:var(--t);font-size:13px}
        .mi{display:inline-block;width:18px;height:18px;flex:none;vertical-align:-4px}.card{border:1px solid var(--line);border-radius:12px;background:var(--l2);padding:14px}
        .hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.hero strong{display:block;font-size:30px;line-height:36px}.hero small{color:var(--t)}.hero .sub{font-size:14.5px;color:var(--s)}
        .ring-layout{display:flex;gap:22px;align-items:center;margin-top:14px}.ring{position:relative;width:180px;height:180px;flex:none}.ring svg{width:180px;height:180px}.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.ring-center strong{font-size:27px}.ring-center small{color:var(--t);font-size:12px}
        .legend{flex:1;display:flex;flex-direction:column;gap:7px}.legend-row{display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid var(--line);border-radius:9px;background:var(--l1)}.legend-row span{flex:1;color:var(--s);font-size:15px}.legend-row strong{font-size:22px}.legend-row em{color:var(--t);font-style:normal;font-size:15px}
        .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--l1);font-size:14px}.chip em{color:var(--t);font-style:normal}
        table{width:100%;border-collapse:collapse;margin-top:8px;border:1px solid var(--line);border-radius:10px;overflow:hidden}th,td{padding:9px 11px;border-top:1px solid var(--line);text-align:left;font-size:13.5px}th{background:var(--l1);color:var(--t);font-weight:600}th:not(:first-child),td:not(:first-child){text-align:right}tr:first-child th{border-top:0}
        .section-head{display:flex;justify-content:space-between;align-items:baseline;margin-top:18px}.section-head b{font-size:16px}.section-head span{color:var(--t);font-size:12.5px}
        .actions{display:flex;justify-content:space-between;align-items:center;margin-top:18px}.actions button{border:1px solid var(--line2);border-radius:8px;background:var(--l2);color:var(--p);padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}.actions .primary{background:#2563eb;border-color:#2563eb;color:#fff}
        .note{color:var(--t);font-size:13px;margin-top:10px}
      </style></head><body>${body}<script>
        (() => {
          const media = window.matchMedia('(prefers-color-scheme: dark)')
          const apply = () => {
            document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
            document.documentElement.style.colorScheme = media.matches ? 'dark' : 'light'
          }
          apply()
          media.addEventListener('change', apply)
        })()
      </script></body></html>`
      let child = null
      try {
        child = window.open('about:blank', 'liveshare-owner-login', `width=${width},height=${height},resizable=yes,scrollbars=yes`)
      } catch (_error) {
        child = null
      }
      if (child === null) return false
      try {
        child.document.open()
        child.document.write(html)
        child.document.close()
        child.document.title = title
        try {
          child.resizeTo(width, height)
          child.focus()
        } catch (_error) {
          // The Desktop window policy may keep its own preferred size.
        }
        return true
      } catch (_error) {
        try { child.close() } catch (_closeError) { /* already gone */ }
        return false
      }
    }

    /** Native selects cannot contain SVG, so the model filter uses a small listbox. */
    const ModelPicker = ({ options, value, onChange, allLabel }) => {
      const [open, setOpen] = useState(false)
      const rootRef = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const close = event => {
          if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false)
        }
        const keydown = event => { if (event.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', close)
        document.addEventListener('keydown', keydown)
        return () => {
          document.removeEventListener('mousedown', close)
          document.removeEventListener('keydown', keydown)
        }
      }, [open])
      const current = value === 'all' ? null : options.find(option => option.key === value)
      const triggerLabel = current === null
        ? allLabel
        : `${current.name}${current.provider === '' ? '' : ` · ${current.provider}`}`
      const choose = next => {
        onChange(next)
        setOpen(false)
      }
      return h('div', { className: 'dsub-model-picker', ref: rootRef },
        h('button', {
          type: 'button',
          className: 'dsub-model-picker-trigger',
          'aria-haspopup': 'listbox',
          'aria-expanded': open ? 'true' : 'false',
          title: triggerLabel,
          onClick: () => { setOpen(value => !value) },
        },
          h(ModelIcon, {
            kind: current === null ? 'all' : undefined,
            provider: current === null ? '' : current.provider,
            model: current === null ? '' : current.model,
          }),
          h('span', { className: 'dsub-model-picker-value' }, triggerLabel),
          h('svg', { className: 'dsub-model-picker-chevron', viewBox: '0 0 16 16', 'aria-hidden': 'true' },
            h('path', { d: 'm4 6 4 4 4-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
          ),
        ),
        open
          ? h('div', { className: 'dsub-model-picker-menu', role: 'listbox' },
            h('button', {
              type: 'button',
              className: 'dsub-model-picker-option',
              'data-selected': value === 'all' ? 'true' : 'false',
              onClick: () => { choose('all') },
            },
              h(ModelIcon, { kind: 'all' }),
              h('span', null, allLabel),
              value === 'all' ? h('span', { className: 'dsub-model-picker-check' }, '✓') : null,
            ),
            options.map(option => h('button', {
              type: 'button',
              key: option.key,
              className: 'dsub-model-picker-option',
              'data-selected': value === option.key ? 'true' : 'false',
              onClick: () => { choose(option.key) },
            },
              h(ModelIcon, { provider: option.provider, model: option.model }),
              h('span', { className: 'dsub-model-picker-option-text' },
                h('b', null, option.name),
                option.provider !== '' ? h('small', null, option.provider) : null,
              ),
              value === option.key ? h('span', { className: 'dsub-model-picker-check' }, '✓') : null,
            )),
          )
          : null,
      )
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
      if (n < 1e3) return formatInteger(n)
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
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      if (CN_HOLIDAYS_2026.has(key)) return false
      const day = d.getUTCDay()
      const weekend = day === 0 || day === 6
      if (weekend && !CN_MAKEUP_WORKDAYS_2026.has(key)) return false
      const hour = d.getUTCHours() + d.getUTCMinutes() / 60
      return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
    }

    /** @param {string} provider @param {string} model @returns {boolean} */
    function isOfficialRoute(provider, model) {
      const p = String(provider || '').trim().toLowerCase()
      if (p !== '') return p === 'deepseek' || p.startsWith('deepseek-') || p.startsWith('deepseek/')
      return /^deepseek[-_/]/i.test(String(model || '').trim())
    }

    const LOCAL_PROVIDER = /^(ollama|lm-?studio|llama|llama-?cpp|local|localhost|vllm|jan|kobold|text-generation-webui|oobabooga|mlx|exo|llamafile|mistral\.rs)/

    function isLocalRoute(provider, model) {
      if (isOfficialRoute(provider, model)) return false
      const p = String(provider || '').trim().toLowerCase()
      if (p !== '') return LOCAL_PROVIDER.test(p) || p.includes('localhost') || p.includes('/local')
      return /^(qwen|llama|mistral|gemma|phi|local|gguf)/i.test(String(model || '').trim())
    }

    function isThirdPartyRoute(provider, model) {
      return !isOfficialRoute(provider, model) && !isLocalRoute(provider, model)
    }

    /** @param {any} turn @returns {boolean} */
    function isLocalTurn(turn) {
      return turn !== null && turn !== undefined && isLocalRoute(turn.provider, turn.model)
    }

    /** @param {any} turn @returns {boolean} */
    function isThirdPartyTurn(turn) {
      return turn !== null && turn !== undefined && isThirdPartyRoute(turn.provider, turn.model)
    }

    /** @param {string} model @param {number} at @param {string} provider @returns {{hit:number,miss:number,out:number}|null} */
    function priceFor(model, at, provider) {
      if (!isOfficialRoute(provider, model)) return null
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
      if (isThirdPartyRoute(turn.provider, turn.model)) {
        const reported = Number(turn.cost)
        return Number.isFinite(reported) && reported >= 0 ? reported : null
      }
      const price = priceFor(turn.model, turn.startedAt, turn.provider)
      if (price === null) return null
      return ((num(turn.input) + num(turn.cacheWrite)) * price.miss
        + num(turn.cacheRead) * price.hit
        + num(turn.output) * price.out) / 1e6
    }

    /** Wallet spend belongs to the DeepSeek account only. */
    function walletCost(turn) {
      return isOfficialRoute(turn.provider, turn.model) ? turnCost(turn) : null
    }

    /** Catalog-based estimate for the balance card on third-party routes. */
    function thirdPartyCost(turn) {
      const rule = billingFor(turn.provider, turn.model)
      if (rule === null) return null
      const miss = num(turn.input)
      const cached = num(turn.cacheRead)
      const write = num(turn.cacheWrite)
      const output = num(turn.output)
      const value = (miss * rule.input
        + cached * rule.cached
        + write * (rule.cacheWrite ?? rule.input)
        + output * rule.output) / 1e6
      return Number.isFinite(value) && value >= 0 ? value : null
    }

    /** @returns {{ amount: number, currency: string } | null} */
    function cardCostInfo(turn, sessionId) {
      if (turn === null || turn === undefined) return null
      if (isLocalTurn(turn)) return null
      if (isOfficialRoute(turn.provider, turn.model)) {
        const amount = walletCost(turn)
        return amount === null ? null : { amount, currency: 'CNY' }
      }
      const quoted = quoteForTurn(sessionId, turn)
      if (quoted !== null) return quoted
      const rule = billingFor(turn.provider, turn.model)
      if (rule !== null) {
        const amount = thirdPartyCost(turn)
        if (amount === null) return null
        const info = { amount, currency: rule.currency }
        rememberQuote(sessionId, turn, info)
        return info
      }
      const reported = Number(turn.cost)
      return Number.isFinite(reported) && reported >= 0
        ? { amount: reported, currency: 'CNY' }
        : null
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

        void loadPricing()
        ctx.effect(() => {
          const timer = window.setInterval(() => { void loadPricing() }, 6 * 60 * 60 * 1000)
          return () => { window.clearInterval(timer) }
        }, 'usage-balance: pricing refresh')

        // ---- Feature configuration -------------------------------------
        const forms = CONFIG_ENTRY_IDS.map(id => ctx.configForms.get(id))
        const configListeners = new Set()
        let featureConfig = { balanceCard: true, usageTrajectory: true, usageOverview: true }
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
        let collectionRevision = 0
        const collectionListeners = new Set()
        const notifyCollection = () => {
          collectionRevision += 1
          for (const listener of collectionListeners) listener()
        }
        const useCollectionRevision = () => {
          const [revision, setRevision] = useState(0)
          useEffect(() => {
            const listener = () => setRevision(value => value + 1)
            collectionListeners.add(listener)
            return () => { collectionListeners.delete(listener) }
          }, [])
          return revision
        }

        /**
         * Reveal progress/stat elements only when they approach the viewport.
         * The class is deliberately one-way: re-scrolling should not restart
         * every already-seen bar, while range/filter remounts create fresh nodes.
         */
        const useRevealOnScroll = (ref, dependencies = []) => {
          useEffect(() => {
            const root = ref.current
            if (root === null || root === undefined) return undefined
            if (typeof IntersectionObserver !== 'function') {
              for (const node of root.querySelectorAll('.dsub-reveal')) node.classList.add('is-inview')
              return undefined
            }
            const observer = new IntersectionObserver(entries => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue
                entry.target.classList.add('is-inview')
                observer.unobserve(entry.target)
              }
            }, {
              root: null,
              threshold: 0.05,
              rootMargin: '0px 0px -6% 0px',
            })
            const observed = new WeakSet()
            const observeNodes = () => {
              for (const node of root.querySelectorAll('.dsub-reveal')) {
                if (observed.has(node)) continue
                observed.add(node)
                observer.observe(node)
              }
            }
            observeNodes()
            const mutations = new MutationObserver(observeNodes)
            mutations.observe(root, { childList: true, subtree: true })
            return () => {
              mutations.disconnect()
              observer.disconnect()
            }
          }, dependencies)
        }

        /** A progress bar that fills only after it has entered the viewport. */
        const RevealBar = ({ className, fill }) => {
          const ref = useRef(null)
          const [visible, setVisible] = useState(false)
          useEffect(() => {
            const node = ref.current
            if (node === null || typeof IntersectionObserver !== 'function') {
              setVisible(true)
              return undefined
            }
            const observer = new IntersectionObserver(entries => {
              if (entries.some(entry => entry.isIntersecting)) {
                setVisible(true)
                observer.disconnect()
              }
            }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' })
            observer.observe(node)
            return () => { observer.disconnect() }
          }, [])
          return h('div', {
            ref,
            className: `${className}${visible ? ' is-inview' : ''}`,
          }, h('span', { style: { width: `${Math.max(0, Math.min(100, fill))}%` } }))
        }

        /** Count a visible statistic up from zero with a short GPU-friendly animation. */
        const AnimatedNumber = ({ value, format }) => {
          const ref = useRef(null)
          const frameRef = useRef(0)
          const [visible, setVisible] = useState(false)
          const [display, setDisplay] = useState(0)
          useEffect(() => {
            const node = ref.current
            if (node === null || typeof IntersectionObserver !== 'function') {
              setVisible(true)
              return undefined
            }
            const observer = new IntersectionObserver(entries => {
              if (entries.some(entry => entry.isIntersecting)) {
                setVisible(true)
                observer.disconnect()
              }
            }, { threshold: 0.15, rootMargin: '0px 0px -4% 0px' })
            observer.observe(node)
            return () => { observer.disconnect() }
          }, [])
          useEffect(() => {
            cancelAnimationFrame(frameRef.current)
            const target = Number(value)
            if (!Number.isFinite(target)) {
              setDisplay(0)
              return undefined
            }
            const reduced = typeof window.matchMedia === 'function'
              && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            if (!visible) {
              setDisplay(0)
              return undefined
            }
            if (reduced) {
              setDisplay(target)
              return undefined
            }
            const startedAt = performance.now()
            const duration = 620
            const step = now => {
              const progress = Math.min(1, (now - startedAt) / duration)
              const eased = 1 - (1 - progress) ** 3
              setDisplay(target * eased)
              if (progress < 1) frameRef.current = requestAnimationFrame(step)
            }
            frameRef.current = requestAnimationFrame(step)
            return () => { cancelAnimationFrame(frameRef.current) }
          }, [value, visible])
          return h('span', { ref }, format(display))
        }
        let listSubscription
        let cardDisposer
        let cardCloseTimer = null
        let viewDisposer
        let overviewDisposer
        let configPanelDisposer

        const projectionTurns = sessionId => {
          try {
            const state = ctx.sessions.list.getSnapshot()
            const value = state.projectionsBySession
              && state.projectionsBySession[sessionId]
              && state.projectionsBySession[sessionId].values
              ? state.projectionsBySession[sessionId].values.usageTrack
              : undefined
            return Array.isArray(value) ? normalizeTurns(value) : undefined
          } catch (_error) {
            return undefined
          }
        }

        const turnScore = turn => {
          const ended = Number(turn.endedAt)
          return [
            Number.isFinite(ended) ? 1 : 0,
            Number.isFinite(ended) ? ended : 0,
            totalTokens(turn),
            turn.status === 'completed' ? 1 : 0,
          ]
        }

        const betterTurn = (left, right) => {
          const a = turnScore(left)
          const b = turnScore(right)
          for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) return a[i] > b[i]
          }
          return false
        }

        /**
         * A projection refresh can race with a live update. Keep exactly one
         * record per Session turn so repeated collection never appends a second
         * identical row to the trajectory.
         */
        const normalizeTurns = source => {
          if (!Array.isArray(source)) return []
          const byTurn = new Map()
          const extras = []
          for (const turn of source) {
            if (turn === null || turn === undefined || typeof turn !== 'object') continue
            const number = Number(turn.turn)
            if (!Number.isSafeInteger(number) || number < 0) {
              extras.push(turn)
              continue
            }
            const existing = byTurn.get(number)
            if (existing === undefined || betterTurn(turn, existing)) byTurn.set(number, turn)
          }
          const normalized = [...byTurn.values()].sort((left, right) => Number(left.turn) - Number(right.turn))
          return normalized.concat(extras)
        }

        // ---- Durable browser-side archive --------------------------------
        // The Session projection is authoritative while a Session exists. This
        // archive keeps a compact copy so deleted Sessions do not silently
        // disappear from all-time totals after a reload.
        let archive = { sessions: {} }
        let archiveLoaded = false
        let archiveSaveTimer = 0
        let hostArchiveTimer = 0
        let hostArchiveLoading = false
        const hostArchivePending = new Map()

        const loadArchive = () => {
          if (archiveLoaded) return archive
          archiveLoaded = true
          try {
            const raw = window.localStorage.getItem(ARCHIVE_KEY)
            const parsed = raw === null ? null : JSON.parse(raw)
            if (parsed !== null && typeof parsed === 'object' && parsed.sessions !== null && typeof parsed.sessions === 'object') {
              archive = { sessions: parsed.sessions }
            }
          } catch (_error) {
            archive = { sessions: {} }
          }
          return archive
        }

        const saveArchive = () => {
          try {
            const records = Object.entries(archive.sessions)
              .filter(([id, record]) => id !== '' && record !== null && typeof record === 'object' && Array.isArray(record.turns))
              .sort((left, right) => Number(right[1].updatedAt ?? 0) - Number(left[1].updatedAt ?? 0))
            const sessions = {}
            let kept = 0
            for (const [id, record] of records) {
              if (kept >= ARCHIVE_MAX_TURNS) break
              const remaining = ARCHIVE_MAX_TURNS - kept
              const turns = record.turns.length > remaining ? record.turns.slice(-remaining) : record.turns
              sessions[id] = { turns, updatedAt: Number(record.updatedAt ?? Date.now()) }
              kept += turns.length
            }
            archive = { sessions }
            window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify({ version: 1, sessions }))
          } catch (_error) {
            // Quota/private mode: live projection cache still renders.
          }
        }

        const pushHostArchive = () => {
          if (hostArchivePending.size === 0) return
          const sessions = Object.fromEntries(hostArchivePending)
          hostArchivePending.clear()
          void fetch(ARCHIVE_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessions }),
          }).then(response => {
            if (!response.ok) throw new Error(`archive HTTP ${response.status}`)
          }).catch(() => {
            // Keep the complete local fallback and retry the changed Sessions
            // with the next collection pass.
            for (const [id, record] of Object.entries(sessions)) {
              if (!hostArchivePending.has(id)) hostArchivePending.set(id, record)
            }
          })
        }

        const persistArchive = (sessionId, turns) => {
          loadArchive()
          const normalized = normalizeTurns(turns)
          if (normalized.length === 0) return
          const record = { turns: normalized, updatedAt: Date.now() }
          archive.sessions[sessionId] = record
          hostArchivePending.set(sessionId, record)
          if (archiveSaveTimer !== 0) window.clearTimeout(archiveSaveTimer)
          archiveSaveTimer = window.setTimeout(() => {
            archiveSaveTimer = 0
            saveArchive()
          }, 250)
          if (hostArchiveTimer !== 0) window.clearTimeout(hostArchiveTimer)
          hostArchiveTimer = window.setTimeout(() => {
            hostArchiveTimer = 0
            pushHostArchive()
          }, 350)
        }

        const hydrateArchive = (sessions = archive.sessions) => {
          for (const [sessionId, record] of Object.entries(sessions)) {
            if (record === null || typeof record !== 'object' || !Array.isArray(record.turns)) continue
            const existing = collected.get(sessionId) ?? []
            const merged = normalizeTurns([...record.turns, ...existing])
            if (merged.length === 0) continue
            collected.set(sessionId, merged)
            archive.sessions[sessionId] = {
              turns: merged,
              updatedAt: Number(record.updatedAt ?? Date.now()),
            }
          }
        }

        const loadHostArchive = async () => {
          if (hostArchiveLoading) return
          hostArchiveLoading = true
          try {
            loadArchive()
            const localSessions = { ...archive.sessions }
            const response = await fetch(ARCHIVE_ROUTE, { cache: 'no-store' })
            if (!response.ok) return
            const payload = await response.json()
            if (payload === null || payload.sessions === null || typeof payload.sessions !== 'object') return
            hydrateArchive(payload.sessions)
            hydrateArchive(localSessions)
            saveArchive()
            notifyCollection()
            // One-time migration of the earlier browser-only archive.
            for (const [sessionId, record] of Object.entries(localSessions)) {
              const hostRecord = payload.sessions[sessionId]
              if (hostRecord === undefined
                || !Array.isArray(hostRecord.turns)
                || record.turns.length > hostRecord.turns.length) {
                hostArchivePending.set(sessionId, record)
              }
            }
            pushHostArchive()
          } catch (_error) {
            // Host archive is optional; the local archive remains usable.
          } finally {
            hostArchiveLoading = false
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
              const merged = normalizeTurns([...(collected.get(sessionId) ?? []), ...turns])
              collected.set(sessionId, merged)
              persistArchive(sessionId, merged)
              notifyCollection()
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
          loadArchive()
          hydrateArchive(archive.sessions)
          notifyCollection()
          void loadHostArchive()
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
          usePricingRevision()
          const config = useFeatureConfig()
          const locale = useLocaleId(ctx)
          const zhUser = String(locale || '').toLowerCase().startsWith('zh')
          const liveTurns = useProjection('usageTrack')
          const modelSelection = useProjection('modelSelection')
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
          const [now, setNow] = useState(() => Date.now())
          const anchorRef = useRef(null)
          const cardRevealRef = useRef(null)
          const alive = useRef(true)
          const refreshing = useRef(false)
          const lastSnapshotRef = useRef('')
          const previousRunning = useRef(running)

          useRevealOnScroll(cardRevealRef, [turns, running, sessionId])

          useEffect(() => {
            alive.current = true
            return () => { alive.current = false }
          }, [])

          useEffect(() => {
            const timer = window.setInterval(() => { setNow(Date.now()) }, 15_000)
            return () => { window.clearInterval(timer) }
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
              const value = normalizeTurns(liveTurns)
              collected.set(sessionId, value)
              setTurns(value)
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
              const cardWidth = width >= 1000
                ? 224
                : width >= 800
                  ? 211
                  : 0
              if (cardWidth === 0) {
                seat.removeAttribute('data-dsub-side-card')
                seat.style.removeProperty('--dsub-card-width')
                seat.style.removeProperty('--dsub-card-gap')
                seat.style.removeProperty('--dsub-card-margin')
                setGeometry(null)
                return
              }
              const gap = 16
              const margin = 16
              seat.dataset.dsubSideCard = 'true'
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
              seat.style.removeProperty('--dsub-card-width')
              seat.style.removeProperty('--dsub-card-gap')
              seat.style.removeProperty('--dsub-card-margin')
            }
          }, [sessionId, blank])

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
            ? cardCostInfo(currentTurn, sessionId)
            : null
          const previousTurn = sessionRunning ? latestCompleted : previousCompleted
          const previousCost = previousTurn === undefined ? null : cardCostInfo(previousTurn, sessionId)
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
              currentAmount: currentCost === null ? null : currentCost.amount,
              currentCurrency: currentCost === null ? 'CNY' : currentCost.currency,
              previousAmount: previousCost !== null
                ? previousCost.amount
                : (sortedTurns.length === 0 && stored !== null ? stored.previousAmount ?? null : null),
              previousCurrency: previousCost !== null
                ? previousCost.currency
                : (stored !== null ? stored.previousCurrency ?? 'CNY' : 'CNY'),
              showDetails: liveShowDetails,
              stats: liveStats,
              cache: hitRate ?? (stored !== null ? stored.cache ?? null : null),
              context: context ?? (stored !== null ? stored.context ?? null : null),
            }
            : {
              hasTurn: stored !== null ? Boolean(stored.hasTurn) : false,
              currentStatus: stored !== null ? stored.currentStatus ?? null : null,
              currentAmount: stored !== null ? stored.currentAmount ?? null : null,
              currentCurrency: stored !== null ? stored.currentCurrency ?? 'CNY' : 'CNY',
              previousAmount: stored !== null ? stored.previousAmount ?? null : null,
              previousCurrency: stored !== null ? stored.previousCurrency ?? 'CNY' : 'CNY',
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
          const peakNow = isPeak(now)
          const selectedRoute = modelSelection && typeof modelSelection === 'object'
            ? (modelSelection.next ?? modelSelection.lastUsed ?? null)
            : null
          const selectedModelId = String(selectedRoute && selectedRoute.model || latestTurn && latestTurn.model || '')
          const selectedProvider = String(selectedRoute && selectedRoute.provider || latestTurn && latestTurn.provider || '')
          const cardIsLocal = selectedModelId !== '' && isLocalRoute(selectedProvider, selectedModelId)
          const cardIsThirdParty = selectedModelId !== '' && isThirdPartyRoute(selectedProvider, selectedModelId)
          const cardIsExternal = cardIsLocal || cardIsThirdParty
          const cardRule = cardIsThirdParty ? billingFor(selectedProvider, selectedModelId) : null
          const cardPriceIsPro = /pro/i.test(selectedModelId)
          const cardPrices = cardPriceIsPro ? PRO_PRICES : FLASH_PRICES
          const currentPeriodPrice = cardIsExternal ? null : (peakNow ? cardPrices.peak : cardPrices.off)
          const cardProps = {
            ref: cardRevealRef,
            className: 'dsub-side-card',
            role: 'status',
            'aria-label': t('aria.card'),
            'data-closing': config.balanceCard ? 'false' : 'true',
            style: geometry === null ? undefined : { top: geometry.top, height: geometry.height },
          }
          const card = geometry !== null && geometry.height > 20
            ? h('div', cardProps,
              h('div', { className: 'dsub-side-top' },
                cardIsThirdParty
                  ? null
                  : h('div', { className: 'dsub-side-balance' },
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
                        h('b', null, `-${formatMoney(display.previousAmount, display.previousCurrency || 'CNY')}`),
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
                        : h('b', null, display.currentAmount === null ? '--' : `-${formatMoney(display.currentAmount, display.currentCurrency || 'CNY')}`),
                    ),
                  )
                  : null,
              ),
              cardIsLocal
                ? h('div', { className: 'dsub-side-window dsub-side-window-local' },
                  h('span', {
                    className: 'dsub-side-window-state',
                    'data-local': 'true',
                  },
                    h('span', { className: 'dsub-side-window-dot', 'aria-hidden': 'true' }),
                    t('card.localModel')),
                  h('span', { className: 'dsub-side-window-price' },
                    h('span', { className: 'dsub-side-window-price-line' }, t('card.localFree'))),
                )
                : cardIsThirdParty
                  ? h('div', { className: 'dsub-side-window dsub-side-window-local dsub-side-window-third' },
                    h('span', {
                      className: 'dsub-side-window-state',
                      'data-flat': 'true',
                    },
                      h('span', { className: 'dsub-side-window-dot', 'aria-hidden': 'true' }),
                      t('card.unifiedPrice')),
                    h('span', { className: 'dsub-side-window-price' },
                      h('span', { className: 'dsub-side-window-price-line' },
                        `${t('card.input')} `,
                        h('b', null, cardRule === null ? '--' : formatMoney(cardRule.input, cardRule.currency, 2)),
                        ` ${t('card.perM')}`),
                      h('span', { className: 'dsub-side-window-price-line' },
                        `${t('card.output')} `,
                        h('b', null, cardRule === null ? '--' : formatMoney(cardRule.output, cardRule.currency, 2)),
                        ` ${t('card.perM')}`)),
                  )
                  : h('div', { className: 'dsub-side-window' },
                    h('span', {
                      className: 'dsub-side-window-state',
                      'data-peak': peakNow ? 'true' : 'false',
                    },
                      h('span', { className: 'dsub-side-window-dot', 'aria-hidden': 'true' }),
                      t(peakNow ? 'card.peak' : 'card.offPeak')),
                    h('span', { className: 'dsub-side-window-price' },
                      h('span', { className: 'dsub-side-window-price-line' },
                        `${t('card.input')} `,
                        h('b', null, formatMoney(currentPeriodPrice.miss, 'CNY', 2)),
                        ` ${t('card.perM')}`),
                      h('span', { className: 'dsub-side-window-price-line' },
                        `${t('card.output')} `,
                        h('b', null, formatMoney(currentPeriodPrice.out, 'CNY', 2)),
                        ` ${t('card.perM')}`)),
                  ),
              cardIsThirdParty
                ? h('div', { className: 'dsub-side-third-note' }, t('card.thirdNote'))
                : null,
            )
            : null

          return h(React.Fragment, null,
            h(Styles),
            h('div', { ref: anchorRef, className: 'dsub-side-anchor' }, card),
          )
        }

        // ---- Usage trajectory view -------------------------------------
        const UsageTrackView = ({ useProjection, useSessions, useWorkspaces, sessionId }) => {
          usePricingRevision()
          const config = useFeatureConfig()
          const live = useProjection('usageTrack')
          const modelSelection = useProjection('modelSelection')
          const sessionState = useSessions(snapshot => snapshot)
          const workspaceState = useWorkspaces(snapshot => snapshot)
          const locale = useLocaleId(ctx)
          const zhUser = String(locale || '').toLowerCase().startsWith('zh')
          const [cached, setCached] = useState(() => collected.get(sessionId))
          const [clock, setClock] = useState(() => Date.now())
          const revealRef = useRef(null)

          // A view can be mounted before the background full collection has
          // filled the cache (for example after a quick enable/disable).
          // Re-run the full pass once rather than showing a half-filled ledger.
          useEffect(() => {
            if (config.usageTrajectory && collected.size === 0) void collectAllSessions()
          }, [config.usageTrajectory])

          useEffect(() => {
            if (Array.isArray(live) && live.length > 0) {
              const value = normalizeTurns(live)
              collected.set(sessionId, value)
              setCached(value)
            } else if (!Array.isArray(live)) {
              setCached(collected.get(sessionId))
            }
          }, [live, sessionId])

          const turns = useMemo(() => {
            const source = Array.isArray(live) && live.length > 0 ? live : (cached || EMPTY_TURNS)
            return normalizeTurns(source)
          }, [live, cached])
          useRevealOnScroll(revealRef, [turns, sessionId])

          const anyRunning = turns.some(turn => turn.endedAt === null || turn.endedAt === undefined)
          useEffect(() => {
            if (!anyRunning) return undefined
            const timer = window.setInterval(() => { setClock(Date.now()) }, 1_000)
            return () => { window.clearInterval(timer) }
          }, [anyRunning])

          const billableTurns = useMemo(() => turns.filter(turn => !isLocalTurn(turn)), [turns])
          const localTurnCount = turns.length - billableTurns.length

          const totals = useMemo(() => {
            let total = 0
            let cost = 0
            let priced = false
            for (const turn of billableTurns) {
              total += totalTokens(turn)
              const value = turnCost(turn)
              if (value !== null) {
                cost += value
                priced = true
              }
            }
            return { total, cost, priced }
          }, [billableTurns])

          const workspace = useMemo(() => {
            const items = workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : []
            return items.find(item => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId))
          }, [workspaceState, sessionId])
          const workspaceSessionIds = workspace ? workspace.sessionIds : [sessionId]
          const visibleWorkspaceIds = workspaceSessionIds.filter(id => {
            const row = sessionState?.byId?.[id]
            return row === undefined || row.blank !== true
          })
          const workspaceIds = [...new Set(visibleWorkspaceIds.length > 0 ? visibleWorkspaceIds : [sessionId])]
          const workspaceKey = workspaceIds.join('|')
          const workspaceTurns = useMemo(() => {
            const result = []
            for (const id of workspaceIds) {
              const source = id === sessionId
                ? turns
                : (sessionState?.projectionsBySession?.[id]?.values?.usageTrack
                  ?? collected.get(id)
                  ?? EMPTY_TURNS)
              if (Array.isArray(source)) result.push(...normalizeTurns(source))
            }
            return result
          }, [workspaceKey, turns, sessionId, sessionState])

          const currentAverage = useMemo(() => {
            let prompt = 0
            let cacheRead = 0
            for (const turn of billableTurns) {
              prompt += promptTokens(turn)
              cacheRead += num(turn.cacheRead)
            }
            return prompt === 0 ? null : cacheRead / prompt * 100
          }, [billableTurns])

          const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null
          const lastTurnKey = lastTurn ? `${lastTurn.turn}:${lastTurn.endedAt ?? 'running'}` : ''
          const selectedRoute = modelSelection && typeof modelSelection === 'object'
            ? (modelSelection.next ?? modelSelection.lastUsed ?? null)
            : null
          const currentModelId = String(selectedRoute && selectedRoute.model || lastTurn && lastTurn.model || '')
          const currentProvider = String(selectedRoute && selectedRoute.provider || lastTurn && lastTurn.provider || '')
          const currentIsLocal = currentModelId !== '' && isLocalRoute(currentProvider, currentModelId)
          const currentIsThirdParty = currentModelId !== '' && isThirdPartyRoute(currentProvider, currentModelId)
          const currentIsExternal = currentIsLocal || currentIsThirdParty
          const currentModelIsPro = /pro/i.test(currentModelId)
          const currentIsFlash = currentModelId === '' || /flash/i.test(currentModelId)
          const versionModel = currentIsExternal
            ? (lastTurn && isOfficialRoute(lastTurn.provider, lastTurn.model) ? lastTurn.model : '')
            : currentModelId
          const versionMatch = String(versionModel || '')
            .match(/(?:^|[-_])v?(\d+(?:\.\d+)?)(?:[-_]|$)/i)
          const priceVersion = `${versionMatch ? `V${versionMatch[1]}` : 'V4.1'} · ${PRICING_DATE}`
          const priceCatalogLabel = pricingStatus.source === 'remote'
            ? `${t('billing.catalogRemote')} ${pricingStatus.version}`
            : pricingStatus.source === 'cache'
              ? `${t('billing.catalogCache')} ${pricingStatus.version}`
              : `${t('billing.catalogBuiltin')} ${pricingStatus.version}`
          const priceCatalogNote = pricingStatus.error
            ? `${priceCatalogLabel} · ${t('billing.catalogFailed')}`
            : priceCatalogLabel
          const flashCurrent = !currentIsExternal && !currentModelIsPro && currentIsFlash
          const proCurrent = !currentIsExternal && currentModelIsPro

          const groupRoutes = (source, predicate) => {
            const groups = new Map()
            for (const turn of source) {
              if (!predicate(turn)) continue
              const provider = String(turn.provider || '')
              const model = String(turn.model || '')
              const key = `${provider}|${model}`
              let group = groups.get(key)
              if (group === undefined) {
                group = {
                  key,
                  label: modelLabel(model || '—', provider || ''),
                  provider,
                  model,
                  tokens: 0,
                  turns: 0,
                  cost: 0,
                  priced: false,
                }
                groups.set(key, group)
              }
              group.tokens += totalTokens(turn)
              group.turns += 1
              const value = turnCost(turn)
              if (value !== null) {
                group.cost += value
                group.priced = true
              }
            }
            return [...groups.values()].sort((left, right) => right.tokens - left.tokens)
          }
          const mergeScopeGroups = (currentGroups, workspaceGroups) => {
            const merged = new Map()
            for (const group of currentGroups) {
              merged.set(group.key, {
                key: group.key,
                label: group.label,
                provider: group.provider,
                model: group.model,
                current: group,
                workspace: null,
              })
            }
            for (const group of workspaceGroups) {
              const existing = merged.get(group.key)
              if (existing === undefined) {
                merged.set(group.key, {
                  key: group.key,
                  label: group.label,
                  provider: group.provider,
                  model: group.model,
                  current: null,
                  workspace: group,
                })
              } else {
                existing.workspace = group
              }
            }
            return [...merged.values()].sort((left, right) => {
              const leftTokens = (left.current?.tokens ?? 0) + (left.workspace?.tokens ?? 0)
              const rightTokens = (right.current?.tokens ?? 0) + (right.workspace?.tokens ?? 0)
              return rightTokens - leftTokens
            })
          }
          const localGroups = useMemo(() => mergeScopeGroups(
            groupRoutes(turns, isLocalTurn),
            groupRoutes(workspaceTurns, isLocalTurn),
          ), [turns, workspaceTurns])
          const thirdPartyGroups = useMemo(() => mergeScopeGroups(
            groupRoutes(turns, isThirdPartyTurn),
            groupRoutes(workspaceTurns, isThirdPartyTurn),
          ), [turns, workspaceTurns])

          // Opening the view, switching workspace, and finishing a turn all
          // refresh the *other* Sessions in this workspace. The current
          // Session already updates from its live projection.
          useEffect(() => {
            if (!config.usageTrajectory) return undefined
            for (const id of workspaceIds) {
              if (id === sessionId) continue
              void collectSession(id, collectGeneration)
            }
            return undefined
          }, [workspaceKey, sessionId, config.usageTrajectory, lastTurnKey])

          const header = h('header', { className: 'dsub-view-head' },
            h('div', { className: 'dsub-view-title' },
              h('h2', null, t('view.title')),
              h('p', null, t('view.subtitle')),
            ),
          )


          const currentCard = h('section', {
            className: 'dsub-workspace dsub-current-card',
            'aria-label': t('current.label'),
          },
            h('div', { className: 'dsub-workspace-head' },
              h('div', { className: 'dsub-workspace-title' },
                h('span', null, t('current.label')),
                h('span', { className: 'dsub-scope dsub-scope-current' }, t('current.scope')),
              ),
              h('div', { className: 'dsub-workspace-chips' },
                h('span', { className: 'dsub-workspace-chip' },
                  h('span', null, t('workspace.turns')),
                  h('b', null, String(turns.length))),
                h('span', { className: 'dsub-workspace-chip' },
                  h('span', null, t('workspace.tokens')),
                  h('b', null, billableTurns.length === 0 ? '--' : formatTokenCount(totals.total, zhUser))),
                h('span', { className: 'dsub-workspace-chip' },
                  h('span', null, t('workspace.cost')),
                  h('b', null, totals.priced ? formatMoney(totals.cost, 'CNY') : '--')),
                localTurnCount > 0
                  ? h('span', { className: 'dsub-workspace-chip dsub-local-chip' },
                    h('span', null, t('workspace.local')),
                    h('b', null, String(localTurnCount)),
                    h('em', null, t('workspace.free')))
                  : null,
              ),
            ),
            h('div', { className: 'dsub-workspace-current' },
              h('span', null, t('current.average')),
              h('b', null, currentAverage === null ? '--' : `${currentAverage.toFixed(1)}%`),
            ),
          )

          const billingText = rule => {
            const prices = []
            if (rule.input !== undefined) prices.push(`${t('billing.input')} ${formatMoney(rule.input, rule.currency, 2)}`)
            if (rule.cached !== undefined) prices.push(`${t('billing.cached')} ${formatMoney(rule.cached, rule.currency, 2)}`)
            if (rule.cacheWrite !== undefined) prices.push(`${t('billing.cacheWrite')} ${formatMoney(rule.cacheWrite, rule.currency, 2)}`)
            if (rule.output !== undefined) prices.push(`${t('billing.output')} ${formatMoney(rule.output, rule.currency, 2)}`)
            const peakOff = rule.mode === 'flat'
              ? t('billing.flatPrice')
              : `${t('billing.peak')} / ${t('billing.off')}`
            return `${rule.name} · ${t('billing.reference')} ${prices.join(' / ')} · ${t('billing.perM')} · ${peakOff} · ${t('billing.updated')} ${pricingStatus.version}`
          }

          const splitRow = (group, local) => {
            const scopeText = scope => {
              if (scope === null || scope === undefined) return '—'
              const parts = [
                `${formatTokenCount(scope.tokens, zhUser)} ${t('split.tokens')}`,
                `${scope.turns} ${t('split.turns')}`,
              ]
              parts.push(local
                ? t('split.free')
                : scope.priced ? formatMoney(scope.cost, 'CNY') : t('split.unknownCost'))
              return parts.join(' · ')
            }
            const billing = local ? null : billingFor(group.provider, group.model)
            return h('div', {
              key: `${local ? 'local' : 'third'}:${group.key}`,
              className: 'dsub-split-item',
            },
              h('div', {
                className: 'dsub-split-row',
                'data-local': local ? 'true' : 'false',
              },
                h('b', { className: 'dsub-split-name' }, h(ModelName, { provider: group.provider, model: group.model })),
                h('span', { className: 'dsub-split-metric' }, scopeText(group.current)),
                h('span', { className: 'dsub-split-metric' }, scopeText(group.workspace)),
                h('em', { className: 'dsub-split-included' }, local ? t('split.free') : t('split.included')),
              ),
              local ? null : h('div', { className: 'dsub-split-billing' },
                billing === null ? t('billing.unknown') : billingText(billing)),
            )
          }

          const hasSplit = localGroups.length > 0 || thirdPartyGroups.length > 0
          const modelSplit = hasSplit
            ? h('section', { className: 'dsub-model-split' },
              h('div', { className: 'dsub-split-head' },
                h('h3', null, t('split.title')),
                h('p', null, t('split.subtitle')),
              ),
              h('div', { className: 'dsub-split-row dsub-split-header' },
                h('span', null, t('split.model')),
                h('span', null, t('split.current')),
                h('span', null, t('split.workspace')),
                h('span', null, t('split.tag')),
              ),
              localGroups.length > 0
                ? h('div', { className: 'dsub-split-group' },
                  h('h4', { className: 'dsub-split-local-title' }, t('split.local')),
                  localGroups.map(group => splitRow(group, true)))
                : null,
              thirdPartyGroups.length > 0
                ? h('div', { className: 'dsub-split-group' },
                  h('h4', { className: 'dsub-split-third-title' }, t('split.third')),
                  thirdPartyGroups.map(group => splitRow(group, false)))
                : null,
              h('details', {
                className: 'dsub-rules',
                open: true,
              },
                h('summary', null, t('split.rules')),
                h('ul', null,
                  h('li', null, t('split.rule1')),
                  h('li', null, t('split.rule2')),
                  h('li', null, t('split.rule3')),
                  h('li', null, t('split.rule4')),
                  h('li', null, t('split.rule5')),
                ),
              ),
            )
            : null

          const priceCell = table => h('span', { className: 'dsub-price-cell' },
            h('b', null, formatMoney(table.hit, 'CNY', 2)),
            h('i', null, ' / '),
            h('b', null, formatMoney(table.miss, 'CNY', 2)),
            h('i', null, ' / '),
            h('b', null, formatMoney(table.out, 'CNY', 2)),
          )
          const priceGrid = (label, table, current) => h('div', {
            className: 'dsub-price-grid',
            'data-current': current ? 'true' : 'false',
          },
            h('span', { className: 'dsub-price-model' },
              label,
              current ? h('em', null, t('price.current')) : null),
            priceCell(table.peak),
            priceCell(table.off),
          )

          const priceRow = h('div', { className: 'dsub-price-table' },
            h('div', { className: 'dsub-price-head' },
              h('span', null, t('price.title')),
              h('span', { className: 'dsub-price-official' }, t('price.official')),
              h('span', { className: 'dsub-price-catalog' }, priceCatalogNote),
              h('span', { className: 'dsub-price-version' }, `${t('price.version')} ${priceVersion}`),
            ),
            h('div', { className: 'dsub-price-grid dsub-price-grid-head' },
              h('span', null, t('price.model')),
              h('span', null, t('price.peak')),
              h('span', null, t('price.off')),
            ),
            priceGrid('Flash', FLASH_PRICES, flashCurrent),
            priceGrid('Pro', PRO_PRICES, proCurrent),
            h('div', { className: 'dsub-price-grid dsub-price-grid-foot' },
              h('span', null, ''),
              h('span', { className: 'dsub-price-foot' }, `${t('price.legend')} · ${t('price.perM')}`),
              h('span', { className: 'dsub-price-foot' }, `${t('price.legend')} · ${t('price.perM')}`),
            ),
            currentIsExternal
              ? h('div', { className: 'dsub-price-local' },
                h('span', { className: 'dsub-price-local-label' }, currentIsLocal ? t('price.local') : t('price.thirdParty')),
                h(ModelName, { provider: currentProvider || 'deepseek', model: currentModelId || 'deepseek-flash', className: 'dsub-price-local-name' }),
                h('em', { className: 'dsub-price-local-current' }, t('price.current')),
                h('span', { className: 'dsub-price-local-note' }, currentIsLocal ? t('price.localNote') : t('price.thirdPartyNote')),
              )
              : null,
          )

          const tableHead = h('div', { className: 'dsub-row dsub-table-head' },
            h('span', null, t('table.turn')),
            h('span', null, t('table.started')),
            h('span', null, t('table.duration')),
            h('span', null, t('table.total')),
            h('span', null, t('table.cost')),
            h('span', null, t('table.peak')),
            h('span', null, t('table.status')),
          )

          if (!config.usageTrajectory) return null

          if (turns.length === 0) {
            return h('div', {
              className: 'dsub-view',
              'data-conversation-composer-overlay': '',
              'aria-label': t('aria.ledger'),
            },
              h(Styles),
              h('div', { ref: revealRef, className: 'dsub-scroll' },
                header,
                currentCard,
                modelSplit,
                priceRow,
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
            h('div', { ref: revealRef, className: 'dsub-scroll' },
              header,
              currentCard,
              modelSplit,
              h('div', { className: 'dsub-sticky-head' },
                priceRow,
                tableHead,
              ),
              h('div', { className: 'dsub-table' },
                turns.map(turn => {
                  const started = turn.startedAt
                  const ended = turn.endedAt
                  const running = ended === null || ended === undefined
                  const duration = started === null || started === undefined
                    ? null
                    : Math.max(0, (running ? clock : ended) - started)
                  const total = totalTokens(turn)
                  const prompt = promptTokens(turn)
                  const hit = num(turn.cacheRead)
                  const miss = num(turn.input) + num(turn.cacheWrite)
                  const hitPercent = prompt === 0 ? 0 : hit / prompt * 100
                  const missPercent = prompt === 0 ? 0 : miss / prompt * 100
                  const rate = cacheHitRate(turn)
                  const local = isLocalTurn(turn)
                  const flat = isThirdPartyTurn(turn)
                  const failed = !running && turn.status === 'error'
                  const peak = !failed && !local && !flat && isPeak(started)
                  const cost = cardCostInfo(turn, sessionId)
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
                        h('span', { title: turn.model || '' }, h(ModelName, { provider: turn.provider, model: turn.model })),
                        local ? h('em', { className: 'dsub-local-tag' }, t('peak.local')) : null,
                      ),
                      h('div', { className: 'dsub-cell dsub-time', title: formatFullTime(started, zhUser) },
                        h('b', null, formatClock(started, zhUser)),
                        h('span', null, formatDay(started, zhUser) || '—'),
                      ),
                      h('div', { className: 'dsub-cell' }, formatDuration(duration)),
                      h('div', { className: 'dsub-cell', title: `${formatInteger(total)} ${t('table.total')}` }, formatTokenCount(total, zhUser)),
                      h('div', { className: 'dsub-cell dsub-cost' }, cost === null ? '--' : formatMoney(cost.amount, cost.currency)),
                      h('div', { className: 'dsub-cell' },
                        h('span', { className: 'dsub-peak', 'data-peak': peak ? 'true' : 'false', 'data-local': local ? 'true' : 'false', 'data-flat': flat ? 'true' : 'false', 'data-error': failed ? 'true' : 'false' },
                          failed ? t('peak.error') : local ? t('peak.local') : flat ? t('peak.flat') : peak ? t('peak.on') : t('peak.off'))),
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
                        h(RevealBar, { className: 'dsub-bar dsub-bar-hit', fill: hitPercent }),
                      ),
                      h('div', null,
                        h('div', { className: 'dsub-metric-top' },
                          h('span', { className: 'dsub-metric-name' }, t('metric.miss')),
                          h('span', { className: 'dsub-metric-value' },
                            `${formatTokenCount(miss, zhUser)}`,
                            h('em', null, `${missPercent.toFixed(1)}% ${t('metric.share')}`)),
                        ),
                        h(RevealBar, { className: 'dsub-bar dsub-bar-miss', fill: missPercent }),
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

        // ---- Standalone overview view ---------------------------------
        const UsageOverviewView = ({ useSessions, useWorkspaces }) => {
          usePricingRevision()
          const collectionRevision = useCollectionRevision()
          const config = useFeatureConfig()
          const sessionState = useSessions(snapshot => snapshot)
          const workspaceState = useWorkspaces(snapshot => snapshot)
          const locale = useLocaleId(ctx)
          const zhUser = String(locale || '').toLowerCase().startsWith('zh')
          const [range, setRange] = useState('today')
          const [customStart, setCustomStart] = useState('')
          const [customEnd, setCustomEnd] = useState('')
          const [workspaceFilter, setWorkspaceFilter] = useState('all')
          const [modelFilter, setModelFilter] = useState('all')
          const [clock, setClock] = useState(() => Date.now())
          const [hoverIndex, setHoverIndex] = useState(null)
          const [selectedIndex, setSelectedIndex] = useState(null)
          const [pricingOpen, setPricingOpen] = useState(false)
          const [pricingEditMode, setPricingEditMode] = useState(false)
          const [pricingText, setPricingText] = useState('')
          const [pricingError, setPricingError] = useState('')
          const tooltipRef = useRef(null)
          const hoverBarRef = useRef(null)
          const pointerRef = useRef(null)
          const lastHoverRef = useRef(null)
          const frameRef = useRef(0)
          const overviewRevealRef = useRef(null)

          useEffect(() => {
            setHoverIndex(null)
            setSelectedIndex(null)
            pointerRef.current = null
            lastHoverRef.current = null
          }, [range])

          useEffect(() => {
            if (config.usageOverview && collected.size === 0) void collectAllSessions()
          }, [config.usageOverview])
          useEffect(() => {
            const timer = window.setInterval(() => { setClock(Date.now()) }, 60_000)
            return () => { window.clearInterval(timer) }
          }, [])

          const overview = useMemo(() => {
            const now = new Date(clock)
            const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
            const daysAgoStart = days => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime()
            const parseLocalDate = value => {
              const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
              if (match === null) return null
              const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
              return Number.isFinite(date.getTime()) ? date.getTime() : null
            }
            const customStartMs = parseLocalDate(customStart)
            const customEndMs = parseLocalDate(customEnd)
            const start = range === 'today'
              ? dayStart
              : range === 'month'
                ? monthStart
                : range === '7d'
                  ? daysAgoStart(6)
                  : range === '30d'
                    ? daysAgoStart(29)
                    : range === '90d'
                      ? daysAgoStart(89)
                      : range === 'custom'
                        ? (customStartMs ?? dayStart)
                        : 0
            const end = range === 'custom' && customEndMs !== null
              ? customEndMs + 86_400_000
              : Number.POSITIVE_INFINITY
            const allEntries = []
            const workspaceItems = workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : []
            const sessionWorkspace = new Map()
            for (const item of workspaceItems) {
              if (!item || !Array.isArray(item.sessionIds)) continue
              for (const id of item.sessionIds) sessionWorkspace.set(id, item.workspaceId)
            }

            for (const [sessionId, turns] of collected) {
              for (const turn of turns) {
                const at = Number(turn.startedAt)
                if (!Number.isFinite(at) || at < start || at >= end) continue
                const providerName = String(turn.provider ?? '').trim()
                const modelName = String(turn.model ?? '').trim()
                const hasRoute = providerName !== '' || modelName !== ''
                const category = isLocalTurn(turn) ? 'local' : (hasRoute && isThirdPartyTurn(turn)) ? 'third' : 'official'
                let cost = null
                if (category === 'official') {
                  const amount = walletCost(turn)
                  if (amount !== null) cost = { amount, currency: 'CNY' }
                } else if (category === 'third') {
                  cost = quoteForTurn(sessionId, turn)
                  if (cost === null) {
                    const rule = billingFor(turn.provider, turn.model)
                    const amount = rule === null ? null : thirdPartyCost(turn)
                    if (amount !== null) cost = { amount, currency: rule.currency }
                    else if (Number.isFinite(Number(turn.cost))) cost = { amount: Number(turn.cost), currency: 'CNY' }
                  }
                }
                const date = new Date(at)
                allEntries.push({
                  at,
                  category,
                  tokens: totalTokens(turn),
                  input: num(turn.input),
                  output: num(turn.output),
                  cacheRead: num(turn.cacheRead),
                  cacheWrite: num(turn.cacheWrite),
                  provider: providerName,
                  model: modelName,
                  modelKey: modelName === '' ? '' : JSON.stringify([providerName, modelName]),
                  cost,
                  workspaceId: sessionWorkspace.get(sessionId) ?? null,
                  dayKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                  monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
                  hour: date.getHours(),
                })
              }
            }

            const modelOptions = []
            const modelOptionKeys = new Set()
            for (const entry of allEntries) {
              if (entry.modelKey === '' || modelOptionKeys.has(entry.modelKey)) continue
              modelOptionKeys.add(entry.modelKey)
              modelOptions.push({ key: entry.modelKey, name: entry.model, provider: entry.provider, model: entry.model })
            }
            modelOptions.sort((left, right) => left.name.localeCompare(right.name))
            const entries = allEntries.filter(entry => (
              (workspaceFilter === 'all' || entry.workspaceId === workspaceFilter)
              && (modelFilter === 'all' || entry.modelKey === modelFilter)
            ))

            const summary = {
              tokens: 0,
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              turns: entries.length,
              localTurns: 0,
              cny: 0,
              usd: 0,
            }
            for (const entry of entries) {
              summary.tokens += entry.tokens
              summary.input += entry.input
              summary.output += entry.output
              summary.cacheRead += entry.cacheRead
              summary.cacheWrite += entry.cacheWrite
              if (entry.category === 'local') summary.localTurns += 1
              if (entry.cost !== null && entry.cost.currency === 'CNY') summary.cny += entry.cost.amount
              if (entry.cost !== null && entry.cost.currency === 'USD') summary.usd += entry.cost.amount
            }

            const workspaceSummaries = []
            const workspaceMap = new Map()
            for (const item of workspaceItems) {
              if (!item) continue
              if (workspaceFilter !== 'all' && item.workspaceId !== workspaceFilter) continue
              const sessionIds = Array.isArray(item.sessionIds)
                ? item.sessionIds.filter(id => sessionState?.byId?.[id]?.blank !== true)
                : []
              const workspaceSummary = {
                id: item.workspaceId,
                name: item.title === 'default-workspace'
                  ? t('workspace.default')
                  : (String(item.title ?? '').trim() || t('workspace.ungrouped')),
                sessions: sessionIds.length,
                tokens: 0,
                turns: 0,
                localTurns: 0,
                cny: 0,
                usd: 0,
              }
              workspaceMap.set(item.workspaceId, workspaceSummary)
              workspaceSummaries.push(workspaceSummary)
            }
            for (const entry of entries) {
              const workspaceSummary = workspaceMap.get(entry.workspaceId)
              if (workspaceSummary === undefined) continue
              workspaceSummary.tokens += entry.tokens
              workspaceSummary.turns += 1
              if (entry.category === 'local') workspaceSummary.localTurns += 1
              if (entry.cost !== null && entry.cost.currency === 'CNY') workspaceSummary.cny += entry.cost.amount
              if (entry.cost !== null && entry.cost.currency === 'USD') workspaceSummary.usd += entry.cost.amount
            }

            const modelSummaries = []
            const modelMap = new Map()
            for (const entry of entries) {
              const modelName = String(entry.model ?? '').trim()
              if (modelName === '' || modelName.toLowerCase() === 'unknown') continue
              const key = `${entry.provider}\u0000${modelName}\u0000${entry.category}`
              let modelSummary = modelMap.get(key)
              if (modelSummary === undefined) {
                modelSummary = {
                  key,
                  name: modelName,
                  provider: entry.provider,
                  category: entry.category,
                  tokens: 0,
                  turns: 0,
                  cny: 0,
                  usd: 0,
                }
                modelMap.set(key, modelSummary)
                modelSummaries.push(modelSummary)
              }
              modelSummary.tokens += entry.tokens
              modelSummary.turns += 1
              if (entry.cost !== null && entry.cost.currency === 'CNY') modelSummary.cny += entry.cost.amount
              if (entry.cost !== null && entry.cost.currency === 'USD') modelSummary.usd += entry.cost.amount
            }
            modelSummaries.sort((left, right) => right.tokens - left.tokens)
            const emptyCosts = () => ({
              official: { CNY: 0, USD: 0 },
              third: { CNY: 0, USD: 0 },
              local: { CNY: 0, USD: 0 },
            })
            const addToBucket = (bucket, entry) => {
              bucket[entry.category] += entry.tokens
              bucket.total += entry.tokens
              if (entry.model !== '') {
                const modelKey = entry.modelKey || `${entry.provider}\u0000${entry.model}`
                let model = bucket.models[modelKey]
                if (model === undefined) {
                  model = { key: modelKey, provider: entry.provider, model: entry.model, tokens: 0 }
                  bucket.models[modelKey] = model
                }
                model.tokens += entry.tokens
              }
              if (entry.cost !== null) {
                if (entry.cost.currency === 'CNY') {
                  bucket.cny += entry.cost.amount
                  bucket.costs[entry.category].CNY += entry.cost.amount
                }
                if (entry.cost.currency === 'USD') {
                  bucket.usd += entry.cost.amount
                  bucket.costs[entry.category].USD += entry.cost.amount
                }
              }
            }
            let chart = []

            if (range === 'today') {
              chart = Array.from({ length: 24 }, (_, hour) => ({
                key: `h${hour}`,
                label: hour % 4 === 0 ? `${String(hour).padStart(2, '0')}:00` : '',
                fullLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00`,
                hour,
                official: 0,
                third: 0,
                local: 0,
                total: 0,
                cny: 0,
                usd: 0,
                costs: emptyCosts(),
                models: {},
              }))
              for (const entry of entries) addToBucket(chart[entry.hour], entry)
            } else if (range === 'month') {
              const days = now.getDate()
              chart = Array.from({ length: days }, (_, index) => {
                const day = index + 1
                const date = new Date(now.getFullYear(), now.getMonth(), day)
                return {
                  key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                  label: days > 16 && day % 5 !== 1 ? '' : `${day}`,
                  fullLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                  date,
                  official: 0,
                  third: 0,
                  local: 0,
                  total: 0,
                  cny: 0,
                  usd: 0,
                  costs: emptyCosts(),
                  models: {},
                }
              })
              const byDay = new Map(chart.map(bucket => [bucket.key, bucket]))
              for (const entry of entries) {
                const bucket = byDay.get(entry.dayKey)
                if (bucket !== undefined) addToBucket(bucket, entry)
              }
            } else if (entries.length > 0) {
              const times = entries.map(entry => entry.at).sort((left, right) => left - right)
              const first = new Date(times[0])
              const last = new Date(times[times.length - 1])
              const spanDays = Math.floor((last.getTime() - first.getTime()) / 86_400_000)
              if (spanDays > 90) {
                const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
                const end = new Date(last.getFullYear(), last.getMonth(), 1)
                while (cursor.getTime() <= end.getTime()) {
                  const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
                  chart.push({
                    key,
                    label: cursor.getMonth() === 0 ? `${cursor.getFullYear()}` : `${cursor.getMonth() + 1}月`,
                    fullLabel: key,
                    official: 0,
                    third: 0,
                    local: 0,
                    total: 0,
                    cny: 0,
                    usd: 0,
                    costs: emptyCosts(),
                    models: {},
                  })
                  cursor.setMonth(cursor.getMonth() + 1)
                }
                const byMonth = new Map(chart.map(bucket => [bucket.key, bucket]))
                for (const entry of entries) {
                  const bucket = byMonth.get(entry.monthKey)
                  if (bucket !== undefined) addToBucket(bucket, entry)
                }
              } else {
                const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate())
                const end = new Date(last.getFullYear(), last.getMonth(), last.getDate())
                while (cursor.getTime() <= end.getTime()) {
                  const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
                  chart.push({
                    key,
                    label: chart.length % 5 === 0 ? `${cursor.getMonth() + 1}/${cursor.getDate()}` : '',
                    fullLabel: key,
                    official: 0,
                    third: 0,
                    local: 0,
                    total: 0,
                    cny: 0,
                    usd: 0,
                    costs: emptyCosts(),
                    models: {},
                  })
                  cursor.setDate(cursor.getDate() + 1)
                }
                const byDay = new Map(chart.map(bucket => [bucket.key, bucket]))
                for (const entry of entries) {
                  const bucket = byDay.get(entry.dayKey)
                  if (bucket !== undefined) addToBucket(bucket, entry)
                }
              }
            }

            if (range !== 'today') {
              for (const bucket of chart) {
                if (bucket.total <= 0) {
                  bucket.label = ''
                } else if (bucket.key.length === 7) {
                  bucket.label = bucket.key.replace('-', '/')
                } else {
                  const [, month, day] = bucket.key.split('-')
                  bucket.label = `${Number(month)}/${Number(day)}`
                }
              }
            }

            return { entries, summary, chart, workspaceSummaries, modelSummaries, modelOptions }
          }, [collectionRevision, clock, range, customStart, customEnd, workspaceFilter, modelFilter, pricingStatus.version, zhUser, workspaceState, sessionState])

          useRevealOnScroll(overviewRevealRef, [overview.chart, range, workspaceFilter, modelFilter])

          useEffect(() => {
            if (modelFilter !== 'all' && !overview.modelOptions.some(option => option.key === modelFilter)) {
              setModelFilter('all')
            }
          }, [overview.modelOptions, modelFilter])

          useEffect(() => {
            const items = workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : []
            if (workspaceFilter !== 'all' && !items.some(item => item && item.workspaceId === workspaceFilter)) {
              setWorkspaceFilter('all')
            }
          }, [workspaceState, workspaceFilter])

          const workspaceNameById = new Map()
          for (const item of (workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : [])) {
            if (!item) continue
            workspaceNameById.set(item.workspaceId, item.title === 'default-workspace'
              ? t('workspace.default')
              : (String(item.title ?? '').trim() || t('workspace.ungrouped')))
          }

          const exportMetric = value => {
            const number = Number(value)
            if (!Number.isFinite(number) || number === 0) return '0'
            const absolute = Math.abs(number)
            const [divisor, unit] = absolute >= 100_000_000
              ? [100_000_000, '亿']
              : absolute >= 10_000
                ? [10_000, '万']
                : absolute >= 1_000
                  ? [1_000, '千']
                  : [1, '']
            if (unit === '') return String(Math.round(number))
            const scaled = Math.round((number / divisor) * 10_000) / 10_000
            return `${Math.round(number)} (${String(scaled).replace(/\.?0+$/, '')}${unit})`
          }

          const exportCsv = () => {
            const csvCell = value => {
              const text = String(value ?? '')
              return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
            }
            const rows = [zhUser
              ? ['时间', '分类', '供应商', '模型', '工作区', 'Token', '输入', '缓存读', '缓存写', '输出', '费用', '货币']
              : ['time', 'category', 'provider', 'model', 'workspace', 'tokens', 'input', 'cacheRead', 'cacheWrite', 'output', 'cost', 'currency']]
            for (const entry of overview.entries) {
              rows.push([
                new Date(entry.at).toISOString(),
                entry.category,
                entry.provider,
                modelLabel(entry.model, entry.provider),
                entry.workspaceId === null ? '' : (workspaceNameById.get(entry.workspaceId) ?? ''),
                exportMetric(entry.tokens),
                exportMetric(entry.input),
                exportMetric(entry.cacheRead),
                exportMetric(entry.cacheWrite),
                exportMetric(entry.output),
                entry.cost === null ? '' : entry.cost.amount,
                entry.cost === null ? '' : entry.cost.currency,
              ])
            }
            const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `dsh-usage-${range}-${Date.now()}.csv`
            anchor.style.display = 'none'
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          }

          // CSV cannot carry column widths. The Excel export uses SpreadsheetML
          // so WPS/Excel opens with readable columns instead of the default
          // eight-character width.
          const exportExcel = () => {
            const esc = value => String(value ?? '')
              .replaceAll('&', '&amp;')
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;')
              .replaceAll('"', '&quot;')
            const header = zhUser
              ? ['时间', '分类', '供应商', '模型', '工作区', 'Token', '输入', '缓存读', '缓存写', '输出', '费用', '货币']
              : ['time', 'category', 'provider', 'model', 'workspace', 'tokens', 'input', 'cacheRead', 'cacheWrite', 'output', 'cost', 'currency']
            const widths = [220, 90, 150, 230, 190, 180, 170, 185, 185, 170, 120, 80]
            const rows = [header]
            for (const entry of overview.entries) {
              rows.push([
                new Date(entry.at).toISOString(),
                entry.category,
                entry.provider,
                modelLabel(entry.model, entry.provider),
                entry.workspaceId === null ? '' : (workspaceNameById.get(entry.workspaceId) ?? ''),
                exportMetric(entry.tokens),
                exportMetric(entry.input),
                exportMetric(entry.cacheRead),
                exportMetric(entry.cacheWrite),
                exportMetric(entry.output),
                entry.cost === null ? '' : entry.cost.amount,
                entry.cost === null ? '' : entry.cost.currency,
              ])
            }
            const cell = (value, rowIndex) => {
              const style = rowIndex === 0 ? 'header' : 'cell'
              if (value === '') return `<Cell ss:StyleID="${style}"/>`
              const numeric = typeof value === 'number'
              return `<Cell ss:StyleID="${style}"><Data ss:Type="${numeric ? 'Number' : 'String'}">${esc(value)}</Data></Cell>`
            }
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:FontName="Microsoft YaHei" ss:Size="12" ss:Bold="1"/><Interior ss:Color="#E8EAED" ss:Pattern="Solid"/></Style>
    <Style ss:ID="cell"><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Font ss:FontName="Microsoft YaHei" ss:Size="12"/></Style>
  </Styles>
  <Worksheet ss:Name="Usage"><Table>
${widths.map(width => `    <Column ss:Width="${width}"/>`).join('\n')}
${rows.map((row, rowIndex) => `    <Row ss:Height="${rowIndex === 0 ? 30 : 28}">${row.map(value => cell(value, rowIndex)).join('')}</Row>`).join('\n')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
    <FreezePanes/>
    <FrozenNoSplit/>
    <SplitHorizontal>1</SplitHorizontal>
    <TopRowBottomPane>1</TopRowBottomPane>
    <ActivePane>2</ActivePane>
  </WorksheetOptions>
</Worksheet>
</Workbook>`
            const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `dsh-usage-${range}-${Date.now()}.xls`
            anchor.style.display = 'none'
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          }

          const openPricingEditor = () => {
            loadPricingOverride()
            setPricingText(JSON.stringify({ models: pricingOverride ?? billingCatalog }, null, 2))
            setPricingError('')
            setPricingEditMode(false)
            setPricingOpen(true)
          }
          const beginPricingEdit = () => {
            loadPricingOverride()
            setPricingText(JSON.stringify({ models: pricingOverride ?? billingCatalog }, null, 2))
            setPricingError('')
            setPricingEditMode(true)
          }
          const savePricingEditor = () => {
            try {
              const parsed = JSON.parse(pricingText)
              const models = Array.isArray(parsed) ? parsed : parsed && parsed.models
              if (!setPricingOverride(models)) throw new Error('invalid')
              setPricingError('')
              setPricingEditMode(false)
              setPricingOpen(false)
            } catch (_error) {
              setPricingError(t('overview.invalidPricing'))
            }
          }
          const resetPricingEditor = () => {
            setPricingOverride([])
            setPricingText(JSON.stringify({ models: billingCatalog }, null, 2))
            setPricingError('')
          }
          const pricingRows = pricingOverride ?? billingCatalog
          const priceValue = value => {
            const number = Number(value)
            return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'
          }

          const tokenTotal = overview.summary.tokens
          const tokenParts = [
            { kind: 'input', label: t('overview.input'), value: overview.summary.input },
            { kind: 'cacheRead', label: t('overview.cacheRead'), value: overview.summary.cacheRead },
            { kind: 'cacheWrite', label: t('overview.cacheWrite'), value: overview.summary.cacheWrite },
            { kind: 'output', label: t('overview.output'), value: overview.summary.output },
          ].map(part => ({
            ...part,
            percent: tokenTotal > 0 ? (part.value / tokenTotal) * 100 : 0,
          }))
          const cachePromptTotal = overview.summary.input + overview.summary.cacheRead + overview.summary.cacheWrite
          const cacheHitRate = cachePromptTotal > 0 ? (overview.summary.cacheRead / cachePromptTotal) * 100 : 0
          const averageTokensPerTurn = overview.summary.turns > 0 ? tokenTotal / overview.summary.turns : 0
          const modelCostLabel = model => {
            if (model.category === 'local') return t('overview.free')
            const parts = []
            if (model.cny > 0) parts.push(formatMoney(model.cny, 'CNY'))
            if (model.usd > 0) parts.push(formatMoney(model.usd, 'USD'))
            return parts.length > 0 ? parts.join(' / ') : formatMoney(0, 'CNY')
          }

          const niceMax = value => {
            if (!(value > 0)) return 1
            const power = 10 ** Math.floor(Math.log10(value))
            const normalized = value / power
            const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
            return step * power
          }
          const rawMax = Math.max(0, ...overview.chart.map(bucket => bucket.total))
          const yMax = niceMax(rawMax * 1.12)
          const width = 780
          const height = 250
          const left = 58
          const right = 18
          const top = 16
          const bottom = 46
          const plotWidth = width - left - right
          const plotHeight = height - top - bottom
          const slot = overview.chart.length > 0 ? plotWidth / overview.chart.length : plotWidth
          const barWidth = Math.max(3, Math.min(24, slot * 0.62))
          const lineY = value => top + plotHeight - (value / yMax) * plotHeight
          const safeHover = hoverIndex !== null && hoverIndex < overview.chart.length ? hoverIndex : null
          const hoverBucket = safeHover === null ? null : overview.chart[safeHover]
          const selectedBucket = selectedIndex !== null && selectedIndex < overview.chart.length ? overview.chart[selectedIndex] : null
          const bucketModels = bucket => bucket && bucket.models
            ? Object.values(bucket.models).sort((left, right) => right.tokens - left.tokens).slice(0, 3)
            : []
          const selectedModels = bucketModels(selectedBucket)

          const openDetailReport = index => {
            const bucket = overview.chart[index]
            if (bucket === undefined) return
            const total = bucket.total
            const segments = [
              { kind: 'official', label: t('overview.official'), value: bucket.official, color: '#3b82f6' },
              { kind: 'third', label: t('overview.third'), value: bucket.third, color: '#a78bfa' },
              { kind: 'local', label: t('overview.local'), value: bucket.local, color: '#64748b' },
            ]
            let offset = 0
            const arcs = segments.map(segment => {
              const percent = total > 0 ? (segment.value / total) * 100 : 0
              const arc = percent > 0
                ? `<circle cx="100" cy="100" r="78" fill="none" stroke="${segment.color}" stroke-width="22" pathLength="100" stroke-dasharray="${Math.max(0, percent - 1)} ${100 - Math.max(0, percent - 1)}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"/>`
                : ''
              offset += percent
              return arc
            }).join('')
            const legend = segments.map(segment => {
              const percent = total > 0 ? (segment.value / total) * 100 : 0
              const icon = iconMarkup('', '', segment.kind === 'official' ? 'deepseek' : segment.kind === 'local' ? 'local' : 'generic')
              return `<div class="legend-row">${icon}<span>${escapeHtml(segment.label)}</span><em>${escapeHtml(formatTokenCount(segment.value, zhUser))} Token</em><strong>${percent.toFixed(1)}%</strong></div>`
            }).join('')
            const models = bucketModels(bucket).filter(model => model.model !== ''
              && !['official', 'third', 'local'].includes(model.model.toLowerCase()))
            const chips = models.map(model => `<span class="chip">${iconMarkup(model.provider, model.model)}${escapeHtml(modelLabel(model.model, model.provider))}<em>${escapeHtml(formatTokenCount(model.tokens, zhUser))}</em></span>`).join('')
            const body = `<div class="hero"><div><h1>${escapeHtml(bucket.fullLabel)}</h1><div class="sub">${escapeHtml(t('overview.totalTokens'))}</div></div><div style="text-align:right"><strong style="font-size:22px">${escapeHtml(formatTokenCount(total, zhUser))}</strong><div class="sub">${escapeHtml(formatMoney(bucket.cny, 'CNY'))} / ${escapeHtml(formatMoney(bucket.usd, 'USD'))}</div></div></div>
              <div class="ring-layout"><div class="ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="78" fill="none" stroke="var(--line2)" stroke-width="22"/>${arcs}</svg><div class="ring-center"><strong>${escapeHtml(formatTokenCount(total, zhUser))}</strong><small>Token</small></div></div><div class="legend">${legend}</div></div>
              ${chips === '' ? '' : `<h2>模型</h2><div class="chips">${chips}</div>`}
              <div class="actions"><span class="muted">${escapeHtml(t('overview.footnote'))}</span></div>`
            void openHtmlWindow(`用量详情 · ${bucket.fullLabel}`, body, 760, 520).then(ok => {
              if (!ok) setSelectedIndex(index)
            })
          }

          const openPricingReport = () => {
            const officialRows = [
              ['Flash', t('billing.off'), FLASH_PRICES.off],
              ['Flash', t('billing.peak'), FLASH_PRICES.peak],
              ['Pro', t('billing.off'), PRO_PRICES.off],
              ['Pro', t('billing.peak'), PRO_PRICES.peak],
            ].map(([model, tier, price]) => `<tr><td>${iconMarkup('deepseek', 'deepseek-flash')} ${escapeHtml(model)}</td><td>${escapeHtml(tier)}</td><td>¥${escapeHtml(priceValue(price.hit))}</td><td>¥${escapeHtml(priceValue(price.miss))}</td><td>¥${escapeHtml(priceValue(price.out))}</td></tr>`).join('')
            const thirdRows = pricingRows.map(rule => `<tr><td>${iconMarkup(rule.provider, rule.model)} ${escapeHtml(rule.name || rule.model)}<div class="sub">${escapeHtml(rule.provider)} · ${escapeHtml(rule.model)}</div></td><td>${escapeHtml(String(rule.currency || '').toUpperCase())}</td><td>${escapeHtml(priceValue(rule.input))}</td><td>${escapeHtml(priceValue(rule.cached))}</td><td>${escapeHtml(priceValue(rule.cacheWrite ?? rule.input))}</td><td>${escapeHtml(priceValue(rule.output))}</td></tr>`).join('')
            const body = `<h1>${escapeHtml(t('overview.pricingTable'))}</h1><div class="sub">${escapeHtml(t('overview.pricingViewHint'))}</div>
              <div class="section-head"><b>${escapeHtml(t('overview.official'))}</b><span>¥ · ${escapeHtml(t('billing.perM'))}</span></div>
              <table><thead><tr><th>${escapeHtml(t('price.model'))}</th><th>${escapeHtml(t('table.peak'))}</th><th>${escapeHtml(t('billing.cached'))}</th><th>${escapeHtml(t('billing.input'))}</th><th>${escapeHtml(t('billing.output'))}</th></tr></thead><tbody>${officialRows}</tbody></table>
              <div class="section-head"><b>${escapeHtml(t('overview.third'))}</b><span>${escapeHtml(t('billing.perM'))}</span></div>
              <table><thead><tr><th>${escapeHtml(t('overview.pricingModel'))}</th><th>${escapeHtml(t('overview.pricingCurrency'))}</th><th>${escapeHtml(t('overview.pricingInput'))}</th><th>${escapeHtml(t('overview.pricingCached'))}</th><th>${escapeHtml(t('overview.pricingWrite'))}</th><th>${escapeHtml(t('overview.pricingOutput'))}</th></tr></thead><tbody>${thirdRows}</tbody></table>
              <div class="note">${escapeHtml(t('overview.pricingCatalogNote'))}</div>`
            void openHtmlWindow(t('overview.pricingTable'), body, 840, 820).then(ok => {
              if (!ok) openPricingEditor()
            })
          }

          const periodLabel = range === 'today'
            ? `${new Date(clock).getFullYear()}年${new Date(clock).getMonth() + 1}月${new Date(clock).getDate()}日`
            : range === 'month'
              ? `${new Date(clock).getFullYear()}年${new Date(clock).getMonth() + 1}月1日 – ${new Date(clock).getMonth() + 1}月${new Date(clock).getDate()}日`
              : range === 'custom'
                ? `${customStart || '—'} – ${customEnd || '—'}`
                : range === '7d' || range === '30d' || range === '90d'
                  ? (() => {
                    const days = range === '7d' ? 6 : range === '30d' ? 29 : 89
                    const start = new Date(new Date(clock).getFullYear(), new Date(clock).getMonth(), new Date(clock).getDate() - days)
                    const end = new Date(clock)
                    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`
                  })()
                  : overview.chart.length > 0
                    ? `${overview.chart[0].fullLabel} – ${overview.chart[overview.chart.length - 1].fullLabel}`
                    : '—'
          const handlePointerMove = event => {
            if (overview.chart.length === 0) return
            const rect = event.currentTarget.getBoundingClientRect()
            const x = ((event.clientX - rect.left) / rect.width) * width
            if (x < left || x > width - right) {
              pointerRef.current = null
              lastHoverRef.current = null
              setHoverIndex(null)
              return
            }
            const index = Math.max(0, Math.min(overview.chart.length - 1, Math.floor((x - left) / slot)))
            const point = {
              index,
              x: ((event.clientX - rect.left) / rect.width) * 100,
              y: ((event.clientY - rect.top) / rect.height) * 100,
            }
            pointerRef.current = point
            if (lastHoverRef.current !== index) {
              lastHoverRef.current = index
              setHoverIndex(index)
            }
            cancelAnimationFrame(frameRef.current)
            frameRef.current = requestAnimationFrame(() => positionHover(point))
          }
          const positionHover = point => {
            if (point === null) return
            const tooltip = tooltipRef.current
            if (tooltip !== null) {
              tooltip.style.left = `${Math.min(86, Math.max(14, point.x))}%`
              tooltip.style.top = `${Math.min(58, Math.max(4, point.y))}%`
            }
            const bar = hoverBarRef.current
            if (bar !== null) {
              bar.style.left = `${((left + slot * point.index) / width) * 100}%`
            }
          }
          useEffect(() => {
            const point = pointerRef.current
            if (point === null) return undefined
            const frame = requestAnimationFrame(() => positionHover(point))
            return () => { cancelAnimationFrame(frame) }
          }, [hoverIndex])
          useEffect(() => () => { cancelAnimationFrame(frameRef.current) }, [])
          const barDelay = index => ({ animationDelay: `${Math.min(index, 24) * 12}ms` })
          const chartNode = overview.chart.some(bucket => bucket.total > 0)
            ? h('div', { className: 'dsub-overview-plot' },
              h('svg', {
                key: `overview-${range}`,
                className: 'dsub-overview-svg',
                viewBox: `0 0 ${width} ${height}`,
                role: 'img',
                'aria-label': t('overview.trend'),
                onPointerMove: handlePointerMove,
                onPointerLeave: () => {
                  pointerRef.current = null
                  lastHoverRef.current = null
                  setHoverIndex(null)
                },
              },
                [0, 0.25, 0.5, 0.75, 1].map(ratio => h('g', { key: ratio },
                  h('line', { x1: left, x2: width - right, y1: lineY(yMax * ratio), y2: lineY(yMax * ratio), className: 'dsub-overview-grid-line' }),
                  h('text', { x: left - 8, y: lineY(yMax * ratio) + 3, className: 'dsub-overview-y', textAnchor: 'end' }, formatTokenCount(yMax * ratio, zhUser)),
                )),
                overview.chart.map((bucket, index) => {
                  const x = left + slot * index + (slot - barWidth) / 2
                  const tone = bucket.total > 1e9 ? 'danger' : bucket.total > 5e8 ? 'warn' : null
                  let cursor = 0
                  const segment = (value, className) => {
                    if (value <= 0) return null
                    const segmentHeight = (value / yMax) * plotHeight
                    const y = top + plotHeight - ((cursor + value) / yMax) * plotHeight
                    cursor += value
                    return h('rect', { x, y, width: barWidth, height: segmentHeight, rx: 2, className: `${className} dsub-reveal`, style: barDelay(index) })
                  }
                  return h('g', { key: bucket.key },
                    h('title', null, `${bucket.fullLabel} · ${formatTokenCount(bucket.total, zhUser)} Token · ¥${bucket.cny.toFixed(2)} / $${bucket.usd.toFixed(2)}`),
                    tone !== null
                      ? h('rect', {
                        x,
                        y: lineY(bucket.total),
                        width: barWidth,
                        height: (bucket.total / yMax) * plotHeight,
                        rx: 2,
                        className: `dsub-overview-bar-${tone} dsub-reveal`,
                        style: barDelay(index),
                      })
                      : h(React.Fragment, null,
                        segment(bucket.official, 'dsub-overview-bar-official'),
                        segment(bucket.third, 'dsub-overview-bar-third'),
                        segment(bucket.local, 'dsub-overview-bar-local'),
                      ),
                    bucket.label !== ''
                      ? h('text', {
                        x: x + barWidth / 2,
                        y: height - 10,
                        className: 'dsub-overview-x',
                        textAnchor: range === 'today' ? 'middle' : 'end',
                        transform: range === 'today' ? undefined : `rotate(-35 ${x + barWidth / 2} ${height - 10})`,
                      }, bucket.label)
                      : null,
                    bucket.total > 0
                      ? h('rect', {
                        className: 'dsub-overview-hit',
                        x: left + slot * index,
                        y: top,
                        width: slot,
                        height: plotHeight,
                        onClick: () => { openDetailReport(index) },
                      })
                      : null,
                  )
                }),
              ),
              safeHover === null
                ? null
                : h('div', {
                  ref: hoverBarRef,
                  className: 'dsub-overview-hover-bar',
                  style: {
                    left: `${((left + slot * safeHover) / width) * 100}%`,
                    width: `${(slot / width) * 100}%`,
                    bottom: `${bottom}px`,
                  },
                }),
              hoverBucket === null
                ? null
                : h('div', {
                  ref: tooltipRef,
                  className: 'dsub-overview-tooltip',
                  style: {
                    left: `${pointerRef.current === null ? 50 : Math.min(86, Math.max(14, pointerRef.current.x))}%`,
                    top: `${pointerRef.current === null ? 8 : Math.min(58, Math.max(4, pointerRef.current.y))}%`,
                  },
                },
                  h('b', null, hoverBucket.fullLabel),
                  h('strong', null, `${formatTokenCount(hoverBucket.total, zhUser)} Token`),
                  h('small', { className: 'dsub-overview-tooltip-row', 'data-kind': 'official' },
                    h(ModelIcon, { kind: 'deepseek' }),
                    h('span', null, t('overview.official')),
                    h('em', null, formatTokenCount(hoverBucket.official, zhUser)),
                  ),
                  h('small', { className: 'dsub-overview-tooltip-row', 'data-kind': 'third' },
                    h(ModelIcon, { kind: 'generic' }),
                    h('span', null, t('overview.third')),
                    h('em', null, formatTokenCount(hoverBucket.third, zhUser)),
                  ),
                  h('small', { className: 'dsub-overview-tooltip-row', 'data-kind': 'local' },
                    h(ModelIcon, { kind: 'local' }),
                    h('span', null, t('overview.local')),
                    h('em', null, formatTokenCount(hoverBucket.local, zhUser)),
                  ),
                  h('small', { className: 'dsub-overview-tooltip-cost' }, `¥${hoverBucket.cny.toFixed(2)} / $${hoverBucket.usd.toFixed(2)}`),
                ),
            )
            : h('div', { className: 'dsub-overview-empty' },
              h('b', null, t('overview.noData')),
              h('span', null, t('overview.noDataHint')),
            )

          const stat = (label, value, hint, format) => h('div', { className: 'dsub-overview-stat dsub-reveal dsub-reveal-card' },
            h('span', null, label),
            h('b', null, h(AnimatedNumber, { value, format })),
            h('small', null, hint),
          )
          const rangeButton = (value, label) => h('button', {
            type: 'button',
            className: 'dsub-overview-range-button',
            'data-active': range === value ? 'true' : 'false',
            onClick: () => { setRange(value) },
          }, label)
          const chooseRange = value => {
            if (value === '') return
            const localDateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            if (value === 'custom') {
              if (customStart === '') {
                const start = new Date(clock)
                start.setDate(start.getDate() - 29)
                setCustomStart(localDateValue(start))
              }
              if (customEnd === '') setCustomEnd(localDateValue(new Date(clock)))
            }
            setRange(value)
          }
          const priceCatalogLabel = pricingStatus.source === 'remote'
            ? `${t('billing.catalogRemote')} ${pricingStatus.version}`
            : pricingStatus.source === 'cache'
              ? `${t('billing.catalogCache')} ${pricingStatus.version}`
              : `${t('billing.catalogBuiltin')} ${pricingStatus.version}`
          const priceCatalogNote = pricingStatus.error
            ? `${priceCatalogLabel} · ${t('billing.catalogFailed')}`
            : priceCatalogLabel

          useEffect(() => {
            if (selectedIndex === null) return undefined
            const close = event => { if (event.key === 'Escape') setSelectedIndex(null) }
            window.addEventListener('keydown', close)
            return () => { window.removeEventListener('keydown', close) }
          }, [selectedIndex])

          useEffect(() => {
            if (!pricingOpen) return undefined
            const close = event => { if (event.key === 'Escape') setPricingOpen(false) }
            window.addEventListener('keydown', close)
            return () => { window.removeEventListener('keydown', close) }
          }, [pricingOpen])

          const ringTotal = selectedBucket === null ? 0 : selectedBucket.total
          const ringSegments = [
            { kind: 'official', label: t('overview.official'), value: selectedBucket === null ? 0 : selectedBucket.official },
            { kind: 'third', label: t('overview.third'), value: selectedBucket === null ? 0 : selectedBucket.third },
            { kind: 'local', label: t('overview.local'), value: selectedBucket === null ? 0 : selectedBucket.local },
          ].map(segment => ({
            ...segment,
            percent: ringTotal > 0 ? (segment.value / ringTotal) * 100 : 0,
            cost: selectedBucket === null || selectedBucket.costs === undefined
              ? { CNY: 0, USD: 0 }
              : selectedBucket.costs[segment.kind],
          }))
          const ringCostText = cost => {
            const parts = []
            if (cost.CNY > 0) parts.push(formatMoney(cost.CNY, 'CNY'))
            if (cost.USD > 0) parts.push(formatMoney(cost.USD, 'USD'))
            return parts.length > 0 ? parts.join(' / ') : formatMoney(0, 'CNY')
          }
          let ringOffset = 0
          const ringArcs = ringSegments.map(segment => {
            const arc = { ...segment, offset: ringOffset }
            ringOffset += segment.percent
            return arc
          })

          return h(React.Fragment, null,
            h(Styles),
            h('div', { className: 'dsub-view dsub-overview-page', 'data-conversation-composer-overlay': '' },
              h('div', { ref: overviewRevealRef, className: 'dsub-overview-scroll' },
                h('div', { className: 'dsub-overview' },
              h('header', { className: 'dsub-overview-head' },
                h('div', { className: 'dsub-overview-title' },
                  h('h2', null, t('overview.title')),
                  h('p', null, `${t('overview.subtitle')} · ${t('overview.allSessions')}`),
                ),
                h('div', { className: 'dsub-overview-range' },
                  rangeButton('today', t('overview.today')),
                  rangeButton('month', t('overview.month')),
                  rangeButton('all', t('overview.all')),
                  h('select', {
                    className: 'dsub-overview-range-select',
                    value: ['7d', '30d', '90d', 'custom'].includes(range) ? range : '',
                    'aria-label': t('overview.moreRanges'),
                    onChange: event => { chooseRange(event.target.value) },
                  },
                    h('option', { value: '' }, t('overview.moreRanges')),
                    h('option', { value: '7d' }, t('overview.last7')),
                    h('option', { value: '30d' }, t('overview.last30')),
                    h('option', { value: '90d' }, t('overview.last90')),
                    h('option', { value: 'custom' }, t('overview.custom')),
                  ),
                ),
              ),
              h('div', { className: 'dsub-overview-filterbar' },
                h('div', { className: 'dsub-overview-context' },
                  h('label', { className: 'dsub-overview-context-field dsub-overview-context-workspace' },
                    h('span', null, t('overview.filterWorkspace')),
                    h('select', {
                      value: workspaceFilter,
                      onChange: event => { setWorkspaceFilter(event.target.value) },
                    },
                      h('option', { value: 'all' }, t('overview.allWorkspaces')),
                      (workspaceState && Array.isArray(workspaceState.items) ? workspaceState.items : [])
                        .filter(item => item)
                        .map(item => h('option', { key: item.workspaceId, value: item.workspaceId },
                          item.title === 'default-workspace'
                            ? t('workspace.default')
                            : (String(item.title ?? '').trim() || t('workspace.ungrouped')),
                        )),
                    ),
                  ),
                  h('div', { className: 'dsub-overview-context-field dsub-overview-context-model' },
                    h('span', null, t('overview.filterModel')),
                    h(ModelPicker, {
                      options: overview.modelOptions,
                      value: modelFilter,
                      onChange: setModelFilter,
                      allLabel: t('overview.allModels'),
                    }),
                  ),
                ),
                range === 'custom'
                  ? h(React.Fragment, null,
                    h('label', null,
                      h('span', null, t('overview.startDate')),
                      h('input', {
                        type: 'date',
                        value: customStart,
                        onChange: event => { setCustomStart(event.target.value); setRange('custom') },
                      }),
                    ),
                    h('label', null,
                      h('span', null, t('overview.endDate')),
                      h('input', {
                        type: 'date',
                        value: customEnd,
                        onChange: event => { setCustomEnd(event.target.value); setRange('custom') },
                      }),
                    ),
                  )
                  : null,
                h('button', {
                  type: 'button',
                  className: 'dsub-overview-pricing-button',
                  onClick: openPricingReport,
                }, t('overview.pricingTable')),
                h('button', {
                  type: 'button',
                  className: 'dsub-overview-pricing-edit',
                  onClick: () => {
                    openPricingEditor()
                    setPricingEditMode(true)
                  },
                }, t('overview.edit')),
                h('button', {
                  type: 'button',
                  className: 'dsub-overview-export',
                  title: t('overview.exportCsvHint'),
                  disabled: overview.entries.length === 0,
                  onClick: exportCsv,
                }, t('overview.exportCsv')),
                h('button', {
                  type: 'button',
                  className: 'dsub-overview-export',
                  title: t('overview.exportExcelHint'),
                  disabled: overview.entries.length === 0,
                  onClick: exportExcel,
                }, t('overview.exportExcel')),
              ),
              h('div', { className: 'dsub-overview-grid' },
                stat(t('overview.totalTokens'), overview.summary.tokens, `${overview.summary.localTurns} ${t('overview.local')} · ${t('overview.free')}`, value => formatTokenCount(value, zhUser)),
                stat(t('overview.deepseekCost'), overview.summary.cny, t('overview.paid'), value => formatMoney(value, 'CNY')),
                stat(t('overview.thirdCost'), overview.summary.usd, t('overview.paid'), value => formatMoney(value, 'USD')),
                stat(t('overview.turns'), overview.summary.turns, `${overview.summary.localTurns} ${t('overview.local')}`, value => String(Math.round(value))),
              ),
              overview.workspaceSummaries.length > 0
                ? h('section', { className: 'dsub-overview-workspaces dsub-reveal dsub-reveal-card' },
                  h('div', { className: 'dsub-overview-section-head' },
                    h('div', null,
                      h('h3', null, t('overview.workspaces')),
                      h('p', null, t('overview.workspaceHint')),
                    ),
                    h('span', null, `${overview.workspaceSummaries.length} ${t('overview.workspaceCount')}`),
                  ),
                  h('div', { className: 'dsub-overview-workspace-grid' },
                    overview.workspaceSummaries.map(workspace => h('div', {
                      key: workspace.id,
                      className: 'dsub-overview-workspace dsub-reveal dsub-reveal-card',
                    },
                      h('div', { className: 'dsub-overview-workspace-head' },
                        h('b', { title: workspace.name }, workspace.name),
                        h('em', null, `${workspace.sessions} ${t('overview.workspaceSessions')}`),
                      ),
                      h('div', { className: 'dsub-overview-workspace-metrics' },
                        h('span', null,
                          h('i', null, t('overview.workspaceTokens')),
                          h('strong', null, formatTokenCount(workspace.tokens, zhUser)),
                        ),
                        h('span', null,
                          h('i', null, t('overview.workspaceOfficial')),
                          h('strong', null, formatMoney(workspace.cny, 'CNY')),
                        ),
                        h('span', null,
                          h('i', null, t('overview.workspaceThird')),
                          h('strong', null, formatMoney(workspace.usd, 'USD')),
                        ),
                        h('span', null,
                          h('i', null, t('overview.workspaceTurns')),
                          h('strong', null, String(workspace.turns)),
                        ),
                      ),
                      workspace.localTurns > 0
                        ? h('small', { className: 'dsub-overview-workspace-local' }, `${workspace.localTurns} ${t('overview.workspaceLocal')} · ${t('overview.free')}`)
                        : null,
                    )),
                  ),
                )
                : null,
              h('section', { className: 'dsub-overview-composition dsub-reveal dsub-reveal-card' },
                h('div', { className: 'dsub-overview-section-head' },
                  h('div', null,
                    h('h3', null, t('overview.tokenComposition')),
                    h('p', null, t('overview.tokenCompositionHint')),
                  ),
                  h('div', { className: 'dsub-overview-composition-meta' },
                    h('span', null, `${t('overview.cacheHit')} ${cacheHitRate.toFixed(1)}%`),
                    h('span', null, `${t('overview.avgPerTurn')} ${formatTokenCount(averageTokensPerTurn, zhUser)}`),
                  ),
                ),
                h('div', { className: 'dsub-overview-composition-bar' },
                  tokenParts.map(part => h('span', {
                    key: part.kind,
                    'data-kind': part.kind,
                    className: 'dsub-reveal',
                    style: { '--dsub-fill': `${part.percent}%` },
                  })),
                ),
                h('div', { className: 'dsub-overview-composition-grid' },
                  tokenParts.map(part => h('div', {
                    key: part.kind,
                    className: 'dsub-overview-composition-item',
                    'data-kind': part.kind,
                  },
                    h('span', null, part.label),
                    h('strong', null, formatTokenCount(part.value, zhUser)),
                    h('em', null, `${part.percent.toFixed(1)}%`),
                  )),
                ),
              ),
              h('section', { className: 'dsub-overview-chart dsub-reveal dsub-reveal-card' },
                h('div', { className: 'dsub-overview-chart-head' },
                  h('div', null,
                    h('h3', null, t('overview.trend')),
                    h('p', null, t('overview.trendHint')),
                  ),
                  h('div', { className: 'dsub-overview-legend' },
                    h('span', { 'data-kind': 'official' }, h(ModelIcon, { kind: 'deepseek' }), t('overview.official')),
                    h('span', { 'data-kind': 'third' }, h(ModelIcon, { kind: 'generic' }), t('overview.third')),
                    h('span', { 'data-kind': 'local' }, h(ModelIcon, { kind: 'local' }), t('overview.local')),
                  ),
                ),
                chartNode,
                h('div', { className: 'dsub-overview-period' }, periodLabel),
              ),
              overview.modelSummaries.length > 0
                ? h('section', { className: 'dsub-overview-models dsub-reveal dsub-reveal-card' },
                  h('div', { className: 'dsub-overview-section-head' },
                    h('div', null,
                      h('h3', null, t('overview.models')),
                      h('p', null, t('overview.modelsHint')),
                    ),
                    h('span', null, `${overview.modelSummaries.length} ${t('overview.modelCount')}`),
                  ),
                  h('div', { className: 'dsub-overview-model-table' },
                    h('div', { className: 'dsub-overview-model-row dsub-overview-model-head' },
                      h('span', null, t('overview.model')),
                      h('span', null, t('overview.category')),
                      h('span', null, 'Token'),
                      h('span', null, t('overview.share')),
                      h('span', null, t('overview.cost')),
                      h('span', null, t('overview.turns')),
                    ),
                    overview.modelSummaries.map(model => h('div', {
                      key: model.key,
                      className: 'dsub-overview-model-row',
                    },
                      h('div', { className: 'dsub-overview-model-name' },
                        h('b', { title: model.name }, h(ModelName, { provider: model.provider, model: model.name })),
                        model.provider !== '' ? h('small', null, model.provider) : null,
                      ),
                      h('span', {
                        className: 'dsub-overview-model-badge',
                        'data-kind': model.category,
                      }, model.category === 'official'
                        ? t('overview.official')
                        : model.category === 'third'
                          ? t('overview.third')
                          : t('overview.local')),
                      h('span', { className: 'dsub-overview-model-num' }, formatTokenCount(model.tokens, zhUser)),
                      h('span', { className: 'dsub-overview-model-num' }, `${tokenTotal > 0 ? ((model.tokens / tokenTotal) * 100).toFixed(1) : '0.0'}%`),
                      h('span', { className: 'dsub-overview-model-cost' }, modelCostLabel(model)),
                      h('span', { className: 'dsub-overview-model-num' }, String(model.turns)),
                    )),
                  ),
                )
                : null,
              h('p', { className: 'dsub-overview-foot' }, `${t('overview.footnote')} · ${priceCatalogNote}`),
              pricingOpen
                ? h('div', {
                  className: 'dsub-overview-modal dsub-pricing-modal',
                  onClick: () => { setPricingOpen(false) },
                },
                  h('div', {
                    className: 'dsub-overview-modal-panel dsub-pricing-panel',
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-label': t('overview.pricingTable'),
                    onClick: event => { event.stopPropagation() },
                  },
                    h('div', { className: 'dsub-overview-modal-head' },
                      h('div', null,
                        h('h3', null, t('overview.pricingTable')),
                        h('p', null, pricingEditMode ? t('overview.pricingHint') : t('overview.pricingViewHint')),
                      ),
                      h('button', {
                        type: 'button',
                        className: 'dsub-overview-modal-close',
                        'aria-label': t('overview.close'),
                        onClick: () => { setPricingOpen(false) },
                      }, '×'),
                    ),
                    pricingEditMode
                      ? h(React.Fragment, null,
                        h('textarea', {
                          className: 'dsub-pricing-textarea',
                          spellCheck: false,
                          value: pricingText,
                          onChange: event => { setPricingText(event.target.value) },
                        }),
                        pricingError !== ''
                          ? h('p', { className: 'dsub-pricing-error' }, pricingError)
                          : null,
                        h('div', { className: 'dsub-pricing-actions' },
                          h('button', { type: 'button', onClick: resetPricingEditor }, t('overview.reset')),
                          h('button', { type: 'button', onClick: () => { setPricingEditMode(false); setPricingError('') } }, t('overview.cancel')),
                          h('button', { type: 'button', className: 'dsub-pricing-save', onClick: savePricingEditor }, t('overview.save')),
                        ),
                      )
                      : h(React.Fragment, null,
                        h('div', { className: 'dsub-pricing-section-head' },
                          h('b', null, t('overview.official')),
                          h('span', null, `¥ · ${t('billing.perM')}`),
                        ),
                        h('div', { className: 'dsub-pricing-official-table' },
                          h('div', { className: 'dsub-pricing-official-row dsub-pricing-official-head' },
                            h('span', null, t('price.model')),
                            h('span', null, t('table.peak')),
                            h('span', null, t('billing.cached')),
                            h('span', null, t('billing.input')),
                            h('span', null, t('billing.output')),
                          ),
                          [
                            ['Flash', t('billing.off'), FLASH_PRICES.off],
                            ['Flash', t('billing.peak'), FLASH_PRICES.peak],
                            ['Pro', t('billing.off'), PRO_PRICES.off],
                            ['Pro', t('billing.peak'), PRO_PRICES.peak],
                          ].map(([model, tier, price]) => h('div', {
                            key: `${model}-${tier}`,
                            className: 'dsub-pricing-official-row',
                          },
                            h('span', { className: 'dsub-pricing-official-model' }, model),
                            h('span', null, tier),
                            h('span', { className: 'dsub-pricing-number' }, `¥${priceValue(price.hit)}`),
                            h('span', { className: 'dsub-pricing-number' }, `¥${priceValue(price.miss)}`),
                            h('span', { className: 'dsub-pricing-number' }, `¥${priceValue(price.out)}`),
                          )),
                        ),
                        h('div', { className: 'dsub-pricing-section-head dsub-pricing-section-head-third' },
                          h('b', null, t('overview.third')),
                          h('span', null, t('billing.perM')),
                        ),
                        h('div', { className: 'dsub-pricing-table' },
                          h('div', { className: 'dsub-pricing-row dsub-pricing-head' },
                            h('span', null, t('overview.pricingModel')),
                            h('span', null, t('overview.pricingCurrency')),
                            h('span', null, t('overview.pricingInput')),
                            h('span', null, t('overview.pricingCached')),
                            h('span', null, t('overview.pricingWrite')),
                            h('span', null, t('overview.pricingOutput')),
                          ),
                          pricingRows.map(rule => h('div', {
                            key: `${rule.provider}/${rule.model}`,
                            className: 'dsub-pricing-row',
                          },
                            h('div', { className: 'dsub-pricing-model' },
                              h('b', { title: rule.name || rule.model }, h(ModelName, { provider: rule.provider, model: rule.model })),
                              h('small', null, `${rule.provider} · ${rule.model}`),
                            ),
                            h('span', { className: 'dsub-pricing-currency' }, String(rule.currency || '').toUpperCase()),
                            h('span', { className: 'dsub-pricing-number' }, priceValue(rule.input)),
                            h('span', { className: 'dsub-pricing-number' }, priceValue(rule.cached)),
                            h('span', { className: 'dsub-pricing-number' }, priceValue(rule.cacheWrite ?? rule.input)),
                            h('span', { className: 'dsub-pricing-number' }, priceValue(rule.output)),
                          )),
                        ),
                        h('p', { className: 'dsub-pricing-note' }, t('overview.pricingCatalogNote')),
                        h('div', { className: 'dsub-pricing-actions' },
                          h('button', { type: 'button', onClick: resetPricingEditor }, t('overview.reset')),
                          h('button', { type: 'button', className: 'dsub-pricing-edit', onClick: beginPricingEdit }, t('overview.edit')),
                        ),
                      ),
                  ),
                )
                : null,
              selectedBucket === null
                ? null
                : h('div', {
                  className: 'dsub-overview-modal',
                  onClick: () => { setSelectedIndex(null) },
                },
                  h('div', {
                    className: 'dsub-overview-modal-panel',
                    role: 'dialog',
                    'aria-modal': 'true',
                    'aria-label': selectedBucket.fullLabel,
                    onClick: event => { event.stopPropagation() },
                  },
                    h('div', { className: 'dsub-overview-modal-head' },
                      h('div', null,
                        h('h3', null, selectedBucket.fullLabel),
                        h('p', null, `${formatTokenCount(selectedBucket.total, zhUser)} Token · ¥${selectedBucket.cny.toFixed(2)} / $${selectedBucket.usd.toFixed(2)}`),
                      ),
                      h('button', {
                        type: 'button',
                        className: 'dsub-overview-modal-close',
                        'aria-label': t('overview.close'),
                        onClick: () => { setSelectedIndex(null) },
                      }, '×'),
                    ),
                    selectedModels.length > 0
                      ? h('div', { className: 'dsub-overview-modal-models' },
                        selectedModels.map(model => h('span', {
                          key: model.key,
                          className: 'dsub-overview-modal-model',
                        },
                          h(ModelIcon, { provider: model.provider, model: model.model }),
                          h('span', null, modelLabel(model.model, model.provider)),
                          h('em', null, formatTokenCount(model.tokens, zhUser)),
                        )),
                      )
                      : null,
                    h('div', { className: 'dsub-overview-ring-layout' },
                      h('div', { className: 'dsub-overview-single-ring' },
                        h('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' },
                          h('defs', null,
                            h('mask', {
                              id: 'dsub-overview-ring-mask',
                              maskUnits: 'userSpaceOnUse',
                              x: 0,
                              y: 0,
                              width: 200,
                              height: 200,
                            },
                              h('rect', { x: 0, y: 0, width: 200, height: 200, fill: '#000' }),
                              h('circle', {
                                className: 'dsub-overview-ring-reveal',
                                cx: 100,
                                cy: 100,
                                r: 78,
                                fill: 'none',
                                stroke: '#fff',
                                strokeWidth: 22,
                                pathLength: 100,
                                strokeDasharray: '0 100',
                              }),
                            ),
                          ),
                          h('circle', { className: 'dsub-overview-ring-track', cx: 100, cy: 100, r: 78 }),
                          h('g', { mask: 'url(#dsub-overview-ring-mask)' },
                            ringArcs.map(arc => arc.percent > 0
                              ? h('circle', {
                                key: arc.kind,
                                className: 'dsub-overview-ring-fill',
                                'data-kind': arc.kind,
                                cx: 100,
                                cy: 100,
                                r: 78,
                                pathLength: 100,
                                strokeDasharray: `${arc.percent} ${100 - arc.percent}`,
                                strokeDashoffset: -arc.offset,
                              })
                              : null,
                            ),
                          ),
                        ),
                        h('div', { className: 'dsub-overview-single-ring-center' },
                          h('strong', null, formatTokenCount(ringTotal, zhUser)),
                          h('small', null, 'Token'),
                        ),
                      ),
                      h('div', { className: 'dsub-overview-ring-legend' },
                        ringSegments.map(segment => h('div', {
                          key: segment.kind,
                          className: 'dsub-overview-ring-legend-row',
                          'data-kind': segment.kind,
                        },
                          h(ModelIcon, { kind: segment.kind === 'official' ? 'deepseek' : segment.kind === 'local' ? 'local' : 'generic' }),
                          h('span', null, segment.label),
                          h('em', null, `${formatTokenCount(segment.value, zhUser)} Token`),
                          h('strong', null, `${segment.percent.toFixed(1)}%`),
                        )),
                      ),
                    ),
                    h('div', { className: 'dsub-overview-ring-costs' },
                      ringSegments.filter(segment => segment.kind !== 'local').map(segment => h('div', {
                        key: segment.kind,
                        className: 'dsub-overview-ring-cost-row',
                        'data-kind': segment.kind,
                      },
                        h(ModelIcon, { kind: segment.kind === 'official' ? 'deepseek' : segment.kind === 'local' ? 'local' : 'generic' }),
                        h('span', null, segment.label),
                        h('b', null, ringCostText(segment.cost)),
                      )),
                    ),
                    h('p', { className: 'dsub-overview-modal-foot' }, t('overview.footnote')),
                  ),
                ),
                ),
              ),
            ),
          )
        }

        // ---- Slot wiring and the plugin-page switches -----------------
        const syncSlots = () => {
          if (typeof document !== 'undefined') {
            // Migration from the removed "other information" mode: clear its
            // legacy root/seat switches so the native row cannot stay hidden.
            document.documentElement.removeAttribute('data-dsub-hide-dock')
          }
          if (featureConfig.balanceCard && cardCloseTimer !== null) {
            window.clearTimeout(cardCloseTimer)
            cardCloseTimer = null
            for (const card of document.querySelectorAll('.dsub-side-card')) {
              card.removeAttribute('data-closing')
            }
          }
          if (featureConfig.balanceCard && cardDisposer === undefined) {
            cardDisposer = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
              name: 'conversation.input.dock',
              id: 'usage-balance-card-side',
              order: 30,
              locale: NS,
            }, SideBalanceCard))
          } else if (!featureConfig.balanceCard && cardDisposer !== undefined && cardCloseTimer === null) {
            for (const card of document.querySelectorAll('.dsub-side-card')) {
              card.setAttribute('data-closing', 'true')
            }
            cardCloseTimer = window.setTimeout(() => {
              cardCloseTimer = null
              if (cardDisposer === undefined) return
              cardDisposer()
              cardDisposer = undefined
              // Release the seat layout switch so the built-in statistics row
              // returns once the fade-out completes.
              for (const seat of document.querySelectorAll('[data-dsub-side-card]')) {
                seat.removeAttribute('data-dsub-side-card')
                seat.removeAttribute('data-dsub-compact')
                seat.removeAttribute('data-dsub-card-details')
                seat.style.removeProperty('--dsub-card-width')
                seat.style.removeProperty('--dsub-card-gap')
                seat.style.removeProperty('--dsub-card-margin')
              }
            }, 180)
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
          if (featureConfig.usageOverview && overviewDisposer === undefined) {
            overviewDisposer = ctx.slots.inject('conversation.view', () => ctx.slots.register({
              name: 'conversation.view',
              id: 'usage-overview',
              order: 21,
              locale: NS,
              label: () => t('overview.label'),
            }, UsageOverviewView))
          } else if (!featureConfig.usageOverview && overviewDisposer !== undefined) {
            overviewDisposer()
            overviewDisposer = undefined
          }
        }

        const applyConfig = next => {
          const previous = featureConfig
          const surfaceReenabled = (next.balanceCard && !previous.balanceCard)
            || (next.usageTrajectory && !previous.usageTrajectory)
            || (next.usageOverview && !previous.usageOverview)
          const changed = next.balanceCard !== previous.balanceCard
            || next.usageTrajectory !== previous.usageTrajectory
            || next.usageOverview !== previous.usageOverview
          featureConfig = next
          if (changed) {
            for (const listener of configListeners) listener()
          }
          // Register the visible surfaces first. Background projection work is
          // deferred so a service-context hiccup can never block the card/tab.
          syncSlots()
          const shouldCollect = next.balanceCard || next.usageTrajectory || next.usageOverview
          if (shouldCollect && (lastCollectEnabled !== true || surfaceReenabled)) {
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
              row('usageOverview', 'config.usageOverview', 'config.usageOverviewHint'),
              h('p', { className: 'dsub-config-note' }, t('config.note')),
            ))
        }

        const ensureConfigDefaults = () => {
          const local = readLocalConfig()
          let changed = false
          if (Object.prototype.hasOwnProperty.call(local, 'cardDetails')) {
            delete local.cardDetails
            changed = true
          }
          for (const field of ['balanceCard', 'usageTrajectory', 'usageOverview']) {
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
            usageOverview: local.usageOverview !== undefined
              ? local.usageOverview !== false
              : host === undefined ? true : host.usageOverview !== false,
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
            if (archiveSaveTimer !== 0) { window.clearTimeout(archiveSaveTimer); archiveSaveTimer = 0; saveArchive() }
            if (cardCloseTimer !== null) { window.clearTimeout(cardCloseTimer); cardCloseTimer = null }
            if (cardDisposer !== undefined) { cardDisposer(); cardDisposer = undefined }
            if (viewDisposer !== undefined) { viewDisposer(); viewDisposer = undefined }
            if (overviewDisposer !== undefined) { overviewDisposer(); overviewDisposer = undefined }
            if (configPanelDisposer !== undefined) { configPanelDisposer(); configPanelDisposer = undefined }
          }
        }, 'usage-balance: feature switches')
      },
    }
  },
})
