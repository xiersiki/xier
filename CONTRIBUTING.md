# 参与 Xier 开发

从 [AGENTS.md](AGENTS.md) 和 [项目知识库](docs/FEISHU-INDEX.md) 开始。人和 Agent 使用同一套验收条件、分支与 PR 流程。

1. 在 Issue 中写清问题、范围、验收条件和依赖；认领时记录执行会话与 worktree。协调者确认归属，评论不是原子锁。
2. 从最新 `origin/main` 建立独立 worktree，分支命名 `codex/<issue>-<主题>`。一个工作区只有一个主写入者。
3. 使用 `.nvmrc` 的 Node 版本，执行 `npm ci`。站点使用独立依赖：`npm ci --prefix site`。
4. 按 [OpenSpec SDD/TDD](docs/spec-driven-development.md) 先完成 proposal/specs/design/tasks，确定公开测试边界，再逐项红绿重构并记录真实证据。运行规格门禁及与改动相关的验证。应用修改至少执行 `npm run check` 与 `npm run build`；打包配置运行 `npm run make`；站点运行 `npm run site:build`。
5. 提交 PR，关联 Issue，说明行为变化、验证和剩余限制。提交可以是 `feat:`、`fix:`、`docs:`、`ci:`、`chore:`；描述可用中文。
6. 独立会话按最新提交评审。默认一次完整评审；修复后只复核增量及受影响检查，所有 required checks 通过、讨论解决，再由维护者根据授权合并。
7. 在 PR 完成交接；契约、接口、架构、数据、安全和流程变化即时更新飞书，普通小修在发布/迭代时批量汇总。GitHub 保存逐任务事实，飞书保存背景、决策和导航。

局部、可回退且不扩展契约的修复使用[小修快速通道](docs/spec-driven-development.md#小修快速通道与验证范围)，保留简短 OpenSpec 与真实 TDD。CI 依据改动选择检查；跨边界风险加 `ci:full` 标签升级完整检查。

完整流程见 [开发与协作](docs/development.md)，发布见 [版本发布](docs/releasing.md)。需求与缺陷使用 [OpenSpec 入口](docs/spec-driven-development.md)，换会话使用 [交接模板](docs/templates/handoff.md)。

不要提交 `.env`、模型 Key、个人聊天数据或未脱敏截图。默认检查不调用真实模型或生产数据库。共用 GitHub 账号的两个会话不能相互提供独立身份的 approve；评审结论应明确是独立会话评审。
