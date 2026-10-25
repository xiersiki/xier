# 启动加载页验收

2026-10-25 macOS arm64、Node 22.23.1 / Electron 45.0.0。

RED 在现有真实 app.asar 中读取 .vite/build/loading.html，失败为文件不存在。主进程 Vite 配置显式恢复 copyPublicDir 后重新 make，同一个测试 GREEN；复核无进一步重构必要，单项配置保留最小修改，再跑同一测试通过。测试工具为直接声明的 @electron/asar 3.4.1。

重新从隔离 profile 启动最终 app：主窗口与历史对话正常，主题设置在重启后保留，消息末尾可见；启动日志无此前 loading.html ERR_FILE_NOT_FOUND。实际页面通过原生 UI 检查。未验证加载动画持续时长，不声称 Windows/Linux GUI 已验收。

三平台 CI 在 make 后、upload 前执行相同实际归档测试，失败仍由 required 阻止合并。本机全量类型与离线回归 54 通过、1 个真实模型测试跳过，日志见相邻 repair-app-dependency-update 的 check-accepted.txt。GitHub 最终状态另见 PR #17 / Issue #20。

首轮远端 Windows 构建成功但产物测试因 asar API 路径分隔符失败；测试路径已改为原生 join，原失败日志与修正后的本机回归保留。Windows/Linux 当前成功与否以 PR 最新提交 CI 为准，不能用本机日志代替。
