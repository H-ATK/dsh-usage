# 用量余额卡片 / Usage balance card

> 本插件不会额外消耗 Token。它只读取本地会话投影和账户余额，不调用模型、不追加对话消息。
>
> This plugin adds no token charges. It reads local Session projections and the account balance only; it makes no model requests and appends no chat messages.

## 安装 / Install

```powershell
# npm（发布后）
dsh plugin --profile desktop add dsh-usage-balance-card

# 直接从 GitHub 安装
dsh plugin --profile desktop add github:H-ATK/dsh-usage
```

也可以下载仓库 ZIP，解压后在 **插件 → 添加插件** 中选择包含 `package.json` 的文件夹。安装后重启 DSH，打开 **插件 → 已安装 → 用量余额卡片**。

> npm 包名为 `dsh-usage-balance-card`；发布前请使用上面的 GitHub 安装方式。

## 最新版本 1.9.0 / What's new

- **删除所有假数据**：移除“查看示例数据”按钮、合成轮次和本地/第三方示例行，安装后只显示真实会话数据。
- **首次启用、重新开启余额卡片/使用量轨迹、插件重载**：都会清空缓存并全量收集所有 Session 的完整轮次。
- **重复收集不再重复显示**：每个 Session 的轮次按 `turn` 去重，工作区合并先对 Session ID 去重；刷新、开关、重新挂载都不会多出一条相同记录。
- **打开轨迹时缓存为空**：会补做一次全量收集，避免只显示当前窗口的半份数据。
- 保留 1.8.5 的第三方黄色“统一价”、模型拆分/官方价格大字号、第三方参考价行和统计规则。

> 升级后首次打开 **插件 → 已安装 → 用量余额卡片**，建议重启 DSH 一次，确保旧的 Host Config 结构完全卸载。

## 以往版本 / Previous versions

- **1.8.5**：模型用量拆分和官方价格表字号调大；第三方轮次“时段”改为黄色“统一价”；参考价说明改为“统一价”。
- **1.8.4**：内置第三方 API 参考价目录（OpenAI/Anthropic/Google）；本地/第三方示例数据；中文万/亿单位。
- **1.8.3**：增加轨迹内示例数据开关（1.9.0 已删除）。
- **1.8.2**：厂商名称规范为 OpenAI、LM Studio、Anthropic、Google 等。
- **1.8.1**：模型拆分同时显示当前窗口/工作区；未使用本地或第三方时不显示拆分。
- **1.8.0**：新增模型用量拆分、本地/第三方分组与统计规则。
- **1.7.0**：本地/非官方路由不计价、不计入总量；余额卡片本地状态。
- **1.6.0**：移除卡片多余明细，恢复官方底部统计行；纯色统计卡；价格表双列图例。
- 更早版本的详细变更见 [CHANGELOG.md](CHANGELOG.md)。

**English summary:** 1.9.0 removes the example-data toggle and all synthetic rows, performs a full Session collection on first enable/re-enable/reload, deduplicates every projection by turn, and avoids duplicate workspace Session IDs. Earlier entries remain in [CHANGELOG.md](CHANGELOG.md).

---

## 中文

### 功能

**1. 对话框左侧的余额卡片**

