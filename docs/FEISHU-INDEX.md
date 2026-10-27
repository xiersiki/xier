# Xier 项目知识库索引

维护约定自 2026-10-25 起生效。项目所有者指定的 [Xier 飞书总入口](https://pcn11w88fq9h.feishu.cn/wiki/G2JDw4BdBiLEygkzVxKcYjx3nRb) 是项目长期知识入口，帮助新会话理解目的、范围、状态、设计、决策和验证依据。

会话开始时读取 [文档治理与会话协作规范](https://pcn11w88fq9h.feishu.cn/wiki/E0Bgwlb4ziX7lWk5CzHcL8ionyd) 和任务相关资料；结束时更新对应文档与交接。实际执行规则见仓库根 [AGENTS.md](../AGENTS.md)。

## 主题导航

| 分类 | 主要内容 | 飞书入口 |
|---|---|---|
| 01 项目概览与路线图 | 产品定位、资源、当前检查、路线图与待核实事项 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/JpSPwbOyJi5qrykDq1pcSvJCnYf) |
| 02 文档治理与会话协作规范 | 本知识库的作用、资料分工、更新/交接规范 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/E0Bgwlb4ziX7lWk5CzHcL8ionyd) |
| 03 产品需求与体验设计 | 已有能力与产品提案、需求模板、体验设计 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/OC8lwKQhaiDa4wko6ljcBKnWnKb) |
| 04 技术架构与接口数据 | 当前架构、IPC、模型、数据与迁移 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/ZT9ywpmJvimcqxkbJ21cKW3xn3H) |
| 05 研发流程与工程化方案 | Agent 协作、GitHub PR、CI/CD、Pages 与发布路线 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/KwbAwXJZ4it8f0kZOHgc56n9nxb) |
| 06 测试验收与发布运维 | 最新检查、历史验收、发布与事故记录模板 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/Rh5UwZZTUiBYycktQdhcWJqXnBV) |
| 07 决策记录与任务交接 | ADR、待确认提案、交接与待办 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/TqyQwZYmxiSRgukoY0dcAdnlnrh) |
| 08 开源调研与选型依据 | 官方来源、开源方案比较、许可与版本边界 | [打开](https://pcn11w88fq9h.feishu.cn/wiki/SN3zwGPoxiQzmAkzKh1cm3ImnJf) |

## 已迁入资料及主要维护位置

| 资料 | 飞书页面 | 本地来源与同步规则 |
|---|---|---|
| Agent 工作台第一版提案 | [03.1](https://pcn11w88fq9h.feishu.cn/wiki/V7cgwjqTTi7XnHkxbj4cFPyKnws) | 原“个人项目”工作区 `docs/Agent第一版功能与架构方案.md`；后续需求/设计讨论以飞书此页为主要位置，实施规格再与提交关联 |
| 桌面对话界面设计记录 | [03.2](https://pcn11w88fq9h.feishu.cn/wiki/EBnIwdQ5qiYXoCkQSnxcuCpznbg) | [UI-DESIGN.md](UI-DESIGN.md)；随版本维护仓库说明，并同步飞书状态与变化 |
| 模型适配与数据迁移记录 | [04.1](https://pcn11w88fq9h.feishu.cn/wiki/ARCkw5dU5i4VnIkCe3ecZfVPnXd) | [MODEL-ADAPTER.md](MODEL-ADAPTER.md)；代码/迁移以仓库为准，飞书维护对应设计和验收记录 |
| 恢复与验收记录 | [06.1](https://pcn11w88fq9h.feishu.cn/wiki/J8u0w6VqwiTCojkLrhrcammLnKd) | [RECOVERY.md](RECOVERY.md)；保留 2026-10-23 历史事实，新验收追加独立带时间记录 |
| Agent 协作开发范式 | [05](https://pcn11w88fq9h.feishu.cn/wiki/KwbAwXJZ4it8f0kZOHgc56n9nxb) | 原“个人项目”工作区 `docs/Xier-Agent协作开发范式.md`；后续工程化决策在飞书及关联 Issue/PR 维护 |
| Agent 协作与交付链路验收 | [05.1](https://pcn11w88fq9h.feishu.cn/wiki/VFiQwsEZmiY3uwkl3Nuc3i9un1e) | 工程化实施、独立评审、CI 阻断与恢复、站点及发布验收记录；通过链接引用 GitHub 事实 |
| OpenSpec 与 SDD/TDD 开发规范 | [05.2](https://pcn11w88fq9h.feishu.cn/wiki/UC9GwJwXyi6ozSkgCG7c0uFYnof) | [版本化执行规则](spec-driven-development.md) 与 `openspec/` 保存规格/证据；飞书保存目的、决策与验收链接 |
| 开源方案调研 | [08](https://pcn11w88fq9h.feishu.cn/wiki/SN3zwGPoxiQzmAkzKh1cm3ImnJf) | 原“个人项目”工作区 `docs/research/2026-10-25-agent-oss-landscape.md`；保留来源日期，复核后记录增量结论 |
| 本地资料库 PRD | [导入、搜索与恢复](https://pcn11w88fq9h.feishu.cn/wiki/LMW1w1n5AiSIDBkeheac4WWQnij) | 实施中、未合并/发布；[PRD 快照](product/local-material-service.md)；[Draft PR #29](https://github.com/xiersiki/xier/pull/29)；完整 GUI/交互验收尚未关闭 |
| 本地资料服务技术方案 | [进程、事务与恢复](https://pcn11w88fq9h.feishu.cn/wiki/Hf02wtW5eiXhRfkUQDec9qCpnWe) | [OpenSpec 设计与任务](../openspec/changes/add-local-material-service/design.md) 为版本化方案；[技术依据](research/local-material-service-2026-10-26.md)；Issue #28 |

飞书迁入页开头注明来源、时间与状态。历史 GUI/真实服务验证没有因迁入而重新执行；产品 Agent 工作台仍是提案。不要将历史来源中的“本轮”“已验证”自动理解为当前会话或当前提交。

## 信息一致性

- GitHub Issue/PR 保存任务与审查事实，Actions/Release 保存执行/交付证据；飞书组织需求、设计、决策、知识和相关链接。
- 新资料放到以上分类下，先查已有页面再新建，并同步父页索引。根页只维护必要导航和关键状态。
- 变更涉及多个位置时在同一任务同步更新；未完成同步时在交接里明确页面、拟更新内容和原因。
- 文档说明与实际实现不一致时记录偏差；需求意图以已确认决策为准，实现事实以代码与可复现证据为准。
- 飞书不能访问时，本索引与 AGENTS.md 提供离线入口；继续不依赖缺失信息的工作，并保留待同步摘要。

## 维护记录

2026-10-25：建立总入口、8 个主题页及 4 篇下级资料；新增 AGENTS.md 和本索引。当前知识库维护依靠每个任务按规范执行，尚未配置自动同步服务或后台监控。
