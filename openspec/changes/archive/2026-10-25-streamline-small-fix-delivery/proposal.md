## Why
每个小修都跑站点与三平台打包，重复整理证据和飞书状态，交付成本超过改动本身。用户已授权优化，关联 Issue #24；飞书 05.2 保存共同规则，GitHub 保存逐任务事实。

## What Changes
- 小修保留四份简短 SDD、逐场景 TDD、一次独立评审；按实际变动增量验证，普通修复在发布/迭代时汇总飞书。
- CI 始终运行范围分类与 OpenSpec；按路径选择应用、站点与桌面检查，required 严格核对必选结果。
- 未知路径、高风险路径、手动 CI 和 ci:full 标签完整验证；Pages 仅在相关路径变更时部署。

## Capabilities
### Modified Capabilities
- `delivery-workflow`: 按改动范围执行检查并保持门禁失败关闭。

## Impact
修改 CI、公开 CLI 及其回归、AGENTS/贡献/SDD 指南和飞书治理、研发、SDD 页。无业务功能、依赖升级、Release 或分支保护降级。