- 卡片位于对话窗口内、输入框左侧；输入框向右让出空间，卡片左边距与输入框右边距一致。
- 卡片高度与输入框完全一致，并通过 `ResizeObserver` 跟随输入框实时变高/变矮；输入框保持约两行内容的高度（约 108px）。
- 内容始终垂直居中，输入框变高时上下增加留白，而不是让内容从顶部往下跑。
- 卡片背景、边框、圆角、阴影使用与输入框相同的主题 token，自动适配深色/浅色模式。
- 只有余额数字按余额变色：`< ¥10` 深红，`< ¥50` 橙色，`≥ ¥50` 蓝色。
- 余额单独一行；上一轮和本轮消费在下一行。余额在卡片开启、切换对话窗口、每轮对话结束以及每 60 秒兜底刷新。
- 输入框的模型/权限/发送等功能行固定在输入框底部，输入区变高时不会跟着上移。
- 同时显示**上一轮消费**和**本轮消费**；本轮还在进行时显示带小动画的“进行中”，结束后再显示金额。
- 上一轮和本轮金额使用浅红色；进行中的状态点和文字为黄色；余额大于 ¥50 时数字为蓝色。
- 卡片宽度比原来缩小约五分之一（约 224px），高度仍与输入框一致（约 108px）。
- 余额下方实时显示当前时段：**高峰时段为红色、空闲时段为蓝绿色**；右侧显示当前时段的输入/输出价格，数字蓝色，金额后面带 Token 单位。字号与“本轮消费”一致。时段状态在右侧两行价格的中间垂直居中。
- 上一轮消费在左、本轮消费靠右；消费行和下方时段信息之间留有间距，避免挤在一起。
- 时段每 15 秒检查一次，跨过 9:00/12:00/14:00/18:00 会自动切换。
- 输入框底部的官方默认统计行保持显示；卡片不再显示轮次、步骤、速度、Token、缓存命中率或上下文，也没有“显示其他信息”开关。
- 一轮对话被突然终止且还没有产生消费时，本轮状态显示红色的“被中断”。
- 新窗口没有任何对话时显示余额和当前时段价格；第一轮不显示上一轮消费；第一轮进行中先显示“进行中”，结束后再显示金额。
- 消费和状态会写入 `localStorage`，重启 DSH 后先恢复上次内容，再由持久会话投影校准。
- Token 数量对中文用户使用 `万 / 亿 / 万亿 / 兆`，对英文用户使用 `K / M / B / T`。

**2. 使用量轨迹页签**

- 位于会话顶部“轨迹”右侧，注册为 Conversation View。
- 使用 Host 端 `usageTrack` 会话投影，覆盖完整持久日志，不只读取当前聊天窗口。
- 页面顶部先显示**工作区 · 付费模型**卡片：当前会话所属工作区下所有对话窗口的总 Token、总消费金额和总轮次（DeepSeek 官方 + 第三方付费 API，本地模型不计入）；下面再单独显示**当前窗口 · 付费模型**卡片，包含总轮次、总 Token、累计费用和平均缓存命中率（按输入 Token 加权）。两张卡片用浅蓝/浅紫纯色背景和“全部对话”/“当前对话”标签区分，不使用渐变或左侧月牙色条；空白的“新会话”不计入工作区窗口数，本地模型单独显示。
- 当前窗口卡片下方显示 **Flash 和 Pro 两档官方价格**（缓存、输入、输出，每百万 Token，数字蓝色），并附带官方价版本。中文用户显示“每 百万 Token”，不再出现 `/1M`。价格表每个价格列下方都重复显示“缓存 / 输入 / 输出 · 每 百万 Token”，与对应价格列对齐。价格表与轮次表头一起吸顶；页面标题和两张统计卡片会随轮次列表向上滚动而隐藏。
- 当前窗口卡片下方新增**模型用量拆分**（仅当使用过本地模型或第三方付费 API 时显示）：每个模型一行，同时显示**当前窗口**和**工作区**两列；本地模型标“不计费”，第三方付费 API 标“计入总览”，并显示模型名和 provider。没有本地/第三方用量时，模型拆分和统计规则都不显示。
- 统计规则在页面内展开说明：DeepSeek 官方和其他付费 API 计入工作区/当前窗口总 Token、总消费和平均缓存命中率；本地模型单独统计、不计入总量、不扣 DeepSeek 余额。第三方费用以厂商账单为准，没有可用价格时显示 `--`。
- 价格表通过 `modelSelection` 投影实时读取用户当前选择的模型，“当前”标签会跟随切换更新，不需要等下一轮。切到本地模型或第三方 API 时，在价格图例下方显示对应外部模型行和“当前”，不会把外部模型错误标成 Flash 或 Pro。
- 价格表和每轮费用共用同一张官方价表（`FLASH_PRICES` / `PRO_PRICES`）；官方价版本从当前官方模型 id 解析（例如 V4.1），价格日期使用 `PRICING_DATE`。官方模型或价格更新时同步价表和日期即可。
- 每轮显示：轮次、模型（如 `DeepSeek V4.1 Flash`）、开始时间、用时、总 Token、估算消耗、高峰/空闲、缓存命中率、命中/未命中 Token。
- 命中缓存为蓝色 8px 进度条，未命中为红色 8px 进度条；百分比按本轮**输入 Token**计算，两者合计 100%，蓝色缓存命中率与命中百分比一致。
- 表格顶部标题栏和官方价格表使用不透明背景并吸顶，滚动时只有它们保持可见，统计卡片和页面标题会收上去隐藏。

