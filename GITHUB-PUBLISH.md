# GitHub 发布步骤

> 目标：把 `C:\Users\20823\Desktop\dsh-usage-balance-v20` 发布成一个公开 GitHub 仓库，让别人可以用 GitHub 安装。

## 0. 先确认仓库根目录

仓库根目录必须直接包含：

```text
package.json
index.js
client.js
cordis.patch.yml
icon.svg
README.md
INSTALL.md
locale/
```

如果 `package.json` 不在仓库根目录，DSH 从 GitHub 安装时会找不到 bundle。

## 方式一：GitHub 网页上传（不用安装 Git，最快）

1. 打开 https://github.com/new
2. 仓库名例如 `dsh-usage-balance-card`，选择 **Public**，不要勾选自动生成 README。
3. 创建后点击 **uploading an existing file**。
4. 进入 `C:\Users\20823\Desktop\dsh-usage-balance-v20`，**全选里面的文件和 `locale` 文件夹**，拖到上传区。
   - 不要把外层 `dsh-usage-balance-v20` 文件夹整个拖进去，否则 `package.json` 会变成子目录。
5. Commit，例如 `Initial release v0.20.0`。
6. 在仓库 **About** 里填写描述，添加 topics：`dsh-plugin`、`deepseek-harness`、`usage`、`balance`。
7. 在 **Releases → Draft a new release** 创建 `v0.20.0`，上传桌面上的 zip/tgz。
8. 安装命令：

```powershell
dsh plugin --profile desktop add github:<你的GitHub用户名>/dsh-usage-balance-card
```

## 方式二：GitHub Desktop（推荐长期维护）

1. 安装 https://desktop.github.com/
2. 打开 GitHub Desktop → **File → Add local repository**。
3. 选择 `C:\Users\20823\Desktop\dsh-usage-balance-v20`。
4. 如果提示不是 Git 仓库，选择 **create a repository**，名称例如 `dsh-usage-balance-card`。
5. 提交所有文件，点击 **Publish repository**，取消勾选 Private。
6. 后续修改：在 GitHub Desktop 里写 Summary → Commit → Push。

## 方式三：Git 命令行

先安装 Git for Windows：

```powershell
winget install --id Git.Git -e
```

然后：

```powershell
cd "C:\Users\20823\Desktop\dsh-usage-balance-v20"

git init
git add .
git commit -m "Initial release v0.20.0"
git branch -M main
git remote add origin https://github.com/<你的用户名>/dsh-usage-balance-card.git
git push -u origin main
```

如果 Git 提示没有身份：

```powershell
git config user.name "<你的名字>"
git config user.email "<你的邮箱>"
```

GitHub 不再接受账号密码推送，需要使用 Personal Access Token 或 SSH：
- Personal Access Token：https://github.com/settings/tokens
- 或 `gh auth login`（GitHub CLI）：https://cli.github.com/

## 发布前建议

- 加一个 `LICENSE`（MIT 最省事），否则别人默认没有复制/修改授权。
- README 里放 1 张卡片截图 + 1 张使用量轨迹截图，最好再放一个 10 秒 GIF。
- 写明：
  - 支持哪些 DSH 版本；
  - 安装命令；
  - “不调用模型、不追加消息、不额外消耗 Token”；
  - DSH 大版本升级可能需要适配输入框 DOM。
- 仓库加 topic `dsh-plugin`，这是 DSH 生态发现插件的重要方式。
- 发布后提交到社区索引：DSH Plugin Hub、awesome-dsh-plugin、dsh-plugin-index 等。

## 关于 package.json

当前包名是 `@local/dsh-usage-balance-v20`，`private: true`。

- **只发 GitHub**：通常可以保留；如果安装器拒绝 private 包，删除 `"private": true` 再提交。
- **还要发 npm**：必须改成公开唯一包名，并删除 `private: true`；同时插件里的 bundle 名称、client id、config key 要相应更新，不能只改 package.json。
