# OpenCode 接入验证 · 2026-10-25

**结论：可有条件接入；未完成产品验收。** Xier 已有 DeepSeek 配置可供现成 OpenCode 调用，受限配置可返回结构化候选文本。完整会话历史接口有版本缺陷，已验证单条结果和 latest-one 读取可用。没有改动 Xier 业务源码，也没有开发 Agent 内核。

## 验证环境与边界

- macOS arm64；Node 22.23.1；隔离临时目录，OpenCode CLI 与 SDK 均为 1.19.4，AG-UI client/core/encoder 均为 1.0.3。
- 基线源码 Xier 07dd6be，组件库 master 3c3b090（只读核验，没有运行组件构建）。
- 用户明确选择使用已有 Xier 模型配置。只在内存中解码本机 provider 设置并验证官方 DeepSeek host；实际模型 deepseek-flash；输入仅人工编写的测试句子。
- key 留在临时 loopback 转发代理内；OpenCode 只拿占位 key。证据不含配置文件、鉴权头、真实聊天或完整 system prompt。
- 每次试验独立 session，空工作目录、独立 XDG profile，关闭项目配置/Claude 指令/外部 skills/默认插件加载；工具白名单。进程和端口已在 finally 清理。应用权限并非 OS 沙箱，本次没有恶意工具逃逸测试。

## 实际结果

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| CLI 与 HTTP health | 通过，版本 1.19.4 | 真实本机服务 |
| HTTP Basic 鉴权 | 未授权 health 返回 401 | 真实本机服务 |
| OpenAPI | 162 条路径，包含 abort | 实际 /doc 响应 |
| 全工具 deny | 结构化失败，发送 tools=[] | 保留失败证据，不作为成功样本 |
| 仅允许 StructuredOutput + 默认思考 | HTTP 400，required tool choice 不兼容 | 两次诊断尝试，其中一次保存错误说明 |
| 同权限 + thinking disabled | 两次有效 structured 返回，约 1363/1665 ms | 单一短句，不是延迟指标或成功率基线 |
| 会话事件订阅 | 收到 message/part/status/idle 等事件 | OpenCode 原生 SSE |
| 完整 session.messages | 失败：OutputFormatJsonSchema 解码错误 | 当前版本可复现限制 |
| message(messageID) / messages(limit:1) | 均回读助手 structured 成功 | 不等于完整历史接口已修复 |

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| 取消 | abort 返回 true，状态无活动记录 | 上游响应被本地 mock 挂起，非真实模型计费验证 |
| 工具暴露 | 成功请求仅 StructuredOutput | 不含 bash/read/write/web 工具 |
| AG-UI 消费 | RUN_STARTED → STATE_SNAPSHOT → RUN_FINISHED，结果一致 | 真实结果经最小 SSE 桥回放到官方 HttpAgent；无产品 UI |
| 产品编辑/接受/保存/跨端 | 未执行 | 全部留给实施与 PRD 验收 |

整个配置探索共发出五次真实模型请求：两次成功、一次 deny-all 结构化失败、两次思考模式参数不兼容。不得将它写成 PRD 的“五次真实闭环至少四次成功”；该验收尚未开始。取消测试另外使用本地 mock，不计入真实模型调用。

测试输入：`本功能可以让用户快速地完成文本的修改操作。`

一份成功结果：`本功能可让用户快速修改文本。` 模型 explanation 作为原始候选内容保存，并未验证其自述字数等细节；前端应自行计算长度，不能信任模型报告的统计。

## 怎样复现

1. 使用 Node 22 的独立临时 npm 工程，安装 `opencode-ai@1.19.4 @opencode-ai/sdk@1.19.4 @ag-ui/client@1.0.3 @ag-ui/core@1.0.3 @ag-ui/encoder@1.0.3`，固定 npm registry 和 lockfile。
2. 用户已授权的模型配置由测试进程读取；不在命令行、仓库或日志传 key。为本次测试创建独立目录和随机 loopback 端口/服务密码。
3. 启动 `opencode serve --hostname 127.0.0.1 --port <独立端口>`，设独立 XDG 路径和文中禁用项，content agent 只 allow StructuredOutput，其余 deny；模型设非思考模式。
4. SDK v2 创建新 session，prompt 使用 json_schema（replacement/explanation 为字符串），记录 data.info.structured、错误名、elapsedMs 和工具名，不打印完整配置。
5. 对相同 session 调用 messages、message(messageID)、messages(limit:1)，保留接口成功与失败，禁止挑选性删除失败记录。
6. 本地 mock 上游保持 SSE 未结束，再调用 session.abort 并查询 session.status；独立记为受控取消。
7. 将真实结果映射为三条 AG-UI 事件，用 EventEncoder 提供 SSE，HttpAgent.runAgent 验证结果状态；该步骤验证编码和消费，不代表已写完整适配器。
8. 退出时关闭本次测试拥有的 server/proxy，验证无残留进程。真实模型测试不加入默认 CI。

可复现探针源代码另存于 [probe-source.md](./probe-source.md)，是临时实验代码快照，不是生产模块。原运行的硬编码本机配置路径已替换为显式环境变量，其他逻辑保留；公开快照未再次消耗真实模型调用。

原始脱敏记录：[deny-all](./initial-deny-all.json)、[thinking 不兼容](./thinking-incompatible.json)、[首次成功](./first-success.json)、[最终探针](./final-probe.json)。它们是研究证据，不是 RED/GREEN/REFACTOR。

## 下一步阻断条件

可以开始前端固定响应闭环与受控 adapter 开发。上线前仍须验证配置隔离、真实取消竞态、请求恢复、非法结果/提前 EOF、组件实际构建消费、桌面/Web 编辑与保存、性能和安装产物。若未来固定版本或单条恢复接口也不可靠，应评估升级版本或更换现成服务；不在本项目补 Agent 内核。
