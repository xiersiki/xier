# OpenCode 接入切片与主会话接线

接入模块已实现，当前产品页面仍使用固定响应。此分支提供可独立评审的 OpenCode gateway、AG-UI HTTP handler、AgentPort 客户端和隔离 CLI 生命周期；不包含 IPC 注册、正式 Web host、持久化或真实 UI 验收。

适用：2026-10-26，`codex/content-opencode-port`，基线 `8b37a36`，关联 [Issue #23](https://github.com/xiersiki/xier/issues/23) 与父 [PR #25](https://github.com/xiersiki/xier/pull/25)。本切片 change 为 [integrate-content-opencode](../../openspec/changes/integrate-content-opencode/)。父任务仍由主会话维护，不能据此把一期标记完成。

## 已提供的边界

| 模块 | 公开入口 | 用途 |
| --- | --- | --- |
| `services/content-gateway/gateway.ts` | `new OpenCodeGateway(options)` | Node 端 AgentPort；官方 SDK、进程内请求登记和工作区单并发 |
| `services/content-gateway/http.ts` | `createContentGatewayHandler(gateway, authorize)` | 可交给 Node createServer 的 `/runs` handler；鉴权由 host 回调决定 |
| `renderer/platform/content/opencode-agent.ts` | `new OpenCodeAgentPort(options)` | 官方 HttpAgent 适配器；只输出 AgentPort v1 快照 |
| `main/content/opencode-runtime.ts` | `startContentRuntime(options)` → `{gateway, stop}` | 启动/关闭 host 拥有的外置 CLI，隔离配置与 profile |
| `services/content-gateway/protocol.ts` | 纯校验函数 | 无 Node/SDK 运行依赖；可被浏览器适配器引用 |

没有修改 `common/content/contracts.ts`、编辑器、Vue 展示组件、聊天、账号、数据库或 preload。依赖精确固定 `@opencode-ai/sdk@1.19.4`、`@ag-ui/client/core/encoder@1.0.3`。CLI 外置，必须为 1.19.4，不自动安装、升级或随应用分发。SDK 使用 `v2/client`，不调用 SDK 自带的启动器。

## 主会话需要实施的操作

1. 集成本分支后运行 `npm ci`。保持 `ContentWorkspace` 的 AgentPort 注入方式，无需改编辑器或三类组件契约。
2. 在可信 Node host 中取得已授权 DeepSeek 配置，仅将 `baseURL` 与 `apiKey` 传给 runtime。此切片不会自行读取 Xier 配置或真实聊天。CLI 路径、profileRoot、provider 不能来自未校验的 renderer 参数。
3. 每个工作区只创建一个 runtime。`profileRoot` 使用本应用专用私有目录。多个窗口/标签共享同一 gateway；独立 host 必须独立 profile。`stop()` 幂等，只清理本次创建的进程、子目录和锁。
4. Electron 由主会话新增受控 IPC/preload。建议通道：`content-agent:start/get/cancel` 和 `content-agent:snapshot`；这是接线提议，尚未注册。先订阅再 start；校验 sender、账号与请求归属；退订只清理监听，取消调用 `gateway.cancel`。对确定的 WORKSPACE_BUSY/REQUEST_CONFLICT 转换成明确拒绝，网络/IPC 不确定失败转 unknown。不能把 SDK、服务密码或模型 key 发给 renderer。
5. Web host 将 handler 挂到同源 `/runs`，绑定 loopback。必须实现 `authorize(req, context)`：核验可信身份、Host/Origin/CSRF，并校验 start 的 scope 及 get/cancel 的请求归属。单 handler 对应一个已授权工作区；scopeId 本身不是身份凭据。没有默认 CORS 或默认放行实现。
6. Web 注入 `new OpenCodeAgentPort({url: '/runs'})`；如 host 需要会话头，通过 headers 传 host 会话凭据，不能传模型 key。IPC 适配器由主会话实现同一 AgentPort，再跑相同公开契约场景。
7. 切换账号/退出窗口时，先按 host 的请求归属策略取消、退订，再关闭自己拥有的 runtime。未确认取消仍显示 unknown。整个服务关闭不代表远端服务商已经停止计费。

Node host 的最小组合（配置与授权函数由主会话提供）：

```ts
import { createServer } from 'node:http';
import { startContentRuntime } from '../../main/content/opencode-runtime';
import { createContentGatewayHandler } from '../../services/content-gateway/http';

const runtime = await startContentRuntime({
  executable: trustedAbsoluteOpenCodePath,
  profileRoot: privateContentProfileRoot,
  provider: authorizedDeepSeekSettings, // { baseURL, apiKey }; 只留在 Node
});
const server = createServer(createContentGatewayHandler(runtime.gateway, authorizeWorkspaceRequest));
// host 绑定 127.0.0.1 并负责会话、Origin、关闭 server 和 await runtime.stop()
```

代码示例中的三个配置变量与 `authorizeWorkspaceRequest` 是集成依赖，不是本切片已实现的认证/配置接口。`executableArgs` 只供可信 host 的 CLI 包装器使用，离线测试用它启动 Node 假 CLI。

## HTTP 与状态语义

| 操作 | 请求 | 行为 |
| --- | --- | --- |
| start | `POST /runs`，标准 RunAgentInput，`forwardedProps: {request}` | runId=requestId，threadId=scopeId；禁止携带历史 messages、tools、context 或非空 state |
| get | `GET /runs/:requestId` | 只核实原 session，不创建任务 |
| cancel | `POST /runs/:requestId/cancel` | 调用 OpenCode abort，再核实状态和最新记录 |
| observe | start 的 SSE；必要时只读查询 | RUN_STARTED → STATE_SNAPSHOT → RUN_FINISHED / RUN_ERROR；没有伪造正文增量 |

传输输入有明确边界：requestId/scopeId/draftId 为 1–128 位 ASCII 字母、数字、`_`、`-`；选区与要求各最多 4,000 Unicode 码点，选区不能全为空白；HTTP body 最多 64 KiB。替换最多 20,000 码点、非空白，explanation 如存在必须为字符串。主会话若需要其他 ID 编码或更长要求，应先协商传输边界，不默默修改共享类型。前端仍须检查替换后整篇正文的 20k 限制、revision 和归属。

相同 ID 相同字段幂等；不同字段拒绝；running 和 unknown 都占用工作区单并发。结果、错误、状态变化才增加序号；重复快照不变，终态不再回退。快照冻结，单个 listener 异常不会影响执行或其他监听者。

客户端独立维护服务序号和本地序号。completed 必须有合法候选以及匹配的 RUN_FINISHED；提前 EOF/超时/解析异常进入 unknown。显式 get 恢复 running 后，若原 SSE 已结束且仍有观察者，使用默认 1 秒只读轮询继续观察；终态、再次 unknown 或最后一个观察者退订后停止。不会重发生成 POST。生成流默认 120 秒超时，查询/取消默认 10 秒；`timeoutMs` 可供 host 配置。

取消只有在 abort 确认、session 非活动、最新同 session 的 MessageAbortedError 三者同时成立时确认。查询先读状态再读记录，以完整结果优先处理完成竞态。空历史或只有 user 消息时仍 unknown，不把“已发取消”说成“已停止”。旧查询、重复事件和终态后的迟到结果不会覆盖新状态。

## 配置与恢复边界

runtime 为每次运行创建独立 HOME/USERPROFILE、XDG、临时目录和空工作目录；不继承现有 OPENAI/ANTHROPIC 等 provider 环境变量或 OPENCODE 配置。禁用项目、Claude、外部 skills、默认插件、自动更新和模型列表拉取；全局与 content agent 均为 `*: deny`、`StructuredOutput: allow`。固定 DeepSeek Flash 非思考组合，不自动换模型或放宽权限。这是应用权限限制，不是 OS 沙箱。

profile 使用原子目录锁。崩溃可能留下锁，后续 host 明确返回 CONTENT_PROFILE_BUSY；不自动猜测锁已过期。维护者确认旧进程退出后才能清理专用目录。持有锁的 host 正常 stop/失败启动会清理自己的目录。CLI 输出被丢弃，前端仅收到固定错误码/信息。

映射仅存在于 gateway 内存，服务重启后原请求返回 `{status:'unknown', sequence:0}`。客户端接受这一缺映射事实，不拿旧序号遮蔽它，也不重发。unknown 无法核实的旧 runtime 需要 host 的显式关闭/重建流程；本切片没有“强制忘记运行”按钮或持久化恢复保证。

只读恢复使用 `session.status` 和 `session.messages({limit:1})`，不依赖 1.19.4 已知出错的完整历史接口。协议不暴露 session/message ID，编辑器只接触 requestId 与 RunSnapshot。

## 验证与待办

当前证据、命令和失败探索见 [verification.md](../../openspec/changes/integrate-content-opencode/evidence/verification.md)；逐场景记录在 [tdd.json](../../openspec/changes/integrate-content-opencode/tdd.json)。历史真实 DeepSeek 探针只作兼容背景，本轮没有读取真实配置或调用真实模型。

仍需主会话完成：IPC 和账号归属、正式 Web host 的认证/Origin、产品注入、真实工具隔离/模型取消和 UI 验收、持久化及全平台安装验证。独立评审与主会话接线验收前保持 Draft；本切片未归档，父 change 未改动。

飞书 04.2、07、05.2 由主会话同步。本会话没有并发修改；待同步摘要见 [opencode-handoff.md](./opencode-handoff.md)。
