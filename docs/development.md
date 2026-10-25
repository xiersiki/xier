# 开发与会话协作

## 从任务开始

GitHub Issue 描述目标、范围、验收和依赖；飞书知识库解释背景与决策。读取 [AGENTS.md](../AGENTS.md)、[知识索引](FEISHU-INDEX.md) 与任务资料后，检查 `git status`，确认没有接管其他会话的未提交改动。

```bash
git fetch origin
git worktree add -b codex/123-short-topic ../xier-123 origin/main
cd ../xier-123
npm ci
cp .env.example .env
npm run check
```

Issue 认领评论记录会话、分支、工作区、范围和依赖。由协调会话确认只有一个实现者主写；需要共同修改同一模块时，安排先后 PR。测试不要复用个人 Electron profile、生产账号或其他会话端口。

桌面验收为每个任务新建临时目录，以 `--user-data-dir=<绝对临时路径>` 启动已解包的 macOS App；启动命令和配置、日志、窗口、退出检查见[独立 profile 验收](releasing.md#macos-独立-profile-验收)。保持 `HOME` 原值，不复制个人配置或聊天数据，默认只验收访客和本地设置，不调用模型或云端。Windows/Linux 的实际 GUI 验收仍需单独记录。

当前源码使用 Electron 45，macOS 最低要求为 13；本机开发工具仍使用 `.nvmrc` 的 Node 22，应用 Node 类型对齐 Electron 的 24.x。此要求适用于后续从当前源码构建的包；已发布的 v1.0.0 测试包仍以其原始构建与验收记录为准。

## 规格与测试先行

需求和缺陷使用 [OpenSpec SDD/TDD](spec-driven-development.md)：Issue → proposal/specs/design/tasks → 一个场景的 RED/GREEN/REFACTOR → PR/独立评审 → required → 合并。变更资料与代码放在同一 PR；可先开 Draft，资料完成前检查失败是预期状态。飞书记录背景与决策，仓库 `openspec/` 保存版本化的契约和证据。

## 检查与合并

`ci.yml` 在每次 PR 与 main push 执行 OpenSpec/TDD 门禁、应用检查、站点检查和桌面构建，`required` 汇总 job 只接受所有依赖成功。它不使用路径过滤，避免必须检查因未触发而永久等待。PR 测试仅有读取权限、没有云端或模型密钥。

`desktop.yml` 是供 CI 和手动触发使用的桌面构建流程。macOS arm64 是首期安装验收目标；Windows 和 Linux 的打包结果也会保留，但构建通过不等于这些系统已通过人工安装验收。

main 保护目标：必须 PR、必须 `required` 成功、分支保持最新、讨论解决、禁止 force push 和删除，并对管理员生效。具体是否启用以 GitHub 当前设置为准。首次配置后，要用临时 PR 的故意失败提交核实 `mergeStateStatus=BLOCKED`，修复后再验证恢复；不能仅以 YAML 文件存在作为验收。

使用 squash merge，每个 PR 对应一个可理解的交付。新提交会使旧评审证据过时，评审者需要核对最新 SHA。共享个人账号时不启用无法满足的独立身份 approve 门槛；独立会话在 PR 中留下问题或无阻断结论，维护者负责合并决定。以后引入受限 GitHub App 再开启独立身份审批。

## 会话交接与完成标准

使用 [交接模板](templates/handoff.md)，将目标、当前 SHA、Issue/PR、验证、未完成项和下一步放入 Issue/PR，并同步对应飞书页面。新会话以当前仓库和远端事实重新核验，不只相信聊天摘要。

完成意味着验收条件实现、适用检查通过、评审问题解决、文档一致；发布任务还要求产物与提交可追溯、校验和正确、安装/启动验收有记录。PR 合并、Pages 上线、Release 发布分别记录，不混为“已完成”。

## 通知与依赖更新

维护者采用低频通知：在 [GitHub 通知设置](https://github.com/settings/notifications) 中，Watching 和 Participating、@mentions、custom 只选 On GitHub；Actions 保留 Email 和 Only notify for failed workflows。这是个人账号级偏好，会影响该账号其他仓库；仓库配置不会替协作者更改个人设置。安全漏洞与账号安全提醒单独管理，不属于日常 PR 降噪范围。

Dependabot 常规版本更新按月检查，应用、站点、GitHub Actions 各合并为一组，每组最多同时打开 1 个版本更新 PR，三组配置上限合计 3 个。分组仅适用于 version-updates，不改变安全更新的调度与独立限制，也不自动合并升级。已有 PR 不会因调低上限自动变成已处理；等待机器人重新分组或人工评审。分组含大版本更新时仍须检查兼容性，失败时按依赖拆分处理。

Agent 在 PR 描述中维护当前验证与交接摘要；评论用于评审问题、阻断和最终交付，不逐条发送提交、轮询或无变化进度。CI 结果由 checks 展示，避免用重复评论再通知一次。

规则依据：[GitHub 通知](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications)、[Actions 失败通知](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)、[Dependabot 分组与上限](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)。

## 官网开发

```bash
npm ci --prefix site
npm run site:dev
npm run site:build
npm run site:preview
```

公开内容仅来自 `site/`。`docs/` 与飞书不会被整体发布。现有 `docs/auth-redirect.html` 是历史回调文件，官网构建原样复制它到相同公开路径，保留兼容性；当前应用采用 loopback OAuth，详见 README。

GitHub Pages 使用项目路径 `/xier/`。部署由 main 上 `docs.yml` 执行；PR 只构建检查。不要为文档部署接入模型服务或 Supabase 凭据。
