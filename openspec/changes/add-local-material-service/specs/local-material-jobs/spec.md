# Spec Delta

## Purpose

让本地资料导入具有可查询的逐项结果、明确的取消与持久终态，并在服务、窗口和账号生命周期变化后保持可解释状态。规范故障隔离和恢复，避免重复任务、错误身份写入及把临时进度误报为成功。

## ADDED Requirements

### Requirement: Bind operations to the active local identity
The system SHALL 在本地身份初始化完成前拒绝资料操作；绑定后所有资料请求只作用于该分区，业务调用方不得逐请求指定其他身份或存储路径。

#### Scenario: Startup identity is unresolved
- **WHEN** 登录恢复尚未报告当前访客或账号
- **THEN** 资料入口等待初始化，不将操作默认写入访客库

#### Scenario: Switch identity during import
- **WHEN** 用户切换账号或退出登录
- **THEN** 旧资料操作立即失效、旧视图清空、旧批次收到取消；确认旧服务结束或终止旧服务后才绑定新分区，旧结果不展示或写入新分区

### Requirement: Submit one idempotent batch per identity
The system SHALL 为每次确认导入提供请求标识并在持久接收后确认；同身份一次只有一个未结束导入批次，相同标识及相同输入返回原任务，不同输入复用标识报冲突。

#### Scenario: Acknowledgement is lost
- **WHEN** 批次已被接收但页面未收到确认，随后查询或重试相同标识和输入
- **THEN** 返回同一个批次及已保存状态，不新建任务或重复导入

#### Scenario: Concurrent or conflicting submission
- **WHEN** 仍有活动批次时提交新批次，或对已有标识提交不同输入
- **THEN** 返回正在处理或标识冲突的明确结果，不静默忽略或创建第二个活动批次

### Requirement: Expose bounded progress and authoritative results
The system SHALL 公开批次和逐项进度，进度中间态允许合并但最终结果必须可查询；离开资料页仅停止页面观察，导入仍可继续，关闭整个应用则由重开恢复规则处理。

#### Scenario: Page unsubscribes and returns
- **WHEN** 用户导入中进入聊天页面后返回资料页
- **THEN** 导入继续，返回后可以通过快照看到当前或最终状态，离页不被误当取消

#### Scenario: Slow observer
- **WHEN** 页面暂时无法消费进度
- **THEN** 服务不会无限累积该页面进度消息，恢复观察后能查询权威快照，不会因合并进度丢失最终结果

### Requirement: Linearize cancellation with persistent commits
The system SHALL 在取消请求后显示正在停止，并按服务确认的提交顺序决定结果；已持久提交的资料可保留，尚未提交项和等待项停止，已确认取消后不得再新增该批次资料。

#### Scenario: Cancel wins before commit
- **WHEN** 服务在当前项提交前处理取消
- **THEN** 当前未提交内容不出现，等待项取消，持久终态确认后页面显示已取消

#### Scenario: Commit wins before cancellation
- **WHEN** 当前项已提交后服务才处理取消
- **THEN** 当前项保留完成结果，其余未完成项停止；若整个批次已完成，重复取消返回完成而不改写终态

#### Scenario: Service is unreachable while stopping
- **WHEN** 取消请求无法得到服务确认
- **THEN** 页面显示状态待核实，不能显示已取消；服务重启后依据持久结果核对

### Requirement: Isolate service failures and bound restart attempts
The system SHALL 在资料服务退出或无响应时保持主窗口和原聊天可用，5 秒内将资料状态变为不可用或待核实；60 秒内最多自动尝试重启 2 次，持续失败时提供手动重启和诊断。

#### Scenario: Process exits during import
- **WHEN** 资料服务在某个文件导入中退出
- **THEN** 已确认资料保留，未确认项待核实，主窗口和正常聊天不因该服务退出而被主动关闭

#### Scenario: Repeated crashes
- **WHEN** 60 秒内自动重启次数达到 2 次仍未稳定
- **THEN** 自动重启停止，页面展示错误与手动恢复入口，不产生重启风暴

### Requirement: Recover persisted task state without implicit replay
The system SHALL 在服务或应用重新打开后通过分页任务历史公开发现并查询最后持久状态；未结束项标记中断，已经提交项及终态保持不变，不自动重读旧源路径。重试必须由用户重新选择源文件并创建关联新任务。

#### Scenario: Crash around final commit
- **WHEN** 服务在提交前或提交后但确认前退出
- **THEN** 重开后以原子持久结果决定该项是否完成，不依据页面最后进度猜测，不重复创建资料

#### Scenario: Retry interrupted import
- **WHEN** 用户对中断批次重新选择源文件并确认重试
- **THEN** 新任务关联旧任务，旧终态保留，已经导入的内容按重复资料处理

### Requirement: Meet measured interaction and cancellation budgets
The system SHALL 在 PRD 指定的合成上限语料与主验收设备上验证搜索 p95 ≤ 300 ms、导入时交互响应 p95 ≤ 100 ms、正常负载取消确认 p95 ≤ 1 s，并保存环境、样本、原始测量和正确性结果。

#### Scenario: Budget fails during feasibility experiment
- **WHEN** 实际安装包中的测量未达到预算
- **THEN** 记录失败数据并回评审范围或预算，不把未达标写成通过，不以丢内容、漏搜索或伪报取消换取达标
