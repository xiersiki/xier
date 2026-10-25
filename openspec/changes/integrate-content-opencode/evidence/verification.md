# OpenCode 接入切片验证

2026-10-26，macOS arm64 / Node 22.23.1 / npm 10.9.8。本轮验证新增传输模块，没有切换产品 UI、读取真实配置/聊天或调用真实模型。

## 公开边界与测试方式

SDK gateway 测试使用真实 `@opencode-ai/sdk@1.19.4` 序列化/反序列化，在 HTTP fetch 系统边界提供确定性 OpenCode 响应；没有 mock 自己的 gateway。AG-UI 测试用真实 loopback Node server、EventEncoder 与官方 HttpAgent 1.0.3。生命周期测试启动外部 Node 假 CLI，观察其收到的隔离配置事实，不输出密钥。

覆盖：独立 session、结构化结果及请求校验、固定版本、幂等/工作区单并发、断线/超时、unknown 占位、limit:1 恢复、缺映射、真实服务端 abort 路径、取消/完成竞态、迟到查询与事件、非法/重复快照、RUN_FINISHED outcome、跨客户端冲突、host 授权、只读恢复观察、退订、profile 锁与启动清理。

## 当前检查

| 检查 | 结果与范围 | 证据 |
| --- | --- | --- |
| 增量 RED/GREEN | 35 个纵向周期，41 项新增离线测试 | [tdd.json](../tdd.json)、逐周期 txt |
| renderer build | 通过；保留既有大 chunk 提示，页面仍为 fixture | [build.txt](./build.txt) |
| Electron package | 通过 darwin arm64 打包；未启动安装产物 | [package.txt](./package.txt) |
| 独立浏览器适配器 bundle | 通过；单独构建新增模块，不借未接线的应用构建证明它可打包 | [browser-bundle-final.txt](./browser-bundle-final.txt) |
| 真实 OpenCode 1.19.4 健康冒烟 | 隔离 HOME/XDG、带鉴权 health、stop/profile 清理通过；0 次生成 | [runtime-health.txt](./runtime-health.txt) |

最终 `npm run check` 通过：typecheck 成功，120 passed / 1 live skipped，见 [check-final-fixed.txt](./check-final-fixed.txt)。浏览器独立 bundle 为 488,640 bytes minified / 100,105 bytes gzip；metafile 无 OpenCode SDK、Node main 或 gateway 入口，见 [browser-imports.json](./browser-imports.json)。这是独立入口体积，不是产品增量体积或 UI 性能验收。探索中的失败保留，不用后来的成功覆盖。

规格严格校验通过，见 [spec-validate.txt](./spec-validate.txt)。`spec:gate -- --base origin/main` 因父 change 未完成失败；以 `origin/codex/phase1-content-design` 为 base 的门禁因本 change 3.3 未完成失败，分别见 [main 门禁](./spec-gate-main.txt) 与 [切片门禁](./spec-gate-slice.txt)。本切片任务 7/8，父任务仍为 4/20；没有绕过失败门禁，保持 Draft。

## RED/GREEN 的历史边界

SDD proposal/specs/design/tasks 在实现前提交为 `5bfe218`。每次先运行缺失行为测试，再最小实现并复跑。`tdd.json` 引用实际失败与成功日志，不把父实验或健康冒烟当 RED。

- 03-red 首次匹配错误地假定 directory 位于 query string；改成 SDK 实际路径后 03-red-corrected 确认真正的重复提交失败。03-green 第一次遇到异步请求体读取，改为等待外部请求可见后 03-green-fixed 通过。原输出均保留。
- 18-green 首次从 AG-UI 根入口引用 schema 失败；查验 1.0.3 exports 后改用 `@ag-ui/core/schemas`，18-green-fixed 通过。
- 02-red 中超长测试输入曾被测试名称展开，原日志保留；后续用场景序号命名，避免输出长正文。
- `refactor-final.txt` 是第 30 周期后的成功检查（115 passed / 1 live skipped），不是最后提交结果。其后新增传输恢复等场景。
- `check-final.txt` 捕获第 33 周期编辑时误入事件回调的 query 分支类型错误；已修正后再次完整检查。失败证据没有改写。
- 日志只移除文件末尾多余空白行，命令、退出码和输出正文保留。各周期没有单独重构时，refactor 字段明确引用同次 GREEN，不伪称额外执行。共享整理包括 SDK client 子入口、快照校验/冻结、错误信息与超时选项，之后运行全量检查。

## 本地 CLI 冒烟与官方接口核验

SDK 与 CLI 固定 1.19.4；AG-UI client/core/encoder 固定 1.0.3。本机临时工具安装在本任务 work/runtime-tools，不是生产依赖；启动器必须由可信 host 提供 CLI 路径，代码中没有该路径或 OPENCODE_TEST_HOME。使用合成占位 key，仅启动服务并读 health，不发 prompt。

测试前浏览 [OpenCode SDK 官方文档](https://opencode.ai/docs/sdk/) 与 [AG-UI events](https://docs.ag-ui.com/concepts/events)，具体调用以安装的固定版本类型和 exports 为准。SDK HTTP 错误状态位于 Error.cause.status；AG-UI schema 使用 /schemas 子入口。最初直接打包 SDK v2 总入口产生 cross-spawn 的 ESM dynamic require 问题，改用官方 v2/client 子入口后健康冒烟通过。这是本轮工具打包探索，不是模型运行失败。

可重现健康检查：用项目 esbuild 将 `main/content/opencode-runtime.ts` 打包为 Node ESM；在隔离临时 npm 工程安装 `opencode-ai@1.19.4`；调用 startContentRuntime，提供其绝对 CLI 路径、专用 profileRoot 和合成 provider key；不调用 gateway.start；最后 await stop 并检查 profile 为空。父 probe-source.md 是历史模型实验，本次生产模块不依赖它或其临时目录。

## 限制与待验收

没有进行真实模型生成/权限工具暴露/服务商计费取消测试、IPC 注册、账号/Origin 产品接线、正式 Web 启动、组件 UI、持久化、macOS 安装产物启动或 Windows/Linux 验收。配置隔离测试与健康检查不替代这些验收。

本 change 3.3 仍未完成，保持 Draft。父 change 的 16 项剩余任务不属于本分支已完成项。知识库由主会话统一同步，待同步摘要见 [交接](../../../../docs/content/opencode-handoff.md)。
