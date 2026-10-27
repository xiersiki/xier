# 本地资料服务：验证与交接

实施中，未合并、未发布。代码和本记录随 Draft [PR #29](https://github.com/xiersiki/xier/pull/29) 交付；未关闭的验收保留在 tasks.md，不能据此宣布整期完成。

## 已取得的证据

| 范围 | 结果 | 原始证据 |
| --- | --- | --- |
| 全量应用检查 | 类型检查、最终增量后 113 项离线测试通过；7 项真实 Electron 进程测试通过 | check-final.txt、electron-final.txt；增量后 check-review.txt |
| 桌面产物 | macOS arm64 Forge package；ASAR 独立 utility 入口、SQLite/WAL/FTS5 启动通过 | package-final.txt、packaged-final.txt；增量后的 package-review.txt |
| 站点 | 首次因本 worktree 未安装 site 依赖失败，npm ci --prefix site 后成功 | site-final.txt、site-final-retry.txt |
| 上限语料 | 500 份 / 100 MiB；冷/暖各 100 次；内容和源文件 hash 核验无损失、无源文件改动 | benchmark-final.json |
| 搜索 | Main↔utility 冷 p95 124.97 ms、暖 p95 123.90 ms；不含 renderer debounce 和绘制 | benchmark-final.json；此前真实预算失败保留在 benchmark-01-failed-budget.txt |
| 取消 | 30 次；读取中、提交先完成、整批完成后各 10 次；p95 537.05 ms；取消确认后不再提交 | benchmark-final.json；benchmark-03-stages.txt 为独立复核过的前一轮（p95 601.07 ms） |
| 故障 | 10 次 SIGKILL 退出检测，最大 15.31 ms；真实无响应测试另验证 5 s 以内，不将退出检测等同于卡死检测 | benchmark-final.json、unresponsive-01-red/green.txt、electron-final.txt |
| 存储 | 自建 32 MiB HFS+ 镜像的物理磁盘不足；只读和损坏；保留旧副本、源文件和可重开状态 | storage-01-red/green.txt；tests/materials/storage-faults/reproduce.sh |
| 独立复核 | 发现并修复混合非法选择、取消写失败、旧账号状态、规范化变长、进度背压、心跳控制保留、高版本启动诊断、卡死终止及磁盘错误被 ROLLBACK 覆盖 | review.md、对应真实红绿日志 |

环境为 Apple M4 Pro / Darwin 25.4.0 / arm64，Electron 45.0.0 / Node 24.22.0。冷指每次重开 utility 与 SQLite 连接，未清除 OS 文件缓存。存储故障夹具使用系统 Node 22.23.1 / SQLite 3.51.3 和真实服务源码；其进程适配器是测试夹具，不能替代 Electron 包内运行。默认离线测试不发真实模型请求，原生 Electron 测试通过显式命令运行。

高变化 trigram 语料关闭后的 SQLite 约 882 MiB（924,942,336 字节），约原始字节 8.82 倍。raw BLOB、正文、规范化列和索引均占空间；100 MiB 是原字节配额，不是磁盘占用上限。见 benchmark-storage.json。

## 尚未关闭

- 完整 12 类 GUI 场景、实际认证切换、导入时搜索输入/切页/聊天输入各 30 次绘制测量。服务基准不能替代这些项目。
- 系统文件选择器中，自动化选中的合成文件显示为蓝色，但“打开”仍灰色；自动化原生坐标操作报告无可用窗口。独立 QA bundle 标识后仍可复现，已请求人工确认以区分工具与产品问题。没有据此修改文件过滤或跳过 OS 授权。
- Windows/Linux 实际 GUI 未验证；三平台产物检查以本 PR Actions 结果为准。
- 当前 change 未归档，spec:gate 会因未完成任务失败；不能为绿色门禁虚勾任务。

绘制 QA 为显式 --material-ui-trace=<path> 与 --user-data-dir=<task-profile> 的本地工具，只记录事件种类和耗时。使用原始 DOM event.timeStamp 包含排队时间，双 rAF 仅提供后续绘制机会代理，须结合可见内容验收；不单独作为真实目标已显示的证明。运行者必须选择实际隔离目录，参数存在检查不能证明目录为空。

## TDD 历史限制

SDD 先行提交为 d786b8499888f260604968ae9e6034556c6b4634。tdd.json 记录精确文件与实际日志；日志不是不可篡改审计。

host/files/service/ui-01-red 及 paint-bootstrap 是缺失模块、没有执行测试，未作为行为 RED；supervision-01-red/green 都是脚本解析错误，未作为 GREEN。repository-01/03/04 的缺失方法异常只说明 API 尚不存在，不能证明所有语义都分别先失败。后续断言、当前回归与独立 oracle 可证明对应行为，不能追溯证明初始实现全程严格 TDD。g0-package-red 是缺少 QA 入口导致的超时，仅验证当时端到端 smoke 不可用。

保留所有失败日志，包括最初超预算、网络 TLS 下载失败与无效测试启动；不把它们改写成成功证据。

files-03-red.txt 为保留断言与栈的可读摘录；原始 130,045 行合成 Buffer 差异保存在同名 .txt.gz，摘录内有原文 SHA256。其他运行日志保持原始输出（含终端换行），代码空白检查对日志单独排除。
