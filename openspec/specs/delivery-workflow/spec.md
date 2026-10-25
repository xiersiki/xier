# delivery-workflow Specification

## Purpose
定义 Xier 从版本化需求规格、公开边界测试与红绿重构证据，到 GitHub 自动检查和评审交付的共同契约，让人和 Agent 会话能够可靠接续工作。

## Requirements

### Requirement: Specification precedes implementation
每个行为变更 MUST 关联 GitHub Issue，先形成 proposal、行为 specs、design 和 tasks，再通过用户认可的公开边界逐项执行 RED、GREEN、REFACTOR。

#### Scenario: A new agent starts a task
- **WHEN** 会话开始实现需求
- **THEN** 会话读取 AGENTS、相关主规格和飞书背景，建立独立 change，先保存 SDD，再编写失败测试和实现

### Requirement: Delivery gate checks the changed scope
命令 `node scripts/check-sdd.mjs --base <git-ref>` MUST 检查 base 到当前工作树的已跟踪差异；行为文件和配置文件由本次触及的有效 change 的 tdd.json.files 精确覆盖；缺失、无效输入或无法解析的 base MUST 非零退出并说明原因。

#### Scenario: Complete behavior delivery
- **WHEN** diff 的行为文件在完整 change 范围中，包含完成任务和有效 RED/GREEN/REFACTOR 证据
- **THEN** 门禁以 0 退出并输出通过摘要

#### Scenario: Missing or stale specification
- **WHEN** 行为文件没有本次触及的 change，或 change 缺 proposal/design/specs，或引用无关历史 change
- **THEN** 门禁非零退出，指出缺失资料或未覆盖文件

#### Scenario: Incomplete tasks
- **WHEN** change 的 tasks.md 缺少任务、仍有未完成复选框或没有已完成任务
- **THEN** 门禁非零退出并指出 tasks.md

### Requirement: Evidence is reviewable data
行为变更的 tdd.json MUST 声明 red-green-refactor 模式、测试边界及至少一个周期。每周期记录场景与 RED/GREEN/REFACTOR 的命令、实际退出码、说明和 change 内的非空文本证据；RED 是测试失败，GREEN/REFACTOR 是成功。命令只作为数据，门禁 SHALL NOT 执行记录中的命令。路径越界或符号链接逃逸 MUST 被拒绝。

#### Scenario: Missing or invalid evidence
- **WHEN** RED 不存在、退出码为零、成功阶段非零、记录不完整或证据不存在/越界
- **THEN** 门禁非零退出并指出证据问题

#### Scenario: Recorded commands are not executed
- **WHEN** 证据命令包含有副作用的 shell 文本
- **THEN** 门禁仅检查记录，不执行它

### Requirement: Proportional validation and archival
纯文档改动 SHALL 可直接通过范围门禁；配置/依赖/纯规格变动可使用有理由和成功检查证据的 verification-only 模式，但行为代码 SHALL NOT 使用该模式。归档 change 与活动 change 使用相同证据规则；删除旧活动路径不能绕过归档校验。

#### Scenario: Docs or dependencies
- **WHEN** 仅修改文档，或配置/依赖修改具有完整规格资料（无行为变化可显式 skip_specs）及适用成功验证
- **THEN** 门禁通过；包含行为代码的 verification-only 交付失败

#### Scenario: Archived delivery
- **WHEN** 完成的 change 归档到 openspec/changes/archive，主规格已同步
- **THEN** 门禁仍能定位并检查该 change 的范围、任务与证据

### Requirement: GitHub enforces current checks
GitHub PR 和 main CI MUST 使用项目锁定的 OpenSpec 执行严格规格校验、归档任务校验及范围门禁；required MUST 同时依赖规格、应用测试、站点和桌面构建成功。CI 输出到 checks/summary，不额外逐次评论。

#### Scenario: A required check fails
- **WHEN** 规格门禁失败或任一必需 job 未成功
- **THEN** required 失败，受保护 main 不能合并该 PR

#### Scenario: Honest evidence boundary
- **WHEN** CI 当前检查通过
- **THEN** 交付说明只声明当前校验与测试通过；历史 RED/GREEN 顺序和场景充分性仍通过日志、提交和评审核对
