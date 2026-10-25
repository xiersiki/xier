# 参与开发

Xier 使用同一套流程接纳开发者与 Agent 的贡献：Issue 明确验收，独立分支实现，PR 留下证据，自动检查通过后再合并。

## 从一个任务开始

1. 阅读 [AGENTS.md](https://github.com/xiersiki/xier/blob/main/AGENTS.md) 与 [贡献指南](https://github.com/xiersiki/xier/blob/main/CONTRIBUTING.md)。
2. 在 [Issue](https://github.com/xiersiki/xier/issues) 中说明目标、范围、验收条件与依赖，确认认领。
3. 在独立 worktree 实现，运行类型检查、回归测试和适用构建。
4. 提交 PR，附对应提交的验证与文档，交由另一会话或开发者评审。
5. 合并后核对站点或版本产物，并完成交接记录。

## 常用命令

```bash
npm run check       # 类型检查与离线测试
npm run build       # renderer 构建
npm run make        # 当前平台桌面产物
npm ci --prefix site
npm run site:build  # 官网类型检查、构建和站内死链检查
```

## 项目资料

- [架构入口](https://github.com/xiersiki/xier/blob/main/docs/architecture.md)
- [研发流程](https://github.com/xiersiki/xier/blob/main/docs/development.md)
- [发布指南](https://github.com/xiersiki/xier/blob/main/docs/releasing.md)
- [规格和交接模板](https://github.com/xiersiki/xier/tree/main/docs/templates)

飞书知识库保存维护者的需求、设计与历史决策，访问权限独立管理。GitHub 的代码、Issue、PR、Actions 和 Release 记录实际交付；公开贡献者无法访问飞书时，可在 Issue 中请求补充必要上下文。
