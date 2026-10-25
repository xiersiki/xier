# Design

## Context

基线 8b37a36，分支 codex/content-opencode-port，父 PR #25。已阅读根页/治理页/概览/04.2；飞书 04.2 仍为历史方案，由主会话统一同步。官方当前 SDK 文档与本机固定包 v2 类型对照：session.create/prompt/status/abort/message/messages；全历史回读的已知问题见父 evidence/integration.md。AG-UI 1.0.3 官方 HttpAgent 与 EventEncoder 用于真实离线 HTTP 契约测试。

## Decisions

1. Gateway 实现 AgentPort，拥有进程内登记表、单工作区占位和单调 sequence。请求注册发生在首次 await 前，prompt 独立执行；每次新 session，不接收历史或文件。未知占位不因浏览器断线释放。get/cancel 通过读服务核实，缺映射 unknown，不重试生成。
2. 外部 OpenCode SDK 作为真正系统边界；测试用其 fetch 替身模拟官方 HTTP，不能 mock 自己的 gateway。HTTP 端到端使用真实 loopback server 与官方 HttpAgent。沿交接已批准的 AgentPort / gateway 公开边界测试，无需重新请求许可。
3. 查询用 session.status 与 messages(limit:1)，已知助手 ID 时可单条读取。活动状态优先，非活动且完整 structured 才确认完成；取消成功后读回结果优先，否则明确 idle 才 cancelled。查询从发起到返回若 run 已变化，丢弃旧观察，终态一旦提交不可覆盖。
4. 明确 HTTP 4xx、模型返回 error 与格式错误为 failed；不确定的网络/5xx 为 unknown。错误映射固定中文信息，不透传异常文本、配置、URL 或鉴权头。
5. AG-UI 协议封装在 service/renderer platform。HTTP POST /runs 使用标准 RunAgentInput 的 forwardedProps.request；GET /runs/:id 与 POST /runs/:id/cancel 仅查询/取消。RUN_STARTED 的 runId=requestId、threadId=scopeId。STATE_SNAPSHOT 携带 RunSnapshot；completed 缓存直到 RUN_FINISHED。取消用状态快照+RUN_FINISHED，失败用快照+RUN_ERROR，unknown 快照后断流。客户端维护服务序号与本地 sequence 分离，EOF 本地 unknown 后查询同一服务 sequence 仍可恢复。
6. Node handler 必须收到 host authorize 回调，默认无隐式开放；单 handler 对应一个可信工作区，回调负责身份、Origin/CSRF 和 scope/owner 授权。主体授权必须覆盖所有路由，不能相信 scopeId。限制请求大小、路径与额外 forwarded payload，不允许客户端注入模型/工具/历史。
7. 外置 CLI launcher 固定 1.19.4，建立专用 profile/work，独占 profile 锁；只继承启动所需环境白名单，不带现有 provider token/OPENCODE_*。配置显式指定 DeepSeek 非思考组合；host 传凭据，不读取现有聊天。HOME/XDG 都隔离，不依赖 OPENCODE_TEST_HOME 或历史 /tmp 文件。进程清理与失败清理归 launcher；进程不是 OS 沙箱。

## Scope and rollout

只新增独立模块，无 UI 默认切换。主会话负责 IPC 注册、preload 白名单、账号归属以及生命周期接线；Web host 复用 handler。回退恢复 fixture 注入。gateway 映射不持久化；进程重启后 unknown，不提供跨进程/跨 host 全局锁承诺。正式自动安装、全平台打包、真实 UI 及计费取消不在切片验收内。

## Validation

逐场景真实 RED/GREEN 后汇总重构和回归，记录 tdd.json。默认测试无模型请求；官方 SDK fetch 边界与 AG-UI loopback 检查实际请求/响应。不把历史探针当当前证据。检查 typecheck、全库 tests、build、spec validate/gate；父 change 未完成可能造成 main 范围门禁预期失败，分支 base 门禁单独检查。