### 功能开关

打开 **插件 → 已安装 → 用量余额卡片**，页面底部有“功能开关”：

- **余额卡片**：显示/隐藏左侧卡片；输入框底部的官方统计行始终显示。
- **使用量轨迹**：显示/隐藏页签及其后台收集。

两个开关相互独立。开关状态保存在 `localStorage`，并同步到 Host Config（如果该配置表单可用）。首次开启或重新开启使用量轨迹时，会全量收集所有会话的完整轮次投影；之后每轮对话结束都会更新当前窗口统计，并刷新当前工作区其他会话的数据。

插件首次启用时两个开关默认全部开启；之后每次切换都会立即记录，DSH 关闭再启动后按记录的状态恢复。

余额卡片关闭时，左侧卡片移除；输入框底部的官方统计行始终显示。

### 本地模型与其他付费 API

- provider 为 `ollama`、`lmstudio`、`llama.cpp`、`vllm`、`local` 等本地路由，或 provider 为空但模型名以 Qwen/Llama/Mistral 等开头时，按本地模型处理，不会套用 Flash/Pro 价格。
- 其他非 DeepSeek provider（OpenAI、Anthropic、Google、OpenRouter 等）按第三方付费 API 处理，计入工作区/当前窗口总量，并按 provider/model 单独列出。
- 本地模型不增加钱包消费、不计入总 Token、总消费和平均缓存命中率；第三方 API 的 Token 计入总量，费用只有在其 usage/cost 数据可用时才计入，否则显示 `--`，以厂商账单为准。
- 轮次明细仍保留该行的实际 Token，方便查看本地/第三方用量；本地行消耗显示 `--`、时段标“本地”，第三方行按实际模型和厂商记录。
- 工作区/当前窗口总轮次仍包含本地轮次，旁边会显示“本地 N · 不计费”，明确说明为什么 Token/金额总量比轮次数对应的少。
- 余额卡片在选中本地模型时显示“本地模型 / 不消耗余额”，选中第三方 API 时显示“第三方 API / 费用以厂商账单为准”，不显示 DeepSeek 官方峰谷价格，也不记录 DeepSeek 钱包消费。
- 本地模型在价格图例下方单独显示“本地模型 模型名 当前”，第三方 API 显示“第三方 API 模型名 当前”，都不占用 Flash/Pro 的“当前”标记。

### 第三方 API 账单规则

页面会在每个第三方模型行下显示参考价预算规则，单位为“每 百万 Token”。目前内置的参考目录（2026-11-20）：

| 厂商/模型 | 输入 | 缓存读 | 缓存写 | 输出 | 峰谷 |
|---|---:|---:|---:|---:|---|
| OpenAI GPT-4o | $2.50 | $1.25 | — | $10.00 | 无峰谷，统一价 |
| OpenAI GPT-4o mini | $0.15 | $0.075 | — | $0.60 | 无峰谷，统一价 |
| Anthropic Claude 3.5 Sonnet | $3.00 | $0.30 | $3.75 | $15.00 | 无峰谷，统一价 |
| Anthropic Claude 3.5 Haiku | $0.80 | $0.08 | $1.00 | $4.00 | 无峰谷，统一价 |
| Google Gemini 1.5 Pro | $1.25 | $0.31 | — | $5.00 | 无峰谷，统一价 |
| Google Gemini 1.5 Flash | $0.075 | $0.018 | — | $0.30 | 无峰谷，统一价 |

