# 固定响应编辑切片验证

2026-10-25～26，macOS arm64 / Node 22.23.1，分支 `codex/phase1-content-design`，Issue #23 / Draft PR #25。第 1 组任务已完成；不代表一期整体或真实 OpenCode 接入完成。

## 结果

| 检查 | 结果与证据 |
| --- | --- |
| 类型与全量离线回归 | `npm run check`：79 passed、1 skipped（真实模型 opt-in）；见 check-final.txt |
| 新增公开边界测试 | controller 18、fixture AgentPort 2、展示组件 3、工作区 2，共 25 项；含原有回归共 79 |
| Renderer 构建 | `npm run build` 成功；见 build.txt。仍有原项目 chunk >500kB 提示，未借本次做全量拆包 |
| 桌面打包 | `npm run package` 成功生成 darwin arm64 产物；见 package.txt。未启动安装包，不等于安装验收 |
| OpenSpec | 严格校验通过；见 spec-validate-editor.txt。任务仅 4/20 完成，spec:gate 预期失败，保持 Draft |
| Chrome 实测 | 独立 fixture 页验证固定结果审阅、拒绝/复制不改正文、显式接受、手工追加、两次 ⌘Z 顺序恢复；删除线/下划线与状态按钮可见 |

Chrome 地址为 `http://127.0.0.1:5189/html/content-preview.html`；该入口不加载原 AppInitializer、不使用真实账号或聊天记录。截图保存在本地文档工作区 `docs/technical/phase-1-content/verification/editor-review-20261026.jpg`。人工检查并非 PRD 的完整双端 20 场景验收。

## 红绿记录说明

`tdd.json` 记录逐场景实际 RED/GREEN。editor-01～13、fixture-01～02、ui-01～03、workspace-01 均先运行失败，再实现对应行为。日志是当时真实输出，未重造失败；仅清理文件末尾多余空行以通过 diff --check。

editor-12 的首次 GREEN 尝试因测试 helper 漏调用 `immediatePort()` 失败，原输出保存在 editor-12-attempt.txt；修正 helper 后重跑通过。最初 RED 是正文超限 20,001 而非 20,000 的行为断言。

前期小步骤没有逐步独立的重构提交；局部实现进入下一场景，随后统一整理控制器、FilePort 和 Vue 投影。refactor-core.txt、refactor-ui.txt 和 check-final.txt 是实际汇总验证时间点；tdd.json 复用最终回归作为重构证据，不声称每个历史 GREEN 后都另跑了一次该命令。FilePort 提取后的补充测试见 file-port-verification.txt。

## 覆盖与限制

覆盖 UTF-8/换行/中文 emoji、20k/4k 限制、半个 surrogate 选区、只发送选区、非法模型结果、接受去重、撤销隔离、编辑后再撤销仍 stale、草稿切换和迟到结果、乱序事件、unknown/核实、取消、退订与卸载、props/emits、HTML 转义、导入源数据不变及复制失败提示。

三类展示组件现在位于 Xier，未发布到 xier-element；无持久化、正式 Web host、真实模型 UI 闭环、安装启动、跨平台、性能 p95 或账号恢复验收。固定响应不会调用网络或模型。后续接入会话需实现 AG-UI 与 OpenCode 适配、服务端锁与验证，不能把这里的客户端检查当成服务端安全边界。
