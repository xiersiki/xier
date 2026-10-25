# Tasks

实施尚未开始，以下均为待开发任务。隔离接入实验的现有结果见 evidence/integration.md，不替代产品测试或 TDD。每个行为任务按“一个公开边界失败场景 → 最小实现 → 保持绿色重构”推进，记录真实 RED/GREEN/REFACTOR 命令与日志，不一次写完所有测试再堆实现。

## 1. 编辑与审阅闭环（约 3–4 个开发日）

- [ ] 1.1 增加内容入口、平台接口和 CodeMirror 包装，用空草稿/导入副本的失败测试开始，验证中文、emoji、换行、空选区及 20k/4k 限制；绿色后整理公共类型，补模块使用说明。
- [ ] 1.2 用固定 AgentPort 响应实现选择、预设/自定义要求、只读建议、接受/拒绝/复制；逐场景 RED/GREEN/REFACTOR，验证未接受不改变正文且导入源文件不变。
- [ ] 1.3 实现单 transaction 接受、重复操作去重与 undo 隔离；以“接受→手工编辑→两次撤销”和双击接受测试验证，记录事务设计依据。
- [ ] 1.4 实现正文 revision/归属校验与 stale 状态；测试请求后编辑、编辑再撤销、切换草稿、迟到结果，确认不按当前光标替换。

## 2. 组件库增量消费（约 2–3 个开发日）

- [ ] 2.1 在 xier-element 独立 change/分支新增 ai-ui 包与 ContextSelection、RewriteSuggestion、GenerationStatus，按 props/emits 的键盘与状态测试做 RED/GREEN/REFACTOR，附正常/错误/过期 fixture 和文档；原公共 API 保持兼容。
- [ ] 2.2 在组件库验证 ESM、类型、CSS exports、Vue external 和图标依赖，产出 pnpm pack tarball；用独立消费 fixture 验证不依赖 Electron、Pinia、Agent 或 key，记录实际包体积而非估算。
- [ ] 2.3 Xier 安装 tarball 并替换对应业务展示，验证第 1 组交互不退化；核验 Vue 版本与样式隔离后再发布组件版本并更新 lockfile及接入说明。

## 3. OpenCode 与 AG-UI 连接（约 3–4 个开发日）

- [ ] 3.1 建立受控 gateway、profile 生命周期、鉴权与配置验证；通过假服务覆盖缺失/版本不符/401/超时，验证实际工具白名单与隐式指令隔离，文档记录支持的 OpenCode/SDK/model 组合。
- [ ] 3.2 建立独立 session、结构化结果校验、请求 ID 幂等和工作区并发锁；通过 HTTP/IPC 公共契约逐场景 RED/GREEN/REFACTOR，覆盖非法 JSON/空结果/超限输出/同 ID 不同输入与多个窗口提交。
- [ ] 3.3 转换 RUN_STARTED、STATE_SNAPSHOT、RUN_FINISHED/RUN_ERROR 及真实 text 增量，接入 Vue composable/reducer；用官方 AG-UI 客户端验证事件顺序、重复快照、提前 EOF 和无增量情况，更新协议映射说明。
- [ ] 3.4 实现服务端取消、取消/完成竞态、断线 unknown 和 GET 核实；分别验证 HTTP abort 不等于任务停止、服务确认后 stopped、迟到事件不覆盖终态，不自动重发。
- [ ] 3.5 固化 1.19.4 历史接口兼容测试，使用 messageID/latest assistant 恢复并核验结果；加入 host 重启映射丢失场景，记录限制，不扩展 Agent 内核。

## 4. 保存、归属与恢复（约 2–3 个开发日）

- [ ] 4.1 新建独立内容数据库，串行版本保存及正文/建议状态原子提交；用 fake-indexeddb 的重开/过时写入/保存失败测试先 RED 再 GREEN，补 schema 和恢复文档。
- [ ] 4.2 接入现有桌面账号切换归属、独立浏览器访客 scope 与迟到回调隔离；公开仓储/UI 测试验证访客与账号之间不串数据，新表未加入聊天云同步。
- [ ] 4.3 实现关闭前 flush、失败复制/导出、进行中请求重开 unknown、跨标签单写者；覆盖锁失效/标签关闭后的恢复，验证不虚报保存成功、不自动重跑或应用建议。

## 5. Web 与桌面联合交付（约 2–4 个开发日）

- [ ] 5.1 建立独立 Web bootstrap 与同源 Node host，复用内容模块和 gateway；用浏览器启动测试验证无 window.api/Electron 依赖，校验 Host/Origin/会话授权和 profile 单实例，写可执行启动指南。
- [ ] 5.2 为 Desktop/Web AgentPort 跑同一契约场景，并验证订阅清理、窗口退出、仅停止本应用拥有的进程；旧聊天、取消、认证和账号隔离回归通过。
- [ ] 5.3 在 macOS arm64 桌面与同机 Chrome 各执行 PRD 十个固定场景，记录 20/20 结果；进行五次真实生成、审阅与应用并完整记录成功/失败，至少四次成功且零未确认正文修改。
- [ ] 5.4 记录上限文本下选区/接受/撤销各至少 30 次的 p95，正常自动保存 20 次和故障注入结果；验证键盘、非纯颜色 diff、焦点与三类组件独立示例。
- [ ] 5.5 执行适用 typecheck/test/build/package 检查及 spec:validate/spec:gate，保存真实证据和文件范围；核验安装包启动与外置 OpenCode 接入，文档明确未支持的平台，不把 renderer build 当作桌面安装验收。

## Workflow follow-up

- 所有实施与适用验证完成后同步主规格、归档 change 并验证归档；当前方案稿不能提前归档或合并为功能完成。
- PR/CI 记录代码与交付事实，飞书维护决策、验证摘要和导航，不复制一份另行推进的任务表。
