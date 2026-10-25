# OpenSpec：规格驱动与测试驱动开发

Xier 的需求和缺陷遵循 **Issue → SDD → TDD 红绿重构 → PR 评审 → CI → 合并**。OpenSpec 管理规格及变更生命周期，GitHub 管理交付；两者通过 change ID、提交和证据关联。适用规则自本次接入后生效，不倒填历史测试过程。

## 信息放在哪里

| 位置 | 作用 |
|---|---|
| GitHub Issue | 问题、范围、验收、依赖、认领 |
| `openspec/specs/<capability>/spec.md` | 已同步的版本化行为契约；是否交付看所在分支/PR |
| `openspec/changes/<change-id>/` | proposal、delta specs、design、tasks、tdd.json 和 evidence |
| `openspec/changes/archive/<date>-<change-id>/` | 完成变更的原始记录；不是部署证明 |
| PR / Actions | review、当前提交验证和合并事实 |
| [飞书 05.2](https://pcn11w88fq9h.feishu.cn/wiki/UC9GwJwXyi6ozSkgCG7c0uFYnof) | 流程目的、决策、导航与验收摘要；规格用仓库链接引用 |

飞书不维护第二套逐任务状态；PR 中保留完整可公开背景，外部贡献者无需依赖私人知识库权限。

## 安装与启动

```bash
npm ci
npm run spec -- --version                 # 本仓库固定 1.15.0
npm run spec -- list
npm run spec -- new change add-example
npm run spec -- status --change add-example
npm run spec -- instructions proposal --change add-example
```

`npm run spec -- ...` 总是使用 lockfile 里的版本。普通克隆不必再运行 init；`.agents/skills/`、`openspec/config.yaml` 已提交。Codex 新会话读取项目 skills 后可选择 `openspec-propose`、`openspec-apply-change`、`openspec-update-change`、`openspec-archive-change`；未显示时重新打开项目会话，终端入口仍可用。

官方 `openspec init/update` 可能迁移旧的全局 Codex prompts；升级时先审查该行为及生成文件 diff，不对每个 worktree 重复初始化。升级 CLI 单独开 PR，显式更新精确版本及 lockfile，再按官方 [安装](https://openspec.dev/docs/setup) 和 [CLI](https://openspec.dev/docs/cli) 操作。CI 禁用遥测及更新检查。

## 先写 SDD

1. 阅读 AGENTS、相关主规格、Issue 和飞书决策；建立独立 worktree。
2. `proposal.md` 说明为什么、范围、能力变化和 Issue。不要将工具实现步骤当作新产品能力。
3. `specs/<capability>/spec.md` 用 `ADDED/MODIFIED/REMOVED Requirements` 和 `WHEN/THEN` 描述可观察行为，保留 `SHALL/MUST`、英文结构标题；正文可中文。
4. `design.md` 写技术决策、兼容、数据/安全边界、回退、公开测试边界与场景。
5. `tasks.md` 拆成可验证的纵向小步。先保存或提交规格，再实现；需求变化先更新相关规格。

用户只请求方案时先交付 SDD；已授权实施的任务按既有授权推进。可以使用同一个 Draft PR 展示规格和后续实现；任务未完成时门禁失败是预期状态。不要将“合并后部署”写成必须在合并前勾选的已完成实施任务；后续交付状态在 PR/Issue 记录。

## 再逐项红绿重构

每个行为场景沿已确认的公开边界进行：

1. **RED**：编写一个会失败的测试，运行并确认失败来自缺失/错误行为，而非依赖、语法或环境问题；保存实际输出。
2. **GREEN**：只实现让这个场景通过的必要代码，运行并记录结果。
3. **REFACTOR**：需要时消除重复、改善结构，再运行测试；无需重构则如实说明理由并保留验证记录。
4. 再进入下一个场景，完成后执行当前任务的全量适用检查。

测试通过公共 API、组件用户行为或 CLI 验证结果，不绑内部实现。不提前批量写全部测试，不为文案修改制造测试，不将真实模型/生产库加入默认离线回归。

## 证据格式

在 change 根目录维护 `tdd.json`，日志使用 `.txt`（仓库忽略 `.log`）。下例是结构示例，**必须用实际命令、结果和文件替换**：

```json
{
  "version": 1,
  "mode": "red-green-refactor",
  "files": ["main/example.ts", "tests/example.test.ts"],
  "seam": "公开方法或 CLI；记录确认来源",
  "cycles": [{
    "scenario": "规格中的 WHEN/THEN 场景",
    "red": {"command": "npm test -- tests/example.test.ts", "exitCode": 1, "evidence": "evidence/01-red.txt", "summary": "断言的预期与实际差异"},
    "green": {"command": "npm test -- tests/example.test.ts", "exitCode": 0, "evidence": "evidence/01-green.txt", "summary": "最小实现后通过"},
    "refactor": {"command": "npm test -- tests/example.test.ts", "exitCode": 0, "evidence": "evidence/01-refactor.txt", "summary": "重构内容，或无需重构的具体理由"}
  }]
}
```

`files` 是仓库相对**精确路径**，不是 glob。覆盖本次新增、修改、删除的行为/配置文件，包含测试与主规格文件；多 change 可分别覆盖。只有本次 diff 触及的有效活动/归档 change 才会计入，旧 change 不会自动为新代码背书。证据文件必须位于该 change 内、非空且无路径/符号链接逃逸。门禁只读取记录，绝不会执行 `command` 字段。

## 适用验证与豁免边界

- 纯文档：根 README/AGENTS/CONTRIBUTING/CHANGELOG/SECURITY/LICENSE、docs/site 下 `.md`、生成的 OpenSpec skills 可不建 change，仍检查内容/链接/站点构建。Markdown 中若改变可执行页面行为，按行为任务执行 TDD，并在评审中核对，不能仅依赖文件扩展名。
- 配置/依赖：根及 site 的 package/lock、`.nvmrc/.gitignore/.npmrc`、`.github/*.yml/yaml`、OpenSpec 配置和主规格允许 `verification-only`；仍需 proposal/design/tasks、reason 和至少一项有成功日志的 checks。变更实际包含新行为时使用行为模式。
- 没有行为契约变化的配置任务可在 `.openspec.yaml` 设置 `skip_specs: true`，不为工具升级编造规格；行为模式不接受跳过 specs。
- 其他路径保守地视为行为文件，必须 TDD。若确有分类例外，先通过有规格、测试和评审的 PR 更新门禁规则，不能在 PR 文本中任意 opt-out。
- Dependabot 没有 actor 豁免。维护者在其分支补充 change 和实际验证，或将需要处理的升级带到自己的 PR；不能仅因为机器人发起就合并。

验证模式用以下字段替换 `seam/cycles`：

```json
{
  "version": 1,
  "mode": "verification-only",
  "files": ["package.json", "package-lock.json"],
  "reason": "依赖升级，行为契约不变；兼容风险与依据见 design.md",
  "checks": [{"command": "npm run check", "exitCode": 0, "evidence": "evidence/check.txt", "summary": "实际检查结果"}]
}
```

## GitHub 检查与交付

```bash
git fetch origin
git add <本任务新增和修改的文件>   # 新文件先纳入跟踪；只暂存本任务内容
npm run spec:validate
npm run spec:gate -- --base origin/main
npm run check
npm run build
# 站点改动另运行 npm ci --prefix site && npm run site:build
```

范围门禁检查指定 base 到**当前已跟踪工作树**的差异，包含已暂存和未暂存修改，未暂存的新文件不在 Git diff 中。CI checkout 是完整提交：PR 取 base SHA，main push 取 before，手动运行取 HEAD 的父提交；base 缺失/无效时失败，不猜测为无改动。

`OpenSpec and TDD` job 执行官方严格语法校验、归档任务校验与范围门禁。应用 job 实际运行全量离线测试（包括门禁 CLI 回归），`required` 同时依赖 spec/app/site/desktop 全部成功。检查结果只在 checks/summary 展示，不逐次发表评论，沿用日常通知降噪约定。

任务完成且适用验证通过后同步并归档：

```bash
npm run spec -- archive <change-id> --yes
# 检查生成的主规格，补上有意义的 Purpose；不要留下 TBD。
npm run spec:validate
git add openspec
npm run spec:gate -- --base origin/main
```

归档保留证据并更新 `openspec/specs/`，PR 的 change 链接改为 archive 路径，`files` 补入本次同步的主规格。不要使用 `--no-validate` 绕过检查。归档是 PR 内版本化整理，合并、部署与发布分别以 GitHub 事实记录。

独立会话在最新提交上审阅规格与实现、真实失败原因、场景充分性、异常分支及文件分类；同一 GitHub 账号的会话不构成独立身份 approve。CI 能检查记录完整性和当前结果，不能证明历史红绿顺序、记录真实性或需求语义充分性。证据文件、SDD 先行提交和 PR 提交历史用于评审，不能把自述当作不可篡改审计。
