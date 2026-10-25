# Xier 项目协作指南

## 项目与知识入口

- Xier 是 Electron + Vue 3 + TypeScript 桌面对话应用；代码仓库为 <https://github.com/xiersiki/xier>。
- 项目知识总入口：<https://pcn11w88fq9h.feishu.cn/wiki/G2JDw4BdBiLEygkzVxKcYjx3nRb>。
- 必读文档治理与会话协作规范：<https://pcn11w88fq9h.feishu.cn/wiki/E0Bgwlb4ziX7lWk5CzHcL8ionyd>。
- 详细分类与现有资料映射见 [docs/FEISHU-INDEX.md](docs/FEISHU-INDEX.md)。

飞书根页及子页是本项目长期维护的知识库，用于保存和发现产品目标、需求、设计、架构、研发流程、测试验收、发布运维、决策、调研和交接。目的是让一个没有参与此前聊天的会话也能理解项目并继续工作。项目所有者已明确要求在这个节点下维护项目相关内容。

## 每个会话的工作流程

1. 开工先读取飞书根页、治理规范、项目概览及任务相关子页，再核对 README、相关代码和 Issue/PR。
2. 检查实际仓库目录、当前分支、HEAD 和未提交改动，确认任务归属。不要覆盖其他会话的修改，也不要把它们顺手提交进本任务。
3. 区分当前事实、历史验证、设计提案和已确认决策。过期的检查结果必须注明日期；不能将提案写成已实现功能。
4. 并行实现采用独立分支和 worktree，同一工作区只有一个主写入会话。分支默认使用 `codex/<issue号或任务主题>`。测试数据、Electron profile 和端口也要按任务隔离。
5. 任务涉及需求、接口、数据、设计决策、流程或验证结果变化时，同步维护对应飞书子页。新页面放在指定根节点或相关分类下，并更新父页索引。
6. 交付前更新相关文档和交接：目标、完成项、分支/提交、Issue/PR、验证、限制、剩余项、下一步及文档链接。明确本地未提交、未推送、未上线等状态。

## 信息如何分工

- 飞书：项目知识、设计意图、已确认需求/决策、验证摘要与导航。
- GitHub Issue/PR：任务状态、变更讨论、评审和代码交付；Actions/Release：检查与发布证据。
- 仓库代码、类型、迁移和脚本：实际实现；README/docs 保存版本相关说明与必要离线入口。
- 聊天：执行过程；影响后续工作的结论需要沉淀，不要求复制聊天全文。

实际行为以代码与可复现证据为准，预期行为以已确认需求/决策为准。发现不一致应记录偏差并核验，不静默改写历史。相同知识指定一个主要维护位置，其余使用链接，避免多份状态各自变化。

## 文档维护规则

- 每页说明类型、状态、负责人、更新时间、适用版本/分支、关联 Issue/PR 与证据；没有编号就写未创建。
- 状态使用草案、待确认、已确认、实施中、已验证、已废弃/已归档。已验证须注明环境、命令/步骤、时间、结果和跳过项。
- 修改已有飞书正文前读取最新 block 树，只改本任务相关范围。`update_text_elements` 全量替换 elements，必须保留该块仍需要的全部文字、链接和格式。并发更新时重读并合并。
- 保留历史决策及被替代关系；新增、改名、移动或归档页面时同步修复索引和引用。
- 不写入密钥、Token、私钥、完整配置或无关真实账号/聊天数据；证据脱敏。GitHub Pages 发布范围另行按任务确定，不自动公开整套知识库。
- 飞书无法访问时先按当前工具配置尝试刷新登录并重试；仍失败则记录待同步页面、原因与拟更新摘要，继续不依赖它的工作。不得声称已经同步。

## 飞书工具

当前维护者机器使用用户 CLI：

```text
/Users/gongchenyu/.nvm/versions/node/v22.23.1/bin/feishu-user-plugin
```

通用调用：`feishu-user-plugin tool <tool-name> '<json-args>'`。先用 `tool help <tool-name>` 查询 schema。

- 阅读：`read_doc_markdown`；精确编辑前：`get_doc_blocks`。
- 创建子文档：`create_doc`，传 `wiki_space_id` 和正确的 `wiki_parent_node_token`；创建后核实 Wiki 挂载完成。
- 内容变更：`manage_doc_block`；表格使用其 `table` 参数，不手工构造 table/cell blocks。
- 根节点 token：`G2JDw4BdBiLEygkzVxKcYjx3nRb`；Wiki space：`7513874167735271452`。
- 登录失效时使用 `keepalive` 后重试。其他环境使用已有授权的飞书工具，不复制本机凭据。

## 工程入口与验证

- `main/`：Electron 窗口、配置、认证回调与模型请求。
- `preload.ts`：受控 IPC；`renderer/`：Vue UI、状态和数据服务；`common/`：共享类型与工具。
- `renderer/dataBase.ts`：本地数据；`supabase/`：schema 与迁移；`tests/`：回归。
- 使用仓库 npm lockfile；当前 README 推荐 Node 22。安装 `npm ci`，环境配置参考 `.env.example`，运行 `npm start`。
- `npm run check` 执行类型检查与离线单测。默认不设置 `XIER_LIVE_PROVIDER_CONFIG`；真实模型测试须属于已授权任务范围。
- `npm run build` 仅构建 renderer；`npm run package` / `npm run make` 才验证桌面产物构建。构建成功不代表安装/启动或全部平台通过。
- 根据变更做适用验证。纯文档任务检查内容、链接、目录与读回即可；行为变更验证相应回归。未运行的检查明确写出。
- 修改 IPC、认证、同步或迁移时核验兼容和数据归属；维护现有取消、流式终态、账号隔离及离线数据行为。

## 进一步阅读

- [贡献指南](CONTRIBUTING.md)、[开发流程](docs/development.md)、[架构](docs/architecture.md)、[发布](docs/releasing.md)。
- `site/` 是独立 VitePress 项目：`npm ci --prefix site`、`npm run site:build`。只发布这里的公开资料与兼容回调，不整库发布飞书内容。
- `.github/workflows/ci.yml` 汇总检查名为 `required`；最终启用状态以 GitHub 设置与实际运行记录为准。

## GitHub 协作边界

任务范围、验收条件、依赖和证据应能从 Issue/PR 找到。不同会话共用一个 GitHub 账号仍是同一身份，不能当作独立审批人。遵循实际规则和用户授权处理提交、合并与发布；不要绕过失败检查。尚未启用的流水线、Pages、发布或权限方案应标为计划。

遵循[通知与依赖更新约定](docs/development.md#通知与依赖更新)：日常进度汇总到 PR 描述，评论只承载需要处理的问题和交付结论；不要将每次提交、CI 轮询或无变化状态重复发成评论。个人通知设置需按用户偏好处理，不能为了降噪关闭安全提醒或必需检查。
