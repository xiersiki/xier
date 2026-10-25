# Spec Delta

## Purpose

实现父 content-agent-connection 规格的传输切片；编辑语义遵循父 content-collaboration 规格与 AgentPort v1。

## ADDED Requirements

### Requirement: Controlled OpenCode execution
接入 SHALL 核验服务版本 1.19.4，每次生成创建独立 session，仅发送选区、要求和固定指令。启动入口 MUST 使用独立空工作目录与 HOME/XDG，禁用项目、Claude、外部 skills 和默认插件加载，全局与 content agent 仅允许 StructuredOutput。配置、鉴权与上游错误原文 MUST NOT 进入前端快照。

#### Scenario: Structured rewrite
- **WHEN** 有效请求提交且服务可用
- **THEN** start 返回确认快照，observe 收到经过非空 replacement 与可选字符串 explanation 校验的完成结果

#### Scenario: Incompatible or malformed response
- **WHEN** 服务版本不符、明确拒绝请求或最终 structured 非法
- **THEN** 返回稳定脱敏失败，禁止自动放宽权限或切换模型

### Requirement: In-memory request registration
一个 gateway 工作区 SHALL 在 running 或 unknown 时占用单并发；相同 requestId 与相同字段 MUST 幂等，不同字段 MUST 拒绝。unknown 仍为未核实状态。

#### Scenario: Duplicate and competing submissions
- **WHEN** 重复提交或另一 scope/draft 同时提交
- **THEN** 同 ID 同输入不多发 prompt，不同输入拒绝，另一 ID 不得越过工作区占位

#### Scenario: Missing mapping
- **WHEN** 查询或取消服务重启后不存在的 requestId
- **THEN** 返回 unknown，不创建 session 或重发 prompt

### Requirement: Verified recovery and cancellation
get SHALL 仅查询原 session 最新一条消息或已知消息，cancel SHALL 调用服务端 abort 后核实状态。结果先完成时 MUST 返回 completed；取消确认前或查询失败时 MUST NOT 返回 cancelled。终态与序号 MUST 阻止迟到回调覆盖。

#### Scenario: Lost generation connection
- **WHEN** prompt 连接失败或超时而无法确定执行状态
- **THEN** 返回 unknown，保留占位；后续 get 可恢复 running 或完整 completed，不重发

#### Scenario: Confirmed abort and completion race
- **WHEN** abort 已确认且 session 不活跃，或核实发现完整结果
- **THEN** 只有同 session 中止记录与非活动状态同时核实时返回 cancelled，完整结果则 completed；迟到完成、错误与旧查询不得覆盖已提交终态

### Requirement: AG-UI boundary
HTTP handler SHALL 将请求映射到 RUN_STARTED、STATE_SNAPSHOT 与 RUN_FINISHED/RUN_ERROR，适配器 SHALL 实现未改变的 AgentPort v1。completed MUST 同时具有有效 STATE_SNAPSHOT 和对应 RUN_FINISHED，EOF 不代表完成。每个本地可观察变化 SHALL 增加 sequence，重复/旧序号不得覆盖；本地断线序号与服务序号独立。

#### Scenario: Disconnect and explicit recovery
- **WHEN** 流提前结束、传输拒绝或解析失败
- **THEN** AgentPort 返回/通知 unknown；get 只调用查询路由，恢复原结果；恢复 running 且原流结束后继续只读观察，直到终态或再次 unknown

#### Scenario: Cancellation and observation
- **WHEN** 客户端取消或退订
- **THEN** 取消调用服务端 cancel 路由，退订仅停止观察；完成后的迟到事件不改变终态

#### Scenario: Untrusted HTTP caller
- **WHEN** host 不授权请求或输入不属于规定结构
- **THEN** 拒绝访问且不启动模型；scopeId 不作为鉴权凭据
