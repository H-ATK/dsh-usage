# 安装 / Install

## 中文

这是一个 DSH 本地插件包，包含 Host 投影和 Web 客户端，不需要构建。

### 安装方式一：插件页面

1. 解压 `dsh-usage-balance-v20.zip`。
2. 打开 DSH 的 **插件 → 添加插件**，选择解压后包含 `package.json` 的目录。
3. 安装后重启 DSH（如果 DSH 提示需要重启）。
4. 打开 **插件 → 已安装 → 用量余额卡片**；首次启用时三个开关默认全部开启：
   - 余额卡片
   - 使用量轨迹
   - 显示其他信息
5. 打开任意对话窗口即可看到卡片。之后每次切换都会记录，DSH 重启后按上次状态恢复。

### 安装方式二：命令行

```powershell
dsh plugin --profile desktop add "C:\path\to\dsh-usage-balance-v20"
# 或使用 tgz：
dsh plugin --profile desktop add "C:\path\to\dsh-usage-balance-v20.tgz"
```

安装后重启 DSH。

### 开关行为

- 首次启用：三个开关全部开启。
- 之后每次切换立即写入 `localStorage`；DSH 关闭再启动会恢复记录的状态。
- 余额卡片关闭 + 显示其他信息开启：显示输入框下方原生统计行。
- 余额卡片关闭 + 显示其他信息关闭：原生统计行完全消失（包括行高）。
- 余额卡片开启 + 显示其他信息关闭：卡片只保留余额、上一轮、本轮消费，原生统计行显示。

## 兼容性

- 开发和测试环境：DSH `0.2.2-rc.3` / DSH NEXT `2.0.23-next`。
- 插件使用 DSH 的 Session projection、Conversation View、`conversation.input.dock` / `conversation.composer.dock` 和账户余额 RPC。
- 卡片的尺寸跟随输入框，依赖 DSH 当前输入框的 `data-composer-seat`、`data-composer-card`、`data-composer-dock` 标记。DSH 大版本升级后如果输入框 DOM 变化，卡片可能需要适配。
- 未设置 npm `engines.dsh` 限制，因此不会因为版本范围被直接拦截；建议在相近的 DSH 版本上使用。
- 本插件不调用模型、不追加消息，不会额外消耗 Token。

## English

This is a local DSH plugin bundle with Host and Web client halves; no build step.

### Install from the plugin page

1. Extract `dsh-usage-balance-v20.zip`.
2. Open **Plugins → Add plugin** and choose the extracted folder containing `package.json`.
3. Restart DSH if prompted.
4. Open **Plugins → Installed → Usage balance card**; on first enable all three switches default to on:
   - Balance card
   - Usage trajectory
   - Show other information
5. Open any conversation to see the card. Every later toggle is recorded and restored after a DSH restart.

### Install from the CLI

```powershell
dsh plugin --profile desktop add "C:\path\to\dsh-usage-balance-v20"
# or the tgz:
dsh plugin --profile desktop add "C:\path\to\dsh-usage-balance-v20.tgz"
```

Restart DSH after installation.

### Switch behavior

- First enable: all three switches on.
- Every later change is written to `localStorage`; a DSH restart restores the recorded state.
- Balance card off + Show other information on: the built-in composer statistics row stays visible.
- Balance card off + Show other information off: the built-in row disappears completely, including its row height.
- Balance card on + Show other information off: the card keeps only balance and previous/current-turn spend, and the built-in statistics row stays visible.

### Compatibility

- Built and tested against DSH `0.2.2-rc.3` / DSH NEXT `2.0.23-next`.
- Uses DSH Session projections, Conversation View, `conversation.input.dock` / `conversation.composer.dock`, and the account balance RPC.
- The card size follows the composer and relies on the current `data-composer-seat`, `data-composer-card`, and `data-composer-dock` markers. A future DSH major UI change may require adapting those markers.
- No `engines.dsh` range is set, so installation is not blocked by a range; use it on a similar DSH version.
- The plugin makes no model requests, appends no messages, and adds no token charges.
