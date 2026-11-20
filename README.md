# 用量余额卡片 / Usage balance card

> 本插件不会额外消耗 Token。它只读取本地会话投影和账户余额，不调用模型、不追加对话消息。
>
> This plugin adds no token charges. It reads local Session projections and the account balance only; it makes no model requests and appends no chat messages.

## 安装 / Install

```powershell
# 直接从 GitHub 安装
dsh plugin --profile desktop add github:H-ATK/dsh-usage
```

也可以下载仓库 ZIP，解压后在 **插件 → 添加插件** 中选择包含 `package.json` 的文件夹。

安装后重启 DSH，打开 **插件 → 已安装 → 用量余额卡片**。插件提供两个可独立开关的功能：

- **余额卡片**：对话输入框左侧的余额与本轮消费卡片。
- **使用量轨迹**：会话顶部“轨迹”右侧的按轮次用量账本。

> npm 包名为 `dsh-usage-balance-card`。

## 最新版本 1.9.0 / What's new

- **余额卡片**：显示 DeepSeek 账户余额、上一轮消费、本轮消费和当前峰谷价格；本轮进行中显示进行中状态，结束后显示金额。
- **使用量轨迹**：新增工作区/当前窗口的“付费模型”总览，以及按 provider/model 拆分的本地模型和其他付费 API 统计。
- **本地模型**：单独统计 Token 与轮次，不计入付费总览、不扣 DeepSeek 余额，轮次明细保留本地用量。
- **第三方付费 API**：Token 计入工作区/当前窗口总览，同时单独列出各厂商/模型的使用量和参考费用；无峰谷的厂商显示黄色“统一价”。
- **价格与单位**：模型拆分和官方价格表字号放大；中文用户使用“万/亿”和“每 百万 Token”，不再显示纯数字加 Token。
- **自动汇总**：首次启用、重新开启任一功能或插件重载时，自动汇总所有会话的完整轮次。

## 版本历史 / Version history

- **1.9.0**：当前版本，包含本地/第三方模型拆分、参考价规则、付费模型总览和界面优化。
- **1.0.0**：首个公开版本，提供余额卡片、使用量轨迹、峰谷价格与轮次统计。

---

## 中文

### 功能

**1. 对话框左侧的余额卡片**

- 位于对话窗口内、输入框左侧；卡片高度与输入框一致，并跟随输入框变化。
- 余额单独一行；上一轮消费在左、本轮消费靠右。
- 本轮进行中显示进行中状态，结束后显示金额；被中断的轮次显示红色中断状态。
- 余额下方实时显示当前时段：高峰为红色、空闲为蓝绿色，右侧显示输入/输出价格，金额后带 Token 单位。
- 输入框底部的官方统计行保持显示；卡片不再重复显示轮次、步骤、速度、Token、缓存或上下文。
- 余额在卡片开启、切换会话、每轮结束以及每 60 秒兜底刷新。

**2. 使用量轨迹**

- 位于会话顶部“轨迹”右侧，按轮次记录当前会话的 Token、缓存、费用、耗时和时段。
- 顶部显示两张统计卡：
  - **工作区 · 付费模型**：当前工作区所有会话的 DeepSeek 官方 + 第三方付费 API 总量。
  - **当前窗口 · 付费模型**：当前会话的总轮次、Token、费用和平均缓存命中率。
- 本地模型不计入“付费模型”总览；第三方付费 API 的 Token 计入总览，同时单独列出自家的用量和费用。
- 价格表展示 Flash 和 Pro 的官方缓存/输入/输出价格，中文单位为“每 百万 Token”；价格表与轮次表头一起吸顶。
- 每轮显示：轮次、模型、开始时间、用时、总 Token、估算消费、时段、状态、缓存命中率以及命中/未命中 Token。

**3. 本地模型和其他付费 API**

- `ollama`、`lmstudio`、`llama.cpp`、`vllm`、`local` 等本地 provider，或空 provider 且模型名以 Qwen/Llama/Mistral 等开头时，按本地模型处理。
- 本地模型：不计入付费总览、不计价、不扣 DeepSeek 余额；轮次明细仍保留实际 Token。
- 其他非 DeepSeek provider（OpenAI、Anthropic、Google、OpenRouter 等）按第三方付费 API 处理：Token 计入总览，费用在其数据包含 cost 时计入，否则显示 `--`。
- 模型用量拆分只在存在本地模型或第三方 API 用量时显示；每个模型一行，同时显示当前窗口和工作区。
- 没有使用本地/第三方模型时，不显示模型拆分和对应统计规则。

**4. 第三方 API 参考价**

页面会在第三方模型行下显示参考价，单位统一为“每 百万 Token”：

