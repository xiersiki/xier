# 规格入口（OpenSpec）

新需求与缺陷使用 [SDD/TDD 规范](../spec-driven-development.md)，不再另外复制本文件作为第二份规格。

`npm run spec -- new change <change-id>` 后依次写：

1. `proposal.md`：问题、范围、Issue 与背景。
2. `specs/<capability>/spec.md`：行为与 WHEN/THEN 验收场景。
3. `design.md`：技术设计、公开测试边界、兼容和回退。
4. `tasks.md`：逐项 RED → GREEN → REFACTOR 与交付验证。
5. 实施时维护 `tdd.json` 和真实 `evidence/`，完成后同步主规格并归档。

需求范围变化先更新相关规格，再扩展测试和实现。旧任务的既有规格保留历史与回链，不重写已发生的验收记录。