- 上述厂商没有 DeepSeek 那种高峰/空闲双价，因此界面显示“高峰=空闲（无峰谷）”；DeepSeek 官方仍按峰谷表。
- 参考价只用于展示和辅助核算，实际以厂商账单为准；币种为 USD，不会直接混入 DeepSeek 钱包余额。
- 厂商没有统一的机器可读实时价格接口，所以这里是**带日期的目录**，不是自动抓取。官方改价时需要更新 `BILLING_CATALOG` 和日期；后续可接厂商账单/价格接口做自动同步。
- 第三方 Token 计入工作区/当前窗口总量；第三方费用只有有可用 cost 时才计入总费用，否则显示 `--`。

### 数据与隐私

- 新增一个 Host 端 `usageTrack` 会话投影，仅折叠本地会话日志中的 Token 和耗时事件。
- 启用功能后，浏览器会向 Session Controller 请求当前列表里每个会话的投影，并在本地缓存；不会修改会话记录。
- 卡片读取现有 DeepSeek 账户余额 RPC；余额数值和查询频率与原账户页面一致。
- 插件不发送任何会话内容到第三方，也不发起模型请求。

### 兼容性与限制

- 需要登录 DeepSeek 账户才能显示余额；未登录或余额不可用时显示 `--`。
- 余额卡片在对话窗口过窄时会自动隐藏，避免把输入框压得过窄；阈值随窗口宽度自适应。
- 投影每个会话最多保留最近 500 轮。
- 费用按 DeepSeek 官方峰谷价估算，实际以平台账单为准；中国法定节假日未单独处理。
- “本轮 Token 用量 / Turn token usage”是另一个独立插件；关闭它不会影响本插件。

---

## English

### Features

**1. Side balance card left of the composer**

- The card sits inside the conversation window, left of the input card. The input card shifts right so the card's left margin and the input card's right margin match.
- Its height equals the input card exactly and follows every draft resize through a `ResizeObserver`; the input is raised to about two lines of content.
- Content stays vertically centered: growth adds space above and below instead of pushing the content down.
- Background, border, radius, and shadow use the same theme tokens as the input card, so it follows light and dark themes.
- Only the balance number changes color: deep red below `¥10`, orange below `¥50`, blue at `¥50` or above. The balance number and other information are 14px; the word “Context” is 13px.
- The balance refreshes when the card mounts, when the Session switches, after each completed turn, and every 60 seconds as a safety net.
- Balance sits on its own line; previous and current-turn spend sit on the next line, aligned left and right. The balance refreshes when the card mounts, when the Session switches, after each completed turn, and every 60 seconds as a safety net.
- The card shows both **previous-turn spend** and **current-turn spend**. A running turn shows an animated Running state; the amount appears after the turn ends.
- Previous and current amounts are light red; the running dot and label are yellow; a balance above ¥50 is blue.
- The card is about one-fifth narrower (about 224px) and still matches the composer height (about 108px).
- Below the balance, show the live window state — **peak in red, off-peak in teal** — with the current input/output prices on the right in blue, each followed by the token unit. The font size matches the current-turn cost. The state is vertically centered between the two price lines.
- Previous-turn spend is left-aligned and current-turn spend is right-aligned; the spend row has extra spacing below it so it is separated from the window row.
- The built-in composer statistics row stays visible; the card no longer shows turns, steps, speed, tokens, cache hit rate, context, or a “Show other information” switch.
- A turn that is suddenly interrupted before producing spend shows a red Interrupted state.
- A new Session with no turns shows the balance and current-window price. The first turn hides previous-turn spend; while it runs it shows Running, then reveals the amount after it ends.
- Spend and status are written to `localStorage`; after a DSH restart the card restores them first, then reconciles with the durable Session projection.
- Token totals use `万 / 亿 / 万亿 / 兆` for Chinese users and `K / M / B / T` for English users.

