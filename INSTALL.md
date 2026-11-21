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
4. 打开 **插件 → 已安装 → 使用量统计**。
5. 首次启用时两个开关默认全部开启：
   - 余额卡片
   - 使用量轨迹
6. 打开任意对话窗口即可看到余额卡片和使用量轨迹页签。

### 功能开关

- 首次启用：两个开关全部开启。
- 之后每次切换立即写入 `localStorage`；DSH 关闭再启动会恢复记录的状态。
- 余额卡片开：输入框左侧显示余额、上一轮/本轮消费、当前时段状态与价格；输入框底部的官方统计行始终显示。
- 余额卡片关：布局恢复，官方统计行保持显示。
- 使用量轨迹开：顶部显示页签，首次开启或重新开启时全量收集所有会话；每轮结束更新当前窗口和工作区统计。
- 使用量轨迹关：页签移除，不影响余额卡片。
- 价格表的“当前”跟随 `modelSelection` 投影；切到本地模型时，会在价格图例下方显示本地模型名和“当前”。
- 本地模型不计入总 Token、总消费或平均缓存命中率，也不产生余额消费；轮次明细仍显示该行 Token，并标“本地 / 不计费”。
- 卡片因窗口过窄隐藏时，官方统计行保持显示。

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
4. Open **Plugins → Installed → Usage statistics**.
5. On first enable both switches default to on:
   - Balance card
   - Usage trajectory
6. Open any conversation to see the balance card and Usage trajectory tab.

### Feature switches

- First enable: both switches on.
- Every later change is written to `localStorage`; a DSH restart restores the recorded state.
- Balance card on: balance, previous/current-turn spend, and current window state/price sit left of the composer; the official composer statistics row always stays visible.
- Balance card off: the composer layout returns; the official statistics row stays visible.
- Usage trajectory on: show the tab; first enable or re-enable runs a full collection across all Sessions; every completed turn refreshes the current-window and workspace totals.
- Usage trajectory off: remove the tab; the balance card is unaffected.
- The price table’s “Current” badge follows the `modelSelection` projection; a selected local model appears below the legend with its name and “Current”.
- Local models add no aggregate tokens, cost, average cache hit rate, or wallet spend; turn rows still show their tokens and mark Local / free.
- When the card hides because the window is narrow, the official statistics row stays visible.

### Compatibility

- Built and tested against DSH `0.2.2-rc.3` / DSH NEXT `2.0.23-next`.
- Uses DSH Session projections, Conversation View, `conversation.input.dock` / `conversation.composer.dock`, and the account balance RPC.
- The card size follows the composer and relies on the current `data-composer-seat`, `data-composer-card`, and `data-composer-dock` markers. A future DSH major UI change may require adapting those markers.
- Use it on a similar DSH version.
- The plugin makes no model requests, appends no messages, and adds no token charges.
