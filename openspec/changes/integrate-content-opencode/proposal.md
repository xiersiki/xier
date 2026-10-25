# Proposal

## Why

固定响应编辑切片已有 AgentPort v1，缺少可接真实服务的实现。本切片落实父变更 add-content-collaboration 的 content-agent-connection 规格，不改变编辑器和组件 API。

关联 [Issue #23](https://github.com/xiersiki/xier/issues/23)、[父 PR #25](https://github.com/xiersiki/xier/pull/25)、[飞书方案](https://pcn11w88fq9h.feishu.cn/wiki/YNVXwcj0Vij6hhk2u57csEGXnMf)。实施授权来自 2026-10-26 主会话交接，Issue 原始正文仍为历史设计范围。

## What Changes

- 增加官方 SDK gateway、AG-UI HTTP handler 与 AgentPort 适配器。
- 增加受限服务启动入口与固定版本检查，不自研 Agent 内核。
- 逐场景离线契约测试覆盖幂等、单并发、结构化结果、unknown/恢复、取消竞态与迟到事件。
- 提供主会话接线说明。IPC、配置 UI、正式 Web host、持久化及产品 UI 验收不属于本切片。

## Capabilities

### New Capabilities
- `content-opencode-transport`: 在父规格约束下，管理进程内请求登记、受控服务和 AG-UI 传输的可观察行为。

### Modified Capabilities
无。父 change 与 common/content/contracts.ts 保持原所有权；本规格引用父规格，不重复归档父能力。

## Impact

新增 services/content-gateway、main/content、renderer/platform/content/opencode-*、tests/content-opencode* 与 docs/content/opencode-*。精确固定 SDK 1.19.4 和 AG-UI 1.0.3；CLI 为 host 提供的外置 1.19.4，不自动下载/升级或分发。凭据仅在可信 Node host；HTTP 鉴权与用户归属由 host 决定。
