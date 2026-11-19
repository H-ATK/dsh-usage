# 安装 / Install

## 中文

这是 DeepSeek Harness 插件 `dsh-usage-balance-card`，包含 Host 投影和 Web 客户端，不需要构建。

### 从 GitHub 安装

```powershell
dsh plugin --profile desktop add github:H-ATK/dsh-usage
```

安装后重启 DSH。

### 从 npm 安装（发布后）

```powershell
dsh plugin --profile desktop add dsh-usage-balance-card
```

### 从 ZIP 安装

1. 解压仓库或 Release 里的 ZIP。
2. 打开 DSH 的 **插件 → 添加插件**，选择包含 `package.json` 的目录。
3. 重启 DSH（如果提示需要重启）。
4. 打开 **插件 → 已安装 → 用量余额卡片**。
5. 首次启用时三个开关默认全部开启：
   - 余额卡片
   - 使用量轨迹
   - 显示其他信息
6. 打开任意对话窗口即可看到卡片。之后每次切换都会记录，DSH 重启后按上次状态恢复。

### 开关行为

- 首次启用：三个开关全部开启。
- 之后每次切换立即写入 `localStorage`；DSH 关闭再启动会恢复记录的状态。
- 余额卡片开 + 显示其他信息开：统计信息在卡片里，原生统计行隐藏。
- 余额卡片开 + 显示其他信息关：卡片只保留余额、上一轮、本轮消费，原生统计行显示。
- 余额卡片关 + 显示其他信息开：原生统计行显示。
- 余额卡片关 + 显示其他信息关：原生统计行完全消失，包括行高。
- 卡片因窗口过窄隐藏时，原生统计行保留。

### 兼容性

- 开发和测试环境：DSH `0.2.2-rc.3` / DSH NEXT `2.0.23-next`。
- 使用 DSH 的 Session projection、Conversation View、`conversation.input.dock` / `conversation.composer.dock` 和账户余额 RPC。
- 卡片尺寸跟随输入框，依赖 DSH 当前输入框的 `data-composer-seat`、`data-composer-card`、`data-composer-dock` 标记。DSH 大版本升级后如果输入框 DOM 变化，卡片可能需要适配。
- 建议在相近的 DSH 版本上使用。
- 本插件不调用模型、不追加消息，不会额外消耗 Token。

## English

DeepSeek Harness plugin `dsh-usage-balance-card`: Host projection plus Web client, no build step.

### Install from GitHub

```powershell
dsh plugin --profile desktop add github:H-ATK/dsh-usage
```

Restart DSH after installation.

### Install from npm (once published)

```powershell
dsh plugin --profile desktop add dsh-usage-balance-card
```

### Install from a ZIP

1. Extract the repository or Release ZIP.
2. Open **Plugins → Add plugin** and choose the folder containing `package.json`.
3. Restart DSH if prompted.
4. Open **Plugins → Installed → Usage balance card**.
5. On first enable all three switches default to on:
   - Balance card
   - Usage trajectory
   - Show other information
6. Open any conversation to see the card. Every later toggle is recorded and restored after a DSH restart.

### Switch behavior

- First enable: all three switches on.
- Every later change is written to `localStorage`; a DSH restart restores the recorded state.
- Balance card on + Show other information on: statistics live in the card, native row hidden.
- Balance card on + Show other information off: the card keeps only balance and previous/current-turn spend, and the native row stays visible.
- Balance card off + Show other information on: native row visible.
- Balance card off + Show other information off: native row disappears completely, including its height.
- When the card hides because the window is narrow, the native row stays visible.

### Compatibility

- Built and tested against DSH `0.2.2-rc.3` / DSH NEXT `2.0.23-next`.
- Uses DSH Session projections, Conversation View, `conversation.input.dock` / `conversation.composer.dock`, and the account balance RPC.
- The card size follows the composer and relies on the current `data-composer-seat`, `data-composer-card`, and `data-composer-dock` markers. A future DSH major UI change may require adapting those markers.
- Use it on a similar DSH version.
- The plugin makes no model requests, appends no messages, and adds no token charges.