| 厂商/模型 | 输入 | 缓存读 | 缓存写 | 输出 | 峰谷 |
|---|---:|---:|---:|---:|---|
| OpenAI GPT-4o | $2.50 | $1.25 | — | $10.00 | 统一价 |
| OpenAI GPT-4o mini | $0.15 | $0.075 | — | $0.60 | 统一价 |
| Anthropic Claude 3.5 Sonnet | $3.00 | $0.30 | $3.75 | $15.00 | 统一价 |
| Anthropic Claude 3.5 Haiku | $0.80 | $0.08 | $1.00 | $4.00 | 统一价 |
| Google Gemini 1.5 Pro | $1.25 | $0.31 | — | $5.00 | 统一价 |
| Google Gemini 1.5 Flash | $0.075 | $0.018 | — | $0.30 | 统一价 |

- 上述厂商没有 DeepSeek 式高峰/空闲双价，因此第三方轮次的“时段”显示黄色“统一价”。
- 参考价仅用于展示和辅助核算，实际以厂商账单为准；币种为 USD，不混入 DeepSeek 钱包余额。
- 厂商没有统一的实时价格接口，目录带有更新日期；官方改价时需要更新参考目录。

### 功能开关

打开 **插件 → 已安装 → 用量余额卡片**，页面底部有“功能开关”：

- **余额卡片**：显示/隐藏左侧卡片。
- **使用量轨迹**：显示/隐藏页签及其后台收集。

两个开关相互独立，状态保存在 `localStorage`，并同步到 Host Config。首次启用或重新开启任一功能时，会全量汇总所有会话；之后新会话会自动加入统计。

### 数据与隐私

- 新增 Host 端 `usageTrack` 会话投影，仅折叠本地会话日志中的 Token 和耗时事件。
- 浏览器只向 Session Controller 请求投影，不修改会话记录。
- 卡片读取现有 DeepSeek 账户余额 RPC；余额数值和查询频率与原账户页面一致。
- 插件不发送会话内容到第三方，也不发起模型请求。

### 兼容性与限制

- 需要登录 DeepSeek 账户才能显示余额；未登录或余额不可用时显示 `--`。
- 余额卡片在窗口过窄时会自动隐藏，避免压缩输入框。
- 投影每个会话最多保留最近 500 轮。
- 费用按 DeepSeek 官方峰谷价估算，实际以平台账单为准；中国法定节假日未单独处理。
- 第三方 API 的余额和最终账单以对应厂商后台为准，插件无法读取。

---

## English

### Features

**Balance card**

- Sits left of the composer; height follows the composer.
- Shows the DeepSeek balance, previous-turn spend, current-turn spend, and the active peak/off-peak price.
- The native composer statistics row stays visible; the card does not duplicate turns, steps, speed, tokens, cache, or context.
- Refreshes when the card opens, on Session switch, after each turn, and every 60 seconds as a fallback.

**Usage trajectory**

- Registered next to the built-in Trajectory tab and backed by the Host `usageTrack` projection.
- **Workspace · paid models** totals DeepSeek official + third-party paid API usage; **Current window · paid models** shows the active Session.
- Local models are excluded from paid totals. Third-party tokens are included and also listed by provider/model; their cost is included only when available, otherwise `--`.
- Both Flash and Pro official prices are shown with cache/input/output columns and the “per 1M tokens” legend. The price table and turn header stay sticky.
- Each turn shows model, start time, duration, total tokens, estimated cost, window, status, and cache-hit/cache-miss details.

**Local and third-party models**

- Providers such as `ollama`, `lmstudio`, `llama.cpp`, `vllm`, and `local` are treated as local; they add no paid spend and no wallet charge.
- Other non-DeepSeek providers are treated as third-party paid APIs. Their tokens count toward paid totals; their cost is used when present.
- The model usage split appears only when local or third-party usage exists, with current-window and workspace columns.

**Third-party reference prices**

The model rows show a reference price per 1M tokens. The current catalog covers OpenAI GPT-4o/mini, Anthropic Claude 3.5 Sonnet/Haiku, and Google Gemini 1.5 Pro/Flash. These vendors use flat pricing, so third-party turn rows show a yellow “Flat price” and the reference line says “Flat price”. Vendor bills are authoritative.

### Feature switches

Open **Plugins → Installed → Usage balance card** and use the switches at the bottom to show/hide the balance card and the usage trajectory independently. A full Session collection runs when either feature is first enabled or re-enabled.

### Privacy

- The Host adds only a `usageTrack` Session projection folded from local token/timing events.
- The browser reads projections; it does not modify Session logs.
- The card uses the existing DeepSeek balance RPC.
- The plugin sends no conversation content to third parties and makes no model requests.

### Limitations

- No balance is shown without a logged-in DeepSeek account.
- The card hides on very narrow windows.
- The projection keeps up to 500 turns per Session.
- Costs are estimates based on official prices; the platform bill is authoritative.
- Third-party balance and final billing are available only from that vendor.

## License

MIT
