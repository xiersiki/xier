# 内容协作：固定响应编辑切片

2026-10-26，Issue #23 / Draft PR #25，分支 `codex/phase1-content-design`。已实现固定响应的选择、审阅、接受/拒绝/复制及撤销。真实 OpenCode 接入、组件库发布、持久化和正式 Web host 尚未实现。

## 如何体验

桌面开发启动后点击侧栏「内容工作台」。离线浏览器预览：

```sh
npm ci
npm exec vite -- --config vite.renderer.config.ts --host 127.0.0.1 --port 5189 --strictPort
# 打开 http://127.0.0.1:5189/html/content-preview.html
```

点击「载入示例」→「全选」→「生成改写建议」→ 审阅删除线/下划线差异 → 接受或拒绝。复制不会修改正文。接受之后手动输入，再按两次 ⌘Z / Ctrl+Z，依次撤销手工输入和整次接受。也可以导入 UTF-8 `.md` / `.txt` 副本；源文件只读，导出下载新文件。

固定结果与输入和要求无关，仅验证交互；页面已明确标注。草稿只在当前组件生命周期内保留，切换回聊天、关闭窗口、刷新或切换账号都会丢失内存草稿，请先导出。没有自动保存、云同步或恢复承诺。浏览器入口只是开发 fixture，不是正式 Web 产品。

## 模块与数据流

- `common/content/contracts.ts`：AgentPort、FilePort、三类组件 props/emits 的 v1 基线；无运行时框架依赖。
- `renderer/features/content/controller.ts`：CodeMirror EditorState 单一正文源、单调 revision、请求绑定、建议处置及运行状态；只在显式接受时替换提交时的区间。
- `composables/useContentEditor.ts`：将控制器订阅投影到 Vue；编辑器扩展与生命周期。EditorView 使用局部普通变量，不进入 Vue 深响应式。
- `components/`：CodeMirror 包装及三个纯展示组件。它们尚未来自 xier-element；后续迁入 `@xier-element/ai-ui`，先保留这里的契约与组件黑盒测试。
- `renderer/platform/content/fixture-agent.ts`：650ms 固定响应、幂等 ID、工作区单任务与取消。
- `renderer/platform/content/browser-files.ts`：可由浏览器和 Electron renderer 共用的 FilePort。UI 使用标准文件 input，导出/复制经接口注入。

正文最多 20,000 Unicode 码点，选区最多 4,000 码点；CodeMirror 位置仍为 UTF-16 offset，不能混用。空选区和切断 surrogate pair 的选区不能提交。任何正文变化（含 undo）增加 revision，使旧建议永久过期；仅移动光标不会改变 revision。接受是一个 `isolateHistory.of('full')` transaction；同步设为 applied 防止重复接受。当前无异步 applying 阶段。

## AgentPort v1：接入方必须遵守

`start(request)` 返回确认快照，可以是 running 或已完成；不要求等完整生成。`observe(id, listener)` 在 start 前注册，退订只停止观察。`cancel(id)` 必须发服务端取消并返回真实快照；如果完成先发生，返回 completed。`get(id)` 只核实，不重发任务。四个方法的类型见源码。

请求只包含 requestId、scopeId、draftId、selectedText、requirement；正文、选区 offset、revision 留在前端。scopeId 用于关联，不能替代服务端鉴权。相同 ID 相同输入幂等，相同 ID 不同输入拒绝；工作区同时只允许一个未结束任务。

每个请求的 snapshot.sequence 单调递增；相同快照保持相同序号，状态/结果有变化才增加。controller 忽略旧序号、重复、错误 requestId 和终态后的事件。订阅应在后续事件到达时回调；即使实现选择同步回放，前端也会处理完成快照并释放订阅。

网络异常是 unknown，不是 cancelled/failed；用户核实后才能继续。适配器需把 EOF/断线和服务器状态变化转换成有新序号的 unknown 快照，不能只调用浏览器 AbortController。get 查不到映射时返回 unknown，不能重启旧任务。取消确认前不会显示已停止；卸载时退订并尽力请求取消，但不承诺服务已停止。

完成结果必须有非空 replacement，explanation 可选且必须为字符串；替换后正文不能超限。前端二次校验，非法结果不产生可接受建议。适配层也必须进行结构化校验。任务完成与可应用是独立状态：迟到结果回到原草稿，正文 revision 变化则标记 stale。

## AG-UI 的位置

AG-UI 留在适配层：OpenCode → gateway → AG-UI 事件 → AgentPort RunSnapshot → controller/Vue。RUN_STARTED 对应 running；STATE_SNAPSHOT 携带经过校验的结果和状态；RUN_FINISHED 必须与有效结果一起才能确认 completed；RUN_ERROR 对应明确失败。断流不能推断成功。GET 与服务端取消补足事件流之外的控制操作。

编辑器和三个展示组件不导入 AG-UI runtime，也不依赖 OpenCode SDK。未来 Web HttpAgent 和桌面 IPC 适配器实现同一契约测试，不让 UI 直接消费 OpenCode session/message 结构。

## 组件迁移边界

| 组件 | 输入 | 事件 |
| --- | --- | --- |
| ContextSelection | selectedText、count、limit、disabledReason | submit(requirement)、cancel |
| RewriteSuggestion | before、after、explanation、status、canAccept | accept、reject、copy |
| GenerationStatus | status、errorMessage、canCancel | cancel、retry、refresh |

控件使用原生键盘行为；diff 采用纯文本转义和删/增文字、删除线/下划线，不只靠颜色。diff 当前使用 `@codemirror/merge`，设置 30ms / scanLimit 2000 预算；迁入组件库时核验依赖、包体积与 CSS token，不直接把它接入组件库根入口。跨端共享的是契约和状态逻辑，RN 不能直接渲染这些 Vue 组件。

## 验证与下一步

自动化与人工证据见 [本轮验证](../../openspec/changes/add-content-collaboration/evidence/editor-verification.md)。完整任务仍在 [OpenSpec tasks](../../openspec/changes/add-content-collaboration/tasks.md)，这里不维护第二份推进清单。

OpenCode 接入会话只负责适配器、gateway 与相关契约测试。当前会话保持前端、common 接口和组件所有权；接口变更先记录提议，不在两个分支各自改接口。独立分支以本切片提交为基线，集成前检查实际 diff、重复依赖和取消/unknown 场景。
