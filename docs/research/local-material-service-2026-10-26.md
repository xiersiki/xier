# 本地资料服务：可行性核验与待做实验

核验日期：2026-10-26（Asia/Shanghai）。状态：方案研究，未实施、未运行 Electron/SQLite 兼容实验。范围为 TXT/Markdown 的应用内副本、SQLite/全文搜索、导入任务与 utility process 恢复；不连接 Agent、不修改原文件、不新增云同步。

## 推荐与关键限制

优先验证 **Electron 45 utilityProcess + 内置 node:sqlite**，把外部 native binding 风险控制在备选方案。理由是项目已经锁定 Electron 45，功能只需常规 SQLite/FTS5；不是因为 node:sqlite 已是稳定 API。备用是锁定具体版本的 **better-sqlite3 13.x（N-API）**。两者均须经过开发态和打包态实验，当前结论只是推荐顺序。

必须进入 PRD/TECH 的限制：

1. 两个候选的常规 SQL 都是同步执行。utility 进程能隔离 UI，不能自动让正在执行的单条 SQL 响应取消消息。取消需要提交点语义、可控工作分片和明确超时，不能写成即时中断。
2. FTS5 默认 tokenizer 不等于中文分词；trigram 的 MATCH 对少于三个 Unicode 字符的搜索串不命中。中文二字词、标点、大小写和搜索语法必须先写契约。
3. 崩溃时恢复数据库与重做应用任务是两件事。WAL 不会替应用恢复导入状态或补发成功回执。
4. 当前账号归属在 renderer；材料服务不能靠“每次调用传 userId”就声称有可信的授权边界。防止正常切账号串数据与抵抗已攻陷 renderer 是不同目标。

## 当前源码证据

只读核验源码 HEAD 为 `7c083d4a4a69c308be2b9f2e7f43625e6fcc784b`；其他会话可能继续修改，应在正式实施前重核。

| 当前事实 | 位置 | 方案影响 |
| --- | --- | --- |
| Electron 精确锁定 `45.0.0` | [package.json](/Users/gongchenyu/code/xier/package.json:55) | 运行时 Node 版本以 Electron 为准，不能用本机 Node 22/24 版本代替 |
| renderer 使用 `nodeIntegration:false`、`contextIsolation:true`、`sandbox:true` | [WindowService.ts](/Users/gongchenyu/code/xier/main/service/WindowService.ts:51) | 文件和数据库操作应在 privileged service；不为了省事关闭沙箱 |
| preload 用 contextBridge 暴露白名单 API | [preload.ts](/Users/gongchenyu/code/xier/preload.ts:106) | 新增域 API 或严格握手；不能返回 MessagePort 作为普通 contextBridge JSON 值 |
| Forge ASAR 开启，Vite 当前仅 main/preload 两个入口 | [forge.config.ts](/Users/gongchenyu/code/xier/forge.config.ts:9) | utility 入口需单独打包并明确开发/生产定位路径，不能指向源 `.ts` |
| RunAsNode fuse 为 false | [forge.config.ts](/Users/gongchenyu/code/xier/forge.config.ts:64) | 不依赖已打包可执行文件的 `ELECTRON_RUN_AS_NODE` 启动路径；使用 utilityProcess |
| auto-unpack-natives 只是依赖，未见对应插件实例 | [package.json](/Users/gongchenyu/code/xier/package.json:41)、[forge.config.ts](/Users/gongchenyu/code/xier/forge.config.ts:35) | 选择 better-sqlite3 时必须补 native 文件打包验证，不能说已有配置保证可用 |
| 资料之外的数据使用按账号命名的 Dexie | [dataBase.ts](/Users/gongchenyu/code/xier/renderer/dataBase.ts:95) | 本期只新增材料数据库；不顺带迁移聊天存储 |
| applySession 串行清理 stores、切换 renderer 数据库 | [auth.ts](/Users/gongchenyu/code/xier/renderer/stores/auth.ts:47) | 需接入材料上下文关闭/重建和迟到事件过滤；现有代码未提供 main 侧材料账号 lease |

## Electron 45 与数据库候选