**2. Usage trajectory tab**

- Registered as a Conversation View immediately after the built-in `Trajectory` tab.
- Backed by the Host `usageTrack` Session projection, covering the complete durable log rather than only the loaded chat window.
- A **workspace · paid models** card at the top totals all conversations in the current Session’s workspace: total tokens, total estimated cost, and total turns (DeepSeek official + third-party paid APIs; local models excluded). A separate **current window · paid models** card sits directly below it with the window’s total turns, total tokens, total estimated cost, and weighted average cache hit rate. Blank “new Session” rows are excluded from the workspace window count. The cards use pale blue/violet solid backgrounds and scope badges; there is no gradient and no crescent-like left accent border.
- Below the current-window card, a **Model usage split** appears only when local or third-party paid models have been used. Each model gets one row with both **current-window** and **workspace** columns; local rows are “free”, third-party rows are “in totals”, and both show the model and provider names.
- Detailed statistics rules are shown inside the view: DeepSeek official and other paid APIs count toward workspace/current total tokens, cost, and average cache hit rate; local models are separate and free. Third-party cost is vendor-bill based and shows `--` when unavailable. If no local/third-party usage exists, the split and rules are hidden.
- Below the current-window card, show **both Flash and Pro official prices** (cache/input/output per 1M tokens, blue numbers) plus the official price version. Chinese users see “每 百万 Token” instead of `/1M`. The “Cache / Input / Output · per 1M tokens” legend repeats under each price column and aligns with that column. The price table and turn table header stay sticky; the page title and both summary cards scroll away with the turn history.
- The price table reads the selected model from the `modelSelection` projection, so the “Current” badge moves as soon as the user switches models, without waiting for the next turn. A selected local model shows “Local model · name · Current”; a third-party model shows “Third-party API · name · Current”, without taking the Flash/Pro Current badge.
- The price table and per-turn costs share the same official price table (`FLASH_PRICES` / `PRO_PRICES`); the official price version is derived from the selected official model id (for example V4.1), and the price date comes from `PRICING_DATE`. Update the tables and date when DeepSeek changes its model or pricing.
- Each turn shows: turn, model (for example `DeepSeek V4.1 Flash`), start time, duration, total tokens, estimated cost, peak/off-peak, cache hit rate, and cache-hit/cache-miss tokens.
- Cache hits use a blue 8px bar; misses use a red 8px bar. Percentages are shares of that turn’s **input tokens**, so they sum to 100% and the blue hit rate matches the hit percentage.
- The table header and official price table use opaque sticky backgrounds; only they stay visible while the summary cards and page title scroll away.

### Feature switches

Open **Plugins → Installed → Usage balance card**. The bottom of the bundle page has **Feature switches**:

- **Balance card** — show/hide the side card. The official composer statistics row remains visible either way.
- **Usage trajectory** — show/hide the tab and its background collection.

The two switches are independent. Their state is stored in `localStorage` and mirrored to the Host Config when that form is served. First enable, or re-enabling Usage trajectory, runs a full projection collection across all Sessions. Every completed turn refreshes the current-window card and other Sessions in the current workspace.

On first enable both switches default to on; every later change is recorded immediately and restored after a DSH restart.

With Balance card off, the side card is removed; the official composer statistics row is always visible.

### Local models and other paid APIs

