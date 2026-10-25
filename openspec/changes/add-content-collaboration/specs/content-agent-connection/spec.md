# Spec Delta

## Purpose

为内容协作提供可替换的开源 Agent 接入边界，让前端取得可信的候选结果和运行状态，同时区分网络中断与执行停止，避免隐式上下文、危险能力和重复请求进入编辑闭环。

## ADDED Requirements

### Requirement: Isolated and restricted generation
系统 SHALL 通过现成开源 Agent 执行每次改写，每次使用独立请求上下文；执行配置 MUST 不启用读取项目文件、写文件、命令执行、联网搜索或子 Agent 能力，只允许返回结构化结果所必需的能力。模型凭据不得传给新增浏览器/渲染组件。

#### Scenario: Generate a suggestion
- **WHEN** 用户提交有效选区和要求
- **THEN** 接入层仅提交本次内容与固定编辑指令，返回关联此次请求的候选结果，不自行编辑本地文件

#### Scenario: Incompatible configuration
- **WHEN** 服务版本、鉴权或模型配置不兼容，或要求开启超出一期范围的能力
- **THEN** 明确报告失败，不自动放宽权限或切换到其他付费模型

### Requirement: One active request and idempotency
同一配套服务工作区 SHALL 同时只运行一个生成请求；重复的请求标识 MUST NOT 触发额外模型调用。手动重试 SHALL 创建新的建议和请求标识。

#### Scenario: Concurrent submission
- **WHEN** 同一工作区的另一草稿、窗口或标签页提交生成
- **THEN** 接入层拒绝重复并发，前端解释等待原因，现有请求继续可查看和停止

### Requirement: Observable run lifecycle
系统 SHALL 区分未连接、就绪、生成中、停止中、可审阅、失败、已停止及状态待核实。仅完整有效结果可以进入可审阅；没有可展示增量时 MUST NOT 伪造逐字流式输出。

#### Scenario: Structured-only response
- **WHEN** 服务仅在完成时返回完整结构化结果
- **THEN** 生成期间显示运行状态，完成校验后一次展示建议与差异

#### Scenario: Duplicate or late event
- **WHEN** 重复事件或属于已结束/旧归属请求的迟到事件到达
- **THEN** 不重复追加文本、不再次应用结果、不覆盖较新的终态或其他请求状态

### Requirement: Confirmed cancellation
系统 MUST 将断开前端连接与停止服务端执行区分；点击停止后 SHALL 请求服务端取消并核实状态，收到确认前不得显示已停止。

#### Scenario: Cancellation acknowledgement
- **WHEN** 服务确认取消且该请求不再运行
- **THEN** UI 进入已停止，已收到的片段不可接受，草稿不变

#### Scenario: Cancellation loses race
- **WHEN** 服务已经完成有效结果后才收到取消请求
- **THEN** 按核实的完成事实展示可审阅或已处置状态，不谎报已停止

#### Scenario: Connection lost
- **WHEN** 生成或取消时连接丢失且无法核实服务状态
- **THEN** UI 显示状态待核实，保留草稿和片段，不自动重新提交付费请求

### Requirement: Result recovery and errors
系统 SHALL 允许查询已知请求的状态和完整结果，并对不可恢复记录明确返回未知或失败；网络重连 MUST NOT 隐式重跑任务。格式错误、认证失败及服务错误 SHALL 转为可理解的错误且不泄露凭据。

#### Scenario: Recover completed result
- **WHEN** 连接恢复且系统可以取得原请求的完整有效结果
- **THEN** 恢复同一建议供审阅，仍执行正文版本和归属检查，不自动接受

#### Scenario: Service restarted without request mapping
- **WHEN** 服务重启后原请求与结果无法可靠对应
- **THEN** 标记待核实或中断，并允许用户明确发起新请求，不猜测历史关联
