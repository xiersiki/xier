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
GitHub PR 和 main CI MUST 使用项目锁定的 OpenSpec 执行严格规格校验、归档任务校验及范围门禁。required MUST 始终运行，要求范围分类和规格成功，并要求被选择的 app/site/desktop 检查成功；只有显式不需要的检查可以 skipped。CI 输出到 checks/summary，不额外逐次评论。

#### Scenario: A required check fails
- **WHEN** 分类或规格失败、缺失，或被选择 job 失败、取消、跳过
- **THEN** required 失败，受保护 main 不能合并该 PR

#### Scenario: Unneeded checks are skipped
- **WHEN** 分类成功且只需要站点检查，规格与站点成功，应用与桌面跳过
- **THEN** required 成功

#### Scenario: Honest evidence boundary
- **WHEN** CI 当前检查通过
- **THEN** 交付说明区分运行与有意跳过的检查；历史 RED/GREEN 顺序和场景充分性仍通过日志、提交和评审核对

### Requirement: CI selection follows changed scope
公开 CLI `node scripts/ci-scope.mjs --base <git-ref> [--full]` MUST 根据 base 到已跟踪工作树差异输出 app/site/desktop 布尔 JSON。普通仓库文档与 OpenSpec 资料不选择额外构建；site 选择站点；普通 UI 与离线测试选择应用；高风险、构建依赖、CI 和未知路径选择全部。混合取并集，删除和重命名不能漏掉旧路径风险。无效 base 或参数 MUST 非零退出。手动 CI、ci:full 标签及 --full MUST 选择全部检查；发布继续执行既有应用及三平台验证。

#### Scenario: Documentation or site only
- **WHEN** 只改 README/OpenSpec 资料，或只改 site 页面
- **THEN** 前者只保留始终执行的规格检查，后者增加站点检查

#### Scenario: Small UI correction
- **WHEN** 只改普通 renderer UI 和对应离线测试
- **THEN** 选择应用检查，跳过无关站点与桌面构建

#### Scenario: Conservative coverage
- **WHEN** diff 含主进程、认证、数据、打包依赖、工作流或未知路径，或把高风险文件改名为文档
- **THEN** 选择全部检查；无法读取差异时失败而不是输出空范围

#### Scenario: Explicit full validation
- **WHEN** 手动运行 CI 或 PR 加 ci:full 标签
- **THEN** 无论差异大小都选择全部检查

### Requirement: Small fixes retain proportional evidence
局部、契约不扩展且可回退的小修 SHALL 保留简短 proposal/specs/design/tasks、公开边界回归的真实 RED/GREEN 证据与一次独立评审。无重构时可以引用刚通过的 GREEN 记录作为 REFACTOR 证据并说明理由；相关输入未变化不得要求机械重复检查。认证、IPC、数据迁移、打包和主要依赖变化 MUST 使用完整风险分析及适用验证。飞书 SHALL 在普通修复发布/迭代时汇总，契约、接口、架构、数据、安全及流程变化即时同步。

#### Scenario: Routine correction
- **WHEN** 修复局部显示问题且无高风险边界变化
- **THEN** 同一 change 与 PR 保存简短规格、回归证据、评审和交接，不再为同一事实新增独立交接页或逐次复制到飞书
