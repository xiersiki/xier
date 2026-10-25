# 参与开发

Xier 使用同一套流程接纳开发者与 Agent 的贡献：Issue 明确验收，OpenSpec 先写规格，TDD 红绿重构，独立分支实现，PR 留下证据，自动检查通过后再合并。

## 从一个任务开始

1. 阅读 [AGENTS.md](https://github.com/xiersiki/xier/blob/main/AGENTS.md) 与 [贡献指南](https://github.com/xiersiki/xier/blob/main/CONTRIBUTING.md)。
2. 在 [Issue](https://github.com/xiersiki/xier/issues) 中说明目标、范围、验收条件与依赖，确认认领。
3. 在独立 worktree 先写 OpenSpec proposal、specs、design、tasks；按公开边界逐项写失败测试、最小实现通过、重构后保持绿色，保存真实日志。
4. 提交 PR，附 change ID、规格、任务和红绿重构证据；OpenSpec/TDD 门禁、测试和构建必须通过，交由另一会话或开发者评审。
5. 合并后核对站点或版本产物，并完成交接记录。

## 常用命令

```bash
npm run spec -- new change <change-id>  # 建立需求变更
npm run spec:validate                  # 严格规格/归档校验
npm run spec:gate -- --base origin/main # 本次范围、任务与证据
npm run check       # 类型检查与离线测试
npm run build       # renderer 构建
npm run make        # 当前平台桌面产物
npm ci --prefix site
npm run site:build  # 官网类型检查、构建和站内死链检查
```

## 项目资料

- [架构入口](https://github.com/xiersiki/xier/blob/main/docs/architecture.md)
- [OpenSpec SDD/TDD 规范](https://github.com/xiersiki/xier/blob/main/docs/spec-driven-development.md)
- [研发流程](https://github.com/xiersiki/xier/blob/main/docs/development.md)
- [发布指南](https://github.com/xiersiki/xier/blob/main/docs/releasing.md)
- [规格和交接模板](https://github.com/xiersiki/xier/tree/main/docs/templates)

飞书知识库保存维护者的需求、设计与历史决策，访问权限独立管理。GitHub 的代码、Issue、PR、Actions 和 Release 记录实际交付；公开贡献者无法访问飞书时，可在 Issue 中请求补充必要上下文。

## Codex 中使用

仓库提供 OpenSpec skills。新会话可以选择 `openspec-propose` 生成方案，确认范围后用 `openspec-apply-change` 实施，验证完成后用 `openspec-archive-change` 同步并归档。终端统一使用 `npm run spec -- ...`，避免全局版本不同。

CI 验证证据完整性并运行当前测试，评审仍需核对历史红绿顺序和场景充分性。纯文档无需制造失败测试；配置/依赖更新需记录适用验证，不能给业务代码豁免。新增文件先 `git add`，再执行范围门禁。
