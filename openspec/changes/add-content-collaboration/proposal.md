# Proposal

## Why

Xier 当前围绕聊天展示，修改文本需要在编辑器与聊天窗口之间复制粘贴。第一期建立“选区 → 建议 → 差异审阅 → 接受/拒绝 → 撤销”的内容协作闭环，将学习投入集中在 Vue、编辑器状态、跨桌面/Web 复用及 Agent 交互协议。

依据：[Issue #23](https://github.com/xiersiki/xier/issues/23)、[一期 PRD](https://pcn11w88fq9h.feishu.cn/wiki/Jf43wDrZ7iT6PbkvjvucOHIanIb)、[开源依赖边界](https://pcn11w88fq9h.feishu.cn/wiki/WN35wSU2nilCIFk30qxcFEXgneg)。本 change 交付设计和隔离接入实验，尚未实施产品功能；不把实验通过当作 PRD 验收。

## What Changes

- 新增内容协作入口与本地草稿，支持 UTF-8 TXT/Markdown 副本导入、源码编辑、自动保存及导出。
- 选择连续文本后，调用现成 OpenCode 服务生成单次改写建议；前端负责状态、审阅和用户确认应用。
- 在受控接入层转换 OpenCode 事件到有限 AG-UI 事件集合，明确服务端取消、断线和未知终态。
- 桌面与本地浏览器入口共用 Vue 功能模块，通过平台接口隔离 Electron IPC、文件选择、配置与运行状态。
- 在独立 xier-element 仓库新增上下文选择、建议差异、生成状态三类组件；保持既有公共 API。
- 原有对话、认证、本地聊天与云同步保持兼容；新草稿不加入现有同步链路。

不包含：Agent 内核、工具调度、RAG、长期记忆、多 Agent、自动写文件、RN 实现、富文本/Word、云端 SaaS、实时跨设备同步或部分 diff hunk 应用。OpenCode 出现需 fork 内核才能完成的阻碍时重新评估依赖，不把修内核扩成一期目标。

## Capabilities

### New Capabilities

- `content-collaboration`: 草稿、选区改写、审阅/接受/拒绝/撤销、版本冲突和本地恢复。
- `content-agent-connection`: 独立请求上下文、受限 OpenCode 接入、事件转换、取消与断线核实。

### Modified Capabilities

无。`delivery-workflow` 和 `desktop-startup` 继续适用，不修改其要求。

## Impact

拟涉及 Xier `renderer/features/content/`、新 Web 入口、`common/content/`、`main/content/`、受控 preload API 与本地浏览器配套服务；具体目录见 design。这些都是拟新增路径，不是当前实现。

新增依赖拟为 CodeMirror 6、OpenCode SDK、AG-UI 类型/编码/客户端及一个最小 runtime schema 校验库；锁版本并经过消费端验证后引入。继续用 Vue、Pinia、Dexie、Vite。OpenCode 先外置安装与连接，桌面自动随包分发另作验证；组件包在原 pnpm workspace 发布，不将 Xier npm 工程强制改为 monorepo。

本次产品开发、组件发布、安装包支持、性能及双端验收均仍待执行。所有任务保持未完成，不归档规格、不伪造 TDD 证据。
