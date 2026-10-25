## Context
现有 required 强制 spec/app/site/desktop 全成功；check-sdd 已支持简短资料，无需新建 lite schema 或放宽证据要求。

## Goals / Non-Goals
减少无关构建和重复记录；保留所有已选检查与失败保护。不改变业务、发布流程或历史证据。

## Decisions
- 沿用用户已确认的公开 CLI 测试边界：临时真实 Git 仓库输入 base 与已跟踪差异，观察 JSON 范围/退出码；required CLI 输入 scope 和 GitHub needs JSON，观察通过/拒绝。逐项 RED/GREEN，补充防漏回归。
- `node scripts/ci-scope.mjs --base <ref> [--full]` 输出 app/site/desktop 布尔值。文档与 OpenSpec 资料仅 spec；site 仅 site；普通 renderer UI、locales、非打包测试选 app；主进程、preload、common、services/stores/数据库/认证、依赖/构建/CI、未知路径完整执行。混合取并集，重命名按删除+新增，错误 base 失败。
- 只将确定安全的扩展名与目录加入轻量白名单；规则自身改变完整执行。PR 无顶层 paths，scope 和 spec 始终运行；required 用 always 并严格验证 scope 成功、spec 成功、每个选中 job 成功，未选中只能 skipped 或 success。
- 手动 CI 与 ci:full 标签强制完整选择；标签只升级检查，不能豁免。发布既有应用及三平台构建保留。
- 无需重构时 refactor 引用同一次 green 日志并解释原因；相关输入未变不重复运行。合并后的 CI 是对最终 main 的验证，不冒充 PR 结果复用。
- 普通小修的完整事实在 PR/change，飞书发布或迭代批量摘要；契约、接口、架构、数据、安全、开发规则改变立即同步。

## Risks / Trade-offs
路径不能推断全部语义，作者和评审需将跨边界风险标为 ci:full；新/未知目录保守全跑。应用仍跑全量离线测试与类型检查，暂不引入脆弱的按测试文件依赖选择。工作流仍须受保护 PR 评审。

## Migration / Rollback
一次 PR 更新规则与实现；撤销该 PR 可恢复全部检查。保留 required 名称与现有保护。以公开 CLI 回归、actionlint、本次全量 CI 及后续 docs-only 实际 PR 验证跳过路径。