- Providers such as `ollama`, `lmstudio`, `llama.cpp`, `vllm`, and `local`, or an empty provider with a Qwen/Llama/Mistral-style model name, are treated as local and never use Flash/Pro prices.
- Other non-DeepSeek providers (OpenAI, Anthropic, Google, OpenRouter, etc.) are treated as third-party paid APIs, included in workspace/current totals, and listed separately by provider/model.
- Local turns add no wallet charge and are excluded from aggregate tokens, aggregate cost, and the average cache hit rate. Third-party tokens are included in totals; their cost is included only when usage/cost data is available, otherwise it shows `--` and the vendor bill is authoritative.
- Turn rows keep their actual tokens for transparency; local rows show `--` cost and a Local window label, while third-party rows record their own route.
- Workspace/current total turns still include local turns, with a “Local N · free” chip explaining why the token/cost totals are lower than the turn count.
- With a local model selected, the balance card shows “Local model / No balance charge”; with a third-party API it shows “Third-party API / billing follows the provider”. Neither takes Flash/Pro peak/off-peak prices or records DeepSeek wallet spend.
- A selected local model appears below the price legend as “Local model · name · Current”; a third-party model appears as “Third-party API · name · Current”, without taking the Flash/Pro Current badge.

### Third-party API billing rules

Each third-party model row shows a reference billing line per 1M tokens. The built-in catalog (2026-11-20):

| Vendor/model | Input | Cached | Cache write | Output | Peak/off-peak |
|---|---:|---:|---:|---:|---|
| OpenAI GPT-4o | $2.50 | $1.25 | — | $10.00 | Flat (no peak/off) |
| OpenAI GPT-4o mini | $0.15 | $0.075 | — | $0.60 | Flat |
| Anthropic Claude 3.5 Sonnet | $3.00 | $0.30 | $3.75 | $15.00 | Flat |
| Anthropic Claude 3.5 Haiku | $0.80 | $0.08 | $1.00 | $4.00 | Flat |
| Google Gemini 1.5 Pro | $1.25 | $0.31 | — | $5.00 | Flat |
| Google Gemini 1.5 Flash | $0.075 | $0.018 | — | $0.30 | Flat |

- These vendors do not publish a DeepSeek-style peak/off-peak split, so the UI says “Peak = off-peak (flat)”; DeepSeek official keeps its peak/off table.
- Reference prices are for display/reconciliation only; the vendor bill is authoritative. They are in USD and are not mixed into the DeepSeek wallet balance.
- There is no single machine-readable live price API across vendors, so this is a **dated catalog**, not an automatic scrape. Update `BILLING_CATALOG` and its date when the vendor changes prices; a later version can import vendor bills or price APIs.
- Third-party tokens count toward workspace/current totals; third-party cost counts only when a cost value is available, otherwise it shows `--`.

### Data and privacy

- The Host half registers one `usageTrack` Session projection that folds local token and timing events.
- When enabled, the browser requests projections for every Session in the current list and caches them locally. It never writes to Session logs.
- The card reads the existing DeepSeek account balance RPC. Balance values and query cadence match the account UI.
- The plugin sends no conversation content to third parties and makes no model requests.

### Compatibility and limitations

- A signed-in DeepSeek account is required for the balance; signed out or unavailable shows `--`.
- The side card hides automatically when the conversation column is too narrow, so it never crushes the composer. Thresholds adapt to the column width.
- The projection keeps at most the most recent 500 turns per Session.
- Cost is estimated from DeepSeek's official peak/off-peak prices; the platform bill is authoritative. Chinese statutory holidays are not special-cased.
- **Turn token usage** is a separate plugin. Disabling it does not affect this plugin.

<img width="1201" height="840" alt="ca345da42e89c4de862459ac74a772e8" src="https://github.com/user-attachments/assets/ac516b31-1d8b-4086-9119-568c062412b2" />

<img width="1330" height="840" alt="621fd097fb47299f2be8cf9df60b3393" src="https://github.com/user-attachments/assets/4ec0917b-7c0f-4d8b-8279-0590defce22a" />

<img width="1330" height="840" alt="e537a3f540b76d569d4420216a424f5d" src="https://github.com/user-attachments/assets/c3e464c5-26a7-40e3-9a38-991064e23777" />
