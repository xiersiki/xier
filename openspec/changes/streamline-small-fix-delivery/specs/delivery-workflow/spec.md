## MODIFIED Requirements

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

## ADDED Requirements

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
