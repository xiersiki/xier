# 独立会话增量复核

评审者是本任务独立 agent material_review，依据仓库 AGENTS 的独立会话评审要求执行，未修改实现；同一 GitHub 账号不构成独立身份 approve。

复核针对公开 API、源码、Unicode 查询 oracle、真实进程及受控磁盘故障。307/312 个边界查询实验分别核对常规 Unicode 的检索集合。发现并修复：混合非法文件导致全批拒绝、取消持久化失败后无法恢复、切账号残留导入忙状态/搜索、128 个原始码点 lowercase 展开后误拒、超长搜索仍 RPC、慢观察者无界队列、控制请求挤掉心跳、高版本 schema 丢失诊断、未配对 surrogate 被 SQLite 替换、utility 终止阻塞导致超过5秒、SQLITE_FULL 被重复 ROLLBACK 覆盖。

最后增量复核确认 storage-01-green、字节预算在解码前累计、benchmark-03 的三种取消各10次；未发现新增 P1/P2。files-03 用有效 ASCII 验证计数中断，没有直接测试非法 UTF-8 失败块计费，这一点来自代码核验。

绘制计量从监听器开始会漏排队延迟：已用真实失败断言 paint-02-red 后改成原始 event.timeStamp。双 rAF 仍只是绘制机会代理，文档不宣称真实目标呈现已通过。--user-data-dir 参数只做存在检查，不能证明实际隔离。之后 Host 增加额外字段/历史请求白名单，有 host-06 真实断言红绿；随后独立增量复核确认这两处修复与文档限制均符合预期，未发现新增 P1/P2；该轮未重新运行无变化测试。

评审明确保留 TDD 历史缺口，详见 README.md。没有把 missing-module 或脚本失败当有效行为 RED/GREEN，没有构造追溯性全程 TDD 结论。GUI、真实认证切换和交互计量尚未完成，不能给整体交付通过结论。

锁屏期间补充的真实恢复验证经独立只读复核：读取中退出与终态私有事件不转发两个边界均成立，5份副本全文及含baseline的5个源hash核对无变化（recovery-boundaries-full.txt/.json，8/8通过）。这些是实现后补充回归，不补造RED；没有真实renderer或IPC ACK丢失注入。feature-off仅覆盖Host拒绝、未启动存储与合成文件保持，不等于完整应用开关/版本回退验收；5.4仍未勾。最终增量只读复核未发现新增问题。

选择后源文件删除/替换的小修经最后只读复核通过：open失败安全映射FILE_UNREADABLE，ELOOP映射SOURCE_CHANGED；指纹、正常读取、关闭逻辑不变，RED为真实断言，GREEN覆盖删除和换symlink。未发现新增P1/P2，评审未重复运行native/smoke；这些另以electron-source-fix与packaged-source-fix日志为准。
