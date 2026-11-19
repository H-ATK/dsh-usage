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

---

## 中文

### 功能

**1. 对话框左侧的余额卡片**

- 卡片位于对话窗口内、输入框左侧；输入框向右让出空间，卡片左边距与输入框右边距一致。
- 卡片高度与输入框完全一致，并通过 `ResizeObserver` 跟随输入框实时变高/变矮；输入框被拉高到约两行内容的高度。
- 内容始终垂直居中，输入框变高时上下增加留白，而不是让内容从顶部往下跑。
- 卡片背景、边框、圆角、阴影使用与输入框相同的主题 token，自动适配深色/浅色模式。
- 只有余额数字按余额变色：`< ¥10` 深红，`< ¥50` 橙色，`≥ ¥50` 蓝色；余额数字和其它信息统一 14px，其中“上下文”三个字为 13px。
- 余额在卡片开启、切换对话窗口、每轮对话结束以及每 60 秒兜底刷新。
- 余额、上一轮和本轮消费显示在同一行；余额在左，上一轮在本轮左边，两者靠右。
- 输入框的模型/权限/发送等功能行固定在输入框底部，输入区变高时不会跟着上移。
- 同时显示**上一轮消费**和**本轮消费**；本轮还在进行时显示带小动画的“进行中”，结束后再显示金额。
- 上一轮和本轮金额使用浅红色；进行中的状态点和文字为黄色；余额大于 ¥50 时数字为蓝色。
- 上下文进度环低于 60% 为蓝色，达到 60% 为橙色，达到 90% 为红色。
- 关闭“显示其他信息”后，卡片只保留余额、上一轮和本轮消费：余额单独一行，上一轮在左、本轮在右，标签和金额/状态各占两行；此时卡片宽度和高度缩到 80%，**输入框高度也跟着缩到约 86px**。开启全部信息时输入框恢复完整高度。
- 余额卡片开启但「显示其他信息」关闭时，输入框下方的原生统计行仍然显示。
- 余额卡片关闭且「显示其他信息」关闭时，原生统计行完全消失，行高也一并取消。
- 一轮对话被突然终止且还没有产生消费时，本轮状态显示红色的“被中断”。
- 新窗口没有任何对话时只显示余额；第一轮不显示上一轮消费；第一轮进行中先显示“进行中”，结束后再显示统计、缓存和上下文。
- 当前窗口的轮次、步骤、输出速度、总 Token、缓存命中率和上下文用量都显示在卡片内。
- 输入框底部原有的统计行会隐藏，但保留原 22px 行高，所以输入框底部边距不会下移。
- 消费、状态和统计会写入 `localStorage`，重启 DSH 后先恢复上次内容，再由持久会话投影校准。
- Token 数量对中文用户使用 `万 / 亿 / 万亿 / 兆`，对英文用户使用 `K / M / B / T`。

**2. 使用量轨迹页签**

- 位于会话顶部“轨迹”右侧，注册为 Conversation View。
- 使用 Host 端 `usageTrack` 会话投影，覆盖完整持久日志，不只读取当前聊天窗口。
- 每轮显示：轮次、模型（如 `DeepSeek V4.1 Flash`）、开始时间、用时、总 Token、估算消耗、高峰/空闲、缓存命中率、命中/未命中 Token。
- 命中缓存为蓝色 8px 进度条，未命中为红色 8px 进度条；百分比按本轮总 Token 计算。
- 表格顶部标题栏使用不透明背景并吸顶，滚动时不会让轮次内容从标题栏缝隙里透出来。

### 功能开关

打开 **插件 → 已安装 → 用量余额卡片**，页面底部有“功能开关”：

- **余额卡片**：显示/隐藏左侧卡片、输入框布局让位和底部统计行替换。
- **使用量轨迹**：显示/隐藏页签及其后台收集。
- **显示其他信息**：开启时显示轮次、步骤、Token、缓存命中率和上下文；关闭时只显示余额、上一轮和本轮消费。

三个开关相互独立。开关状态保存在 `localStorage`，并同步到 Host Config（如果该配置表单可用）。重新开启余额卡片或使用量轨迹都会重新收集各会话的最后一轮投影数据。

插件首次启用时三个开关默认全部开启；之后每次切换都会立即记录，DSH 关闭再启动后按记录的状态恢复。

余额卡片关闭时：**显示其他信息开启会保留输入框下方的原生统计行；关闭则原生统计行完全消失。** 卡片因窗口过窄而隐藏时也会保留原生统计行。

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
- Balance, previous-turn spend, and current-turn spend share one row. Balance sits on the left; previous sits left of current; both costs are right-aligned.
- The model/permission/send controls stay pinned to the bottom of the input card while the input area grows.
- The card shows both **previous-turn spend** and **current-turn spend**. A running turn shows an animated Running state; the amount appears after the turn ends.
- Previous and current amounts are light red; the running dot and label are yellow; a balance above ¥50 is blue.
- The context ring is blue below 60%, orange at 60%, and red at 90%.
- With **Show other information** off, the card keeps only balance, previous-turn spend, and current-turn spend: balance on its own row, previous on the left, current on the right, each label and amount/status on separate lines; in this mode its width and height shrink to 80%, and the **input height also drops to about 86px**. Turning the other information back on restores the full input height.
- With the balance card on but **Show other information** off, the built-in composer statistics row stays visible.
- With the balance card off and **Show other information** off, the built-in statistics row disappears completely, including its reserved row height.
- A turn that is suddenly interrupted before producing spend shows a red Interrupted state.
- A new Session with no turns shows only the balance. The first turn hides previous-turn spend; while it runs it shows Running, then reveals statistics, cache, and context after it ends.
- The current window's turns, steps, output speed, total tokens, cache hit rate, and context usage live in the card.
- The composer's own statistics row is hidden while the card is enabled, but its reserved 22px row height is kept, so the composer's bottom margin does not move.
- Spend, status, and stats are written to `localStorage`; after a DSH restart the card restores them first, then reconciles with the durable Session projection.
- Token totals use `万 / 亿 / 万亿 / 兆` for Chinese users and `K / M / B / T` for English users.

**2. Usage trajectory tab**

- Registered as a Conversation View immediately after the built-in `Trajectory` tab.
- Backed by the Host `usageTrack` Session projection, covering the complete durable log rather than only the loaded chat window.
- Each turn shows: turn, model (for example `DeepSeek V4.1 Flash`), start time, duration, total tokens, estimated cost, peak/off-peak, cache hit rate, and cache-hit/cache-miss tokens.
- Cache hits use a blue 8px bar; misses use a red 8px bar. Percentages are shares of that turn's total tokens.
- The table header uses an opaque sticky background, so scrolling rows cannot leak through the header seam.

### Feature switches

Open **Plugins → Installed → Usage balance card**. The bottom of the bundle page has **Feature switches**:

- **Balance card** — show/hide the side card, the composer layout shift, and the statistics-row replacement.
- **Usage trajectory** — show/hide the tab and its background collection.
- **Show other information** — on: turns, steps, tokens, cache hit rate, and context; off: only balance and previous/current-turn spend.

The three switches are independent. Their state is stored in `localStorage` and mirrored to the Host Config when that form is served. Re-enabling Balance card or Usage trajectory runs a fresh collection of each Session's latest-turn projection.

On first enable all three switches default to on; every later change is recorded immediately and restored after a DSH restart.

With Balance card off: **Show other information on keeps the built-in composer statistics row; off removes the built-in row completely.** The built-in row is also kept when the card hides because the window is too narrow.

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