[Electron 45 官方发布说明](https://www.electronjs.org/blog/electron-45-0) 列出 Node `24.22.0`。Node 对应 tag 的 [sqlite API 文档](https://github.com/nodejs/node/blob/v24.22.0/doc/api/sqlite.md) 声明 Stability `1.2 — Release candidate`，`DatabaseSync`/`StatementSync` 同步执行。该版本使用 `node:` 前缀加载，不能把文档中的类名理解成异步数据库。

Electron 曾有 Node 构建配置遗漏 SQLite 导致 builtin 无法加载的历史，[官方修复记录 #47706](https://releases.electronjs.org/pr/47706) 证明“嵌入某 Node 版本”不足以单独证明所有 builtin 的集成效果。该问题已经在历史版本修复，并非证明 Electron 45 存在同一问题；它支持必须在目标 utility runtime 中做 smoke test 的判断。

| 比较项 | node:sqlite | better-sqlite3 13.x |
| --- | --- | --- |
| 项目引入成本 | 无新增 `.node` 包，跟随 Electron 中 Node 的 SQLite 构建 | 新增 native 包、平台/架构产物及打包加载工作 |
| API 生命周期 | Node 24.22.0 为 release candidate，需隔离具体调用并锁运行时 | 库 API 与其 SQLite 版本由依赖锁定；本次未验证具体 13.x 与 Electron 45 的组合 |
| Electron ABI 风险 | 无第三方 addon rebuild；仍存在 Electron 集成差异风险 | **13.0.0 起转 N-API**，不能沿用“所有版本每个 Electron ABI 都必须重编译”的旧结论 |
| 包内原生文件 | 不新增第三方 native binary | 仍须正确选中平台/架构二进制；ASAR 外加载；缺少 prebuilt 时准备构建工具链 |
| SQL 阻塞/取消 | 同步 SQL；普通 IPC 取消无法在执行途中处理 | 同步 SQL；不能借换 binding 获得即时取消 |
| 推荐 | 第一顺位兼容实验 | 内置方案失败或出现具体 API/构建缺口后的备选 |

[better-sqlite3 13.0.0 原始发布说明](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0) 对 N-API 的表述是预编译“理论上”跨 Node/Electron 版本，本方案不把它改写成所有环境保证兼容。其 [troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md) 仍要求注意 Electron rebuild 与 ASAR unpack；应结合实际版本理解。旧 12.x 方案另有 V8/Electron ABI 和 prebuilt 矩阵风险，不建议无理由选旧版。Electron [native module 官方指南](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules) 是 Forge rebuild/打包核验依据。

实验必须记录 `process.versions`、`SELECT sqlite_version()`、`PRAGMA compile_options` 和实际 `CREATE VIRTUAL TABLE ... USING fts5(...)` 的结果。FTS5/trigram 可用性以创建和查询成功为准，不只看编译选项文字。数据库放 app 的 userData 下应用自有目录，不放 ASAR、源码目录或用户选择的源文件旁；原生扩展加载保持关闭。

## 沙箱与 MessagePort 的实际 API

[Electron MessagePorts 教程](https://www.electronjs.org/docs/latest/tutorial/message-ports) 与 [utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process) 支持以下链路：main 在 app ready 后 `utilityProcess.fork(builtEntry)`；用 `new MessageChannelMain()` 创建两个端点；`child.postMessage(message, [portA])` 把 A 交给服务，服务从 `process.parentPort` 的 `message` 事件取 `event.ports`；`webContents.postMessage(channel, metadata, [portB])` 交给窗口 preload，再通过 `window.postMessage(metadata, targetOrigin, event.ports)` 转给 renderer main world。主进程 `MessagePortMain` 采用 Node 风格事件，注册后需要 `.start()`；web 端口使用 DOM 风格 API。

不能使用 `ipcRenderer.send`/`invoke` 的普通参数转移端口；这条路径需要 `postMessage` 的 transfer 参数。[contextBridge 支持类型](https://www.electronjs.org/docs/latest/api/context-bridge) 也不能被当作任意 DOM/native 对象透明传输器。另一种可行方案是 preload 持有端口，通过域方法和数据事件代理 renderer；它的边界更窄，但需实测频繁进度事件的拷贝成本。不要在方案中混用两个模型而不选择所有权。

推荐先验证“main 中继建连、preload 留存端口”的窄 API 版本；如果基线表明直连明显必要，再采用官方 main-world 端口转移方式。直连后 service 自己必须验证每条协议，不能因为 main 只验证过建连就跳过数据校验。任何端口都只允许已绑定 ownerScope 的材料命令，不允许任意路径、SQL 或 channel。

[Electron 45 的沙箱 preload 变更](https://www.electronjs.org/blog/electron-45-0#breaking-changes) 移除了部分 Node shim/全局，当前仍提供 process/global 与 Electron 模块。新 preload 只能依赖实际支持能力或已打包 polyfill，不可在其中加载 fs、SQLite、Node events 或假定 Buffer/setImmediate 可用。源项目现有 process.platform 用法与这项变化不冲突。

握手与资源清理必须写明：renderer 先安装监听再请求连接；main 只接受已知 window 的 top-level frame，校验导航 URL/窗口归属；随机 connectionId、ownerEpoch、serviceGeneration 绑定端口；刷新、导航、账号切换和服务退出时关闭旧连接。若本地 file origin 只能用 `*` 转发，不把它表述成 origin 安全机制；依靠 source/握手标识、主 frame 限制和服务端授权。丢失端口后先取任务快照再恢复事件流，快照与事件使用 sequence 防止空窗和重复。

## 取消、幂等与提交点

依据同步 API 的执行模型，取消是应用协议设计，不能由 AbortController 名字自动获得。建议将每个文件作为最小业务提交单元：

- 原文件异步只读、按上限分块计算 hash/解码；处理中在可响应事件循环的边界检查取消，定期 yield。不要拿总文件字节量伪装成完整索引进度。
- 导入前持久化 task/item 与 requestId；处理中间结果为 staging 状态，用户搜索只读 ready 文档。
- 最后一个**短的同步事务**完成 document、FTS、task item 成功结果。事务前检查取消令牌，事务内不做文件 I/O、不跨 `await`。`succeeded` 事件只能在 COMMIT 后发。
- 取消与完成竞态，以 service 已串行处理到的状态和提交点为准：提交前接受取消则不发布资料；已经提交则返回 `alreadyCompleted` 和成功结果，不先显示 cancelled 再让资料出现。UI 的“已请求取消”不同于“取消已确认”。
- batch 中已提交的文件保留；取消只作用待处理/处理中项；若产品需要撤销已成功导入，另走删除命令，不能暗含回滚整个 batch。

[better-sqlite3 transaction 文档](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function) 明确不支持 async transaction 函数。SQLite [事务文档](https://www.sqlite.org/lang_transaction.html) 说明事务与 rollback 规则；不能对任意 SQLite 错误一概声称整个事务已经回滚。发生错误后确认事务状态、显式 rollback/关闭连接并返回结构化错误。

幂等键需要两层：`(ownerScope, requestId)` 唯一约束保障同次调用在 ACK 丢失后重发得到同一结果；内容指纹唯一约束定义“同内容二次导入”的产品规则。taskId、requestId、文件名、hash 不能互相替代。hash 应由服务对实际读到的副本字节计算；首次请求与不同参数重用同 requestId 应报冲突。不要用 `INSERT OR REPLACE` 无意删除旧资料再重建。

同步单条 FTS/COMMIT 最坏耗时决定取消上限。若本期最大单文件/语料下仍无法满足目标，应降低输入上限或再拆任务；强杀整个 utility 只用于不可响应服务的恢复，会影响该服务全部任务，不能伪装成单任务取消成功。

## 副本、WAL 与崩溃恢复

主会话当前设计选择（尚未实测）是把“内容副本”定义为 SQLite 中存储的原始字节 BLOB、解码正文和规范化 searchText，FTS 与成功状态一起提交。这样本期不必维持“副本文件 rename + SQLite”跨资源原子性。原始 BLOB 保留 BOM/换行字节用于准确去重，显示文本的 BOM 处理另行定义；Markdown 预览必须复用安全渲染，不执行 HTML 或外部资源。

当前拟定限制是 2 MiB/文件、100 文件且 20 MiB/批、500 份且 100 MiB 原始字节/身份，索引另计。这些数字是待实验的产品上限，不是实际性能成绩。服务在最终事务内强制总额与唯一约束，重复内容不重复计额，不能只在 renderer 预检；整批超文件数/总字节量与单项失败的关系按 PRD 执行。单文件 2 MiB 的 FTS 插入/提交最坏阻塞仍必须量测。

若 TECH 选择磁盘资料目录：文件只写应用生成的 UUID 路径，明确 temp 写入→flush/close→rename→DB commit 的顺序、每步崩溃时的孤儿文件扫描和清理。SQLite 事务不会自动把另一个普通文件纳入原子提交；不能把这条方案描述成“用事务即可无损恢复”。

[WAL 文档](https://www.sqlite.org/wal.html) 描述读写并发、checkpoint 及网络文件系统限制；[atomic commit](https://www.sqlite.org/atomiccommit.html) 讨论依赖文件系统/硬件的保证，[synchronous 文档](https://www.sqlite.org/pragma.html#pragma_synchronous) 说明持久性和性能的取舍。本期可承诺在明确配置下抵抗应用/utility 进程被杀，但不能用此测试宣称任意断电/硬件故障零丢失。

恢复建议：只有一个服务拥有材料库写连接；启动完成 migration 后恢复 durable task 状态；发现上次非终态 item 标为 interrupted，而不是凭猜测标成功；已提交结果可通过 requestId 查回，未提交 item 提示重试。优先从应用副本重试；没有已保存副本时必须让用户重新选择，不静默重读已变更的源文件。升级失败保持资料库和迁移前备份，禁止自动清空 DB“自愈”。

## 中文检索契约

[FTS5 原始文档](https://www.sqlite.org/fts5.html#tokenizers) 的 unicode61 把连续 token characters 组成词；trigram 支持子串但存在短查询限制。由此建议一期选“字面子串检索”，不要宣称中文语义搜索、自然语言分词或拼音搜索。

建议按输入分支明确行为：

| 输入 | 建议行为 | 必须覆盖的测试 |
| --- | --- | --- |
| 空白 | 不执行正文查询，显示资料列表 | trim/空格/换行 |
| 1–2 个 Unicode code points | 分页、有界扫描归一化标题/正文；若规模无法满足性能目标，需产品确认缩小查询范围或最短字符数，不能悄悄漏结果 | 中文“客户端”中的“客户”、单字、emoji、组合字符 |
| ≥3 个 code points | trigram 候选查询，再用同一字面匹配规则校验；分批扫描和稳定分页 | 中文三字、跨标点、空格、英文部分词、Markdown 标记 |
| `AND`、`OR`、`*`、`"`、`%`、`_`、反斜线 | 一期当普通文本；不直接暴露 MATCH/LIKE 语言 | SQL 参数绑定之外，还要验证 FTS 语法转义 |

主会话当前选择是 literal NFC + lowercase substring。建议确切定义为 NFC → JavaScript `toLowerCase()` → 再 NFC，非 locale-sensitive；换行规则固定，查询去除两端空白但保留内部空白。searchText 保留 normalizationVersion，不自动繁简转换或移除重音。长度用规范化后的 Unicode code points，而不是 JS UTF-16 `.length`。标题和正文分别匹配，不拼接出虚构的跨字段连续匹配。查询、候选校验、摘要高亮使用同一映射；例如 `İ` 小写后长度会变，不能直接把 searchText 的索引用在原文上。

短查询回退会扫描更多数据，是确定存在的成本；必须用一期数据上限验证延迟，不能用 debounce 代替查询性能。prepared statement 只防 SQL 注入，不保证 MATCH 无语法错误，也不保证 LIKE 通配符按字面处理。FTS 索引若采用 external-content 表，必须与资料在同事务增删并提供一致性检查/重建路径；普通 FTS 表更简单但会复制正文，需测体积。

## 账号隔离与威胁边界

主会话当前接受的边界是：现有唯一主窗口 auth 控制器通过专用桥报告登录态，主进程管理 activePartition/sessionEpoch；业务请求不能选择分区。账号切换先撤销旧 lease、停止订阅与拒绝后续新请求；旧任务只能写旧 scope，迟到事件不得渲染到新账号 UI。磁盘目录名由应用映射/hash 生成，不直接拼接 renderer 输入形成路径。主进程是唯一建连者，service 不提供任意 owner 路由。

这沿用受信 renderer 的现有认证假设，只承诺正常业务中的访客/A/B 分区、旧端口和迟到事件隔离；不新增云认证，不宣称抵抗已攻陷 renderer 或同一 OS 用户。**接收 renderer 的身份报告，不等于 main 独立完成账号鉴权。** 这个较小边界足够准确，前提是 TECH/验收不越界扩写安全承诺。

启动 auth 尚未报告时材料上下文应为 unbound，拒绝数据业务，不能默认落 guest；同账号 token refresh 不应无故撤销材料操作，真实身份切换才更新 epoch。报告串行化并 ACK，数据入口在新上下文 ready 后开放；切换时是否取消旧导入必须有明确规则。若未来需要恶意 renderer 下的授权保证，再单立 session 验证/离线身份政策。

访客资料与账号资料应始终分区；登录不自动搬运访客资料。退出登录只切换可见 scope，是否删除本机资料属于另一个明确产品操作。实验需覆盖 A→B→guest、切换时导入、旧端口仍发请求、旧任务迟到、窗口刷新和应用重启。

## 必须做的 spike（均尚未执行）

| 编号 | 实验 | 通过条件/输出 |
| --- | --- | --- |
| S1 | Electron45 utility 内 `node:sqlite`，内存和 userData DB，FTS5/trigram | 记录实际 versions/SQLite/compile options；完成插入、搜索、事务回滚、关闭重开；原始日志 |
| S2 | Forge/Vite utility 新入口，ASAR 与现有 fuses 下真实 package 启动 | 开发态和打包态都能 fork/build产物路径；DB确实位于隔离测试profile；不依赖系统Node；目标平台逐一声明 |
| S3 | 沙箱 preload 端口握手/代理 | ready竞态、刷新、service重启、端口关闭、账号epoch、未知消息均有可预测结果；不关闭 sandbox |
| S4 | 数据库选型备选，固定 better-sqlite3 13.x | N-API binary在计划OS/arch及packaged utility加载；ASAR unpack；缺少prebuilt的失败可解释；不能只npm安装成功 |
| S5 | 取消/提交竞态和幂等故障注入 | 在读文件、解码、FTS前后、COMMIT前后、ACK前杀进程；终态唯一，已提交资料可重查，未提交不可搜索，重试不重复 |
| S6 | 中文短词/字面查询与真实上限语料 | 明确每个查询期望集合；MATCH、短词fallback、高亮一致；保留query plan/时延/内存，验证门槛或回改范围 |
| S7 | ownerScope与现有auth生命周期 | normal切账和恶意旧port/伪造scope按声明边界处理；离线恢复/guest政策可执行，无跨账号可见事件 |
| S8 | UTF-8文本与文件边界 | BOM、CRLF、非法UTF-8、0字节、超限、扩展名伪装、源文件导入中变化、无权限/磁盘满均有对应错误且不损坏原文件 |

实验代码应在正式实施授权后的独立工作区完成，本研究未添加脚本、依赖、schema 或任何应用实现。S1–S3 是主方案阻断性可行性检查；S4 为备选验证；取消/检索/身份契约若实验失败，应回改 PRD/TECH，再进入行为实现。

## 独立文档一致性复核（2026-10-26）

复核对象是本目录 PRD.md、TECH.md 与 `xier-worktrees/local-material-design/openspec/changes/add-local-material-service/specs/` 两份 delta；没有执行代码或可行性实验。以下结论只能证明设计文字中的缺口被发现或补充，不能证明运行时行为正确。

初读发现并回报主会话的三处实质缺口：

1. `getImport(requestId)` 缺少重开后的任务发现入口，页面丢失内存 ID 后不能列出中断任务。后续读回 TECH 已加入有界 `listImports`，该文字缺口关闭。对应验收：清空 renderer 内存后重开，先列任务再查看逐项结果，而不是向测试事先注入 requestId。
2. 16 个在途命令与 32 项队列未给控制消息保留容量，取消或探活可被数据面满载阻挡。后续读回 TECH 已分离控制面、合并重复控制并声明不可抢占同步 SQL，该文字缺口关闭。对应验收：数据面持续满额时取消仍被接收；真实单条 SQL 阻塞仍单独计时。
3. 只做选择器总大小预检，无法阻止选择后、实际读取前稳定增长的文件绕过批次 20 MiB。后续读回 TECH 已加入冻结指纹、读前比较和实际批次字节上限，该文字缺口关闭。对应验收：选择后扩大源文件再导入，以及流式读取中超限；均不能绕过批额。

复核期间主会话还补充了最后一项结果与 `completed` 同事务、移除资料不级联删除历史逐项结果、UI 响应及内部全文复制的分别限额。后续实现测试应覆盖“最后一项是 duplicate/failed”而不只有最后一项 imported，并验证资料已移除时历史结果仍可查看但不能恢复正文。

另一个已回报的 RPC 边界是 **64 KiB 请求上限与 100 个合法深路径授权 manifest**：若内部 startImport 把所有完整路径放进同一请求，有效文本批次也可能超消息上限。建议明确 64 KiB 对应 UI/一般消息；私有授权 manifest 使用有序分片及独立总量上限，未完整接收不得创建导入任务。服务“32 项队列”应明确指 RPC 命令，而不是 100 个持久 pending 文件项。相应验收包含长目录/长文件名、manifest 缺片/重复/乱序，以及实际 100 文件批次。

其他核心设计未发现需要推翻选题的矛盾：BLOB/正文/FTS/逐项结果具有同事务边界；取消确认以持久终态为准；身份切换不复用旧服务写新库；短词和复杂 Unicode 通过字面 oracle 与 fallback 保持同一语义；所有性能、兼容与恢复结论仍保留 G0 实测条件。后续需验证主动退出/切账号时不触发旧 generation 自动重启，以及 stale RPC、进度和 exit 事件都遵守同一个生命周期归属。
