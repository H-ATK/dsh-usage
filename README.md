# 用量余额卡片 / Usage balance card

> 本插件不会额外消耗 Token。它只读取本地会话投影和账户余额，不调用模型、不追加对话消息。
>
> This plugin adds no token charges. It reads local Session projections and the account balance only; it makes no model requests and appends no chat messages.

![Usage balance card](https://github.com/user-attachments/assets/8ee55beb-0794-4ed3-9055-7f7c89671a79)

## 安装 / Install

从 GitHub 安装当前版本：

```powershell
dsh plugin --profile desktop add github:H-ATK/dsh-usage#v1.15.5
```

安装后重启 DSH，打开 **插件 → 已安装 → 用量余额卡片**。

也可以下载仓库 ZIP，解压后在 **插件 → 添加插件** 中选择包含 `package.json` 的文件夹。

> npm 包名为 `dsh-usage-balance-card`，以 npm 上可安装的最新版本为准。

## 最新版本 1.15.5 / What's new

- **Host 持久归档**：历史不再只依赖浏览器缓存；删除会话后，已经收集过的用量仍保留在本地 Host 归档中。
- **用量总览**：按时间范围、工作区、模型筛选；总览、工作区、模型和逐轮账本在同一页查看。
- **本地 / 第三方 / 官方分账**：本地模型不计费；第三方 API 单独统计；DeepSeek 官方按 CNY 计费。
- **逐轮价格锁定**：价格表更新后，历史轮次仍按当时的报价计算。
- **模型详情**：每个模型显示厂家图标、实际模型名、Token 构成和费用。
- **导出**：CSV 表头跟随界面语言；Excel 导出带列宽、冻结表头、行高和易读单位。
- **价格表**：DeepSeek 官方 CNY / 百万 Token 价格，加上第三方模型参考价。
- **界面**：窗口尺寸和明暗配色跟随 Windows；详情和价格表支持独立窗口查看与缩放。

## 中文

### 功能

#### 1. 余额卡片

- 位于对话输入框左侧，高度与输入框一致，跟随输入框变化。
- 显示 DeepSeek 账户余额、上一轮消费、本轮消费和当前时段价格。
- 本轮进行中显示状态，结束后显示金额；被中断的轮次显示中断状态。
- 当前时段显示高峰 / 空闲价格，金额后带每百万 Token 单位。
- 余额在卡片开启、切换会话、每轮结束以及定时兜底刷新。

#### 2. 使用量轨迹

- 位于会话顶部“轨迹”右侧，按轮次记录当前会话。
- 每轮显示：模型、开始时间、用时、Token、缓存、费用、时段、状态和缓存命中率。
- 支持本地模型和第三方 API；明细保留每轮实际用量。

#### 3. 用量总览

- 全部时间、今日、本月、7 天、30 天和自定义日期。
- 按工作区、模型筛选。
- 总览卡：总 Token、DeepSeek 消费、第三方 API 消费、轮次。
- 工作区卡：每个工作区的 Token、DeepSeek、第三方和轮次。
- Token 构成：输入、缓存读、缓存写、输出。
- 模型表：按模型汇总 Token、费用、平均缓存命中率和轮次。
- 趋势图：按时间查看 Token 与费用变化；点击柱子查看当天详情。

#### 4. 本地 / 第三方 / 官方

- `ollama`、`lmstudio`、`llama.cpp`、`vllm`、`local` 等本地 provider 不计费、不扣 DeepSeek 余额。
- OpenAI、Anthropic、Google、OpenRouter 等非 DeepSeek provider 单独作为第三方 API 统计。
- DeepSeek 官方消费使用 CNY；第三方参考价使用对应币种，不混入钱包余额。
- 第三方模型行显示具体模型名和厂家图标，不只显示“第三方 API”。

#### 5. 价格表

- DeepSeek 官方价格按 CNY / 百万 Token 单列，包含缓存读、缓存写、输入和输出。
- 第三方目录包含常用 OpenAI、Anthropic、Google 和 xAI 参考价。
- 价格表可编辑；保存后只影响之后的新报价，不重写历史。
- 参考价是辅助核算，最终以厂商账单为准。

#### 6. 导出

- **CSV**：通用逗号分隔表格，中文界面导出中文表头。
- **Excel**：带预设列宽、冻结表头、行高、统一左对齐和模型版本号；Token 数据后附带“万 / 亿”单位，费用保持原值。

#### 7. 数据与归档

- 用量历史会写入 Host 持久归档：

```text
~/.dsh/storages/dsh-usage-balance/archive.json
```

- 浏览器本地归档作为兜底，并在首次加载时迁移到 Host。
- 已经收集过的会话，即使之后被删除，也会保留在归档中。
- 归档最多保留约 100,000 轮。

### 功能开关

打开 **插件 → 已安装 → 用量余额卡片**，页面底部有独立开关：

- **余额卡片**
- **使用量轨迹**
- **用量总览**

开关状态会同步到 Host Config。启用任一功能后会汇总所有会话；之后新会话自动加入。

### 兼容性

- 需要 DSH Host `0.2.2-rc.3` 或更高版本。
- 余额需要登录 DeepSeek 账户；未登录或接口不可用时显示 `--`。
- 窗口过窄时余额卡片自动隐藏，避免压缩输入框。
- 费用为估算值，实际以平台账单为准。

### 隐私

- 只读取本地会话投影、账户余额和插件配置。
- 不发送会话内容到第三方，不发起模型请求，不修改会话日志。
- 归档数据只保存在本机 DSH 数据目录。

---

## English

### Features

- **Balance card** beside the composer: DeepSeek balance, previous-turn spend, current-turn spend, and the active peak/off-peak price.
- **Usage trajectory** tab: per-turn model, time, duration, tokens, cache, cost, window, status, and cache hit rate.
- **Usage overview**: today / month / 7 days / 30 days / all time / custom dates, plus workspace and model filters.
- **Workspace accounting**: tokens, DeepSeek spend, third-party spend, and turns for every workspace.
- **Token composition**: input, cache read, cache write, and output.
- **Model table**: per-model tokens, cost, average cache hit rate, and turns.
- **Local / third-party separation**: local providers are free and excluded from paid totals; third-party APIs are counted separately with their own currencies.
- **Price table**: DeepSeek official CNY prices per million tokens plus third-party reference prices. History keeps the quote that was active at the time.
- **CSV and Excel export**: localized CSV headers; Excel export includes preset widths, a frozen header, row height, left alignment, model versions, and compact Chinese number units for token metrics.
- **Host archive**: usage is persisted under `~/.dsh/storages/dsh-usage-balance/archive.json`; deleted Sessions that were already collected remain in history.

### Install

```powershell
dsh plugin --profile desktop add github:H-ATK/dsh-usage#v1.15.5
```

### Privacy

The plugin reads local Session projections, the account balance, and its own settings. It does not send conversation content to third parties, does not make model requests, and does not modify Session logs. Archive data stays on the local machine.

## License

MIT
