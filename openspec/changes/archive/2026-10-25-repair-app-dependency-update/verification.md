# PR #17 依赖验收

2026-10-25，Issue #20。本记录针对维护后的兼容组合，不代表原机器人全部 40 项均被接受，也不代表已发布新的桌面 Release。

## 版本取舍

| 范围 | 最终选择 | 原因 |
| --- | --- | --- |
| Electron | 45.0.0 | 实际打包、隔离 profile、preload/IPC 与离线回归验收；当前源码 macOS 要求 13+ |
| Forge | 7.11.2 整组 | 8.0.1 的 .cjs 入口与现有 .js 源码不兼容，真实 make 失败见 evidence/make.txt |
| Vite / fuses | 7.3.7 / 1.8.0 | 满足 Router 5 的 Vite peer，保留 Forge 7 兼容；不强行升级 Vite 8 / fuses 2 |
| TypeScript | 5.9.3 | 7.0.2 与当前 vue-tsc 加载入口不兼容 |
| Node 类型 | 24.19.2 | 对齐 Electron 45 嵌入的 Node 24；开发 CLI 仍为 Node 22 |
| Vue 生态 | Vue 3.5.44、Pinia 4.1、Router 5.4、VueUse 15、virtual-scroller 3.0.5 | 类型、现有组件测试与长列表实际操作验证 |
| 模型 SDK / 工具 | OpenAI 7.42、Vitest 5.0.5 等 | 原有本地 HTTP/SSE 回归覆盖 SDK；未发送真实模型请求 |

完整包版本以本提交 package.json / lockfile 为准。直接声明 @electron/asar 3.4.1 供产物测试使用，版本原已存在于打包链。lucide-vue-next 1.0.0 被上游弃用，迁移另见 Issue #21。

## 当前验证

- npm ci 干净安装成功，无 --force / --legacy-peer-deps；dependency-tree.txt 无无效 peer。
- npm run check：54 通过、1 个真实模型测试按默认策略跳过；生成的 auto-imports 声明保留原跟踪版本后重新验证。
- npm run build 与 npm run make 成功；make 的主进程、preload、renderer 和 macOS arm64 ZIP 均生成。
- 桌面隔离临时 profile，两个各 80 条的虚构本地对话：主窗口加载、preload 与主题 IPC、Markdown、顶部/末尾滚动、切换对话及新对话路由通过。未使用真实账号、Key、聊天数据或云端请求。
- 实测发现 Forge 7.11 不再复制 loading.html：修复与真实红绿证据独立保存在 preserve-desktop-loading-asset change，三平台 make 后检查实际 app.asar。
- 首次测试要求切换等长历史自动到底而失败；旧 Electron 37 / Router 4 / virtual-scroller 2 产物同样失败，MessageList 源码无变化。最终烟测验证显式滚动末尾，不把自动到底写为已通过；预期行为与修复见 [Issue #22](https://github.com/xiersiki/xier/issues/22)。

## 剩余风险与验收边界

应用 npm audit 的依赖条目由基线 60（4 critical、50 high、5 moderate、1 low）降至 32（1 critical、26 high、2 moderate、3 low）；生产依赖 npm audit --omit=dev 为 0。条目数不是独立漏洞数，也不是完整安全证明。剩余 critical 为开发打包链 tar，修复涉及 Forge 8 迁移；[Issue #21](https://github.com/xiersiki/xier/issues/21) 优先跟进。

本机 GUI 为 macOS arm64；Windows/Linux 仅按 GitHub make 与产物检查结果声明，不声称安装/GUI 已验收。真实供应商、真实登录同步、代码签名和公证、新 Release 均未执行。最终 PR/主分支 CI 与 Pages 交付事实见 [Issue #20](https://github.com/xiersiki/xier/issues/20)。

需要回退时以正常 PR 恢复依赖/lock/config，重新通过保护门禁，不直接改 main。
