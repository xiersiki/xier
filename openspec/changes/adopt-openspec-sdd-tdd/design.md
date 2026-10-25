## Context

现有 CI 包含 app/site/desktop，required 汇总三者。测试是 Vitest，适用 Node 环境；没有 OpenSpec。用户于 2026-10-25 已确认通过公开命令行测试门禁：输入文件差异/规格资料，观察退出码和诊断。

## Goals / Non-Goals

规格、测试过程与 PR 同版本，给新会话可复现的入口。不构造新 Agent 服务，不接 GitHub 写权限机器人，不声称静态校验能证明 TDD 时间顺序。

## Decisions

1. 采用官方 spec-driven schema 的四类产物，通过项目 config 补充 TDD 约定；CLI 固定 1.15.0，避免全局版本漂移。
2. 新增 Node CLI `scripts/check-sdd.mjs --base <git-ref>`。真实 Git diff 使用 execFileSync 参数数组与 NUL 分隔，关闭 rename 检测，包含删除文件。工作树新文件先 git add；CI 的完整 checkout 已含全部提交文件。base 必须可解析，缺失不猜测。
3. 从本次 diff 识别活动或归档 change；仅存在于最终树的 change 可覆盖差异。每项必须有非空 proposal/design/tasks；至少一项完成任务，无未完成项；有规范 delta，或 .openspec.yaml 明确 skip_specs（仅 verification-only）。官方 CLI 负责规格语法。
4. `tdd.json` version=1，files 为仓库相对精确路径（不支持通配符），mode 为 red-green-refactor 或 verification-only。行为模式有 seam 和 cycles，每周期 scenario、red/green/refactor，各含 command/exitCode/evidence/summary；验证模式有 reason 和 checks。证据是 change 内真实非空文件，拒绝路径和 symlink 逃逸；不运行文件内命令。
5. 文档 allowlist：根说明 md、docs/site 下 md、生成 skills md 和 OpenSpec change 内资料不要求覆盖。其余路径默认行为，明确配置文件、依赖 lock、.github yaml 和 openspec 配置/主规格允许 verification-only。不以提交作者或机器人为豁免依据。
6. CI 独立 spec job，checkout 全历史；PR 取 base.sha，push 取 before，手动取 HEAD^。同一 required 汇总确保失败阻断；不额外发表评论。PR 先 draft 逐步完善，进入 review 前任务必须完成。
7. 先提交 SDD，再逐个 CLI 行为测试 RED→GREEN；最后提取重复逻辑并保持测试绿。证据跟随 change 归档，主规格成为后续规范。GitHub squash 历史以 PR 提交及保存日志补充过程，不能把声明当作可信证明。

## Risks / Trade-offs

门禁与实现同在仓库，可被有写权限的人修改；它是受评审的工程规范，不是不可篡改审计。files 声明只检查精确覆盖，不判断规格语义充分性；文档分类与配置验证仍需 review。首次依赖安装新增 OpenSpec 的传递依赖，保留旧依赖版本并验证 npm ci。缺少飞书权限的外部贡献者从 repo/Issue 获取必要上下文。

## Migration Plan

本 PR 自举并通过门禁，原 required check 名不变。已有 Dependabot PR 不自动合并，先按配置更新补充 verification-only 资料。产品历史规格按后续需求增量建立。回退本 PR 及规范时必须通过普通 PR，并说明恢复旧流程的理由。

## Test Plan

真实临时 Git 仓库与真实 Node 子进程，不 mock 文件系统/Git。按公开 CLI 逐项测试：完整行为交付；无 change；缺 design/spec；任务未完成；缺红绿与错误退出码；证据路径逃逸/命令不执行；纯文档；配置验证；行为不能借验证模式豁免；归档；无效 base/遗漏文件。保存每次真实 RED/GREEN 输出，再跑全量 npm check、renderer/site 构建、OpenSpec validate 和 workflow 静态检查。
