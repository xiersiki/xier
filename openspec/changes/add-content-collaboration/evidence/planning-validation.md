# 方案校验

2026-10-25，在独立 worktree 基线 07dd6be 上执行；使用仓库固定 OpenSpec 1.15.0。仅复用其 CLI 安装，不据此宣称最新应用依赖已 npm ci。

- `npm run spec:validate`：退出 0；活动 change/主规格 3 项、归档 5 项均通过。
- `git diff --cached --check`：退出 0。
- `npm run spec:gate -- --base origin/main`：退出 1，`Incomplete openspec/changes/add-content-collaboration/tasks.md`。这是实施未开始的事实，保留待开发复选框；方案 PR 只能保持 Draft，不为过门禁伪造完成任务或 TDD。
- OpenSpec planning artifacts 齐全不代表实施完成。不执行 archive，不修改主规格。
- 业务源码、应用 typecheck/test/build/package、组件构建与真实 UI 验收均未执行；本次验证只覆盖文档与隔离接入实验。
- 探针结束后检查进程列表，未发现该临时 probe 或 opencode serve 的残留进程。
