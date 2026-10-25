# Spec Delta

## Purpose

让用户在桌面与本地浏览器中完成文本副本编辑、选区改写、差异审阅与撤销，并在异步生成、正文变更和保存异常时保护用户对内容的控制与可恢复性。

## ADDED Requirements

### Requirement: Draft editing and persistence
系统 SHALL 支持创建、导入 UTF-8 TXT/Markdown 副本、编辑、自动保存和导出草稿；正文上限为 20,000 个 Unicode 码点。系统 MUST 仅在持久化成功后显示已保存，且不覆盖导入源文件。

#### Scenario: Save and reopen
- **WHEN** 用户编辑有效草稿且本地存储正常
- **THEN** 停止输入后 1 秒内确认保存，重开显示最后确认保存的正文，导入源文件保持不变

#### Scenario: Invalid import or failed save
- **WHEN** 导入无法解码或超限，或保存发生失败
- **THEN** 系统明确提示且不静默截断、不虚报已保存；保存失败时保留内存正文并提供复制/导出补救

### Requirement: Explicit selection context
系统 SHALL 仅在选区非空且不超过 4,000 个 Unicode 码点时允许生成，并在发送前展示选区与要求；默认 MUST NOT 发送全文、其他草稿或历史聊天。

#### Scenario: Selection changes before response
- **WHEN** 用户在发出生成请求后移动光标或改变选区，但未修改正文
- **THEN** 返回建议仍关联发送时的原始选区，不改成当前选区

#### Scenario: Invalid selection
- **WHEN** 选区为空或超限
- **THEN** 禁止提交并解释原因，不发出模型请求

### Requirement: Review before application
系统 MUST 将模型结果作为候选建议；仅完整校验后的非空纯文本替换结果可接受。接受、拒绝和复制 SHALL 分别有明确操作，流式片段和非法结果 MUST NOT 写入正文。

#### Scenario: Reject or copy
- **WHEN** 用户拒绝或复制建议
- **THEN** 正文及正文撤销历史不因该操作改变

#### Scenario: Accept once and undo
- **WHEN** 用户连续触发接受同一有效建议，随后手工编辑并依次撤销
- **THEN** 建议只替换原选区一次，撤销先恢复后续手工编辑，再一步撤销该次接受

#### Scenario: Malformed result
- **WHEN** 结果为空、缺必需字段、截断、超过正文上限或类型不支持
- **THEN** 不允许接受，显示可理解的失败原因，正文保持不变

### Requirement: Revision and ownership protection
系统 MUST 在接受前校验草稿、账号归属及正文版本；发出请求后正文发生任何变动时，该建议 SHALL 过期，禁止自动重定位或自动合并。

#### Scenario: Edit then undo while generating
- **WHEN** 用户发出请求后修改正文，再撤销为相同文本
- **THEN** 原建议仍视为过期，用户只能复制或重新申请

#### Scenario: Switch draft or account
- **WHEN** 用户切换草稿或账号后收到旧请求的迟到结果
- **THEN** 结果不得写入当前正文或出现在其他账号下；仅原归属的建议记录可被更新

### Requirement: Local restoration
系统 SHALL 隔离用户与访客的本地草稿，恢复已保存正文和建议处置状态；重开进行中的请求 MUST 显示中断或待核实，不自动重发。新草稿不加入聊天云同步，完整撤销栈无需跨重启恢复。

#### Scenario: Reopen after interruption
- **WHEN** 应用在生成或保存过程中退出后重开
- **THEN** 恢复最后确认保存的数据，不把未知请求显示为成功，不重复应用已接受建议

### Requirement: Shared accessible interaction
桌面和本地浏览器 SHALL 提供相同内容协作行为；上下文选择、建议差异和生成状态三类组件 MUST 可脱离 Electron 和真实模型独立演示。关键操作 SHALL 支持键盘，差异不得只用颜色表达，输出不得抢编辑焦点。

#### Scenario: Keyboard and component fixtures
- **WHEN** 用户仅使用键盘完成选择、发送、停止、接受、拒绝及撤销，或打开组件独立演示
- **THEN** 操作可完成、焦点可辨认、错误与终态可感知，组件可展示正常与异常状态
