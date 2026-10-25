# OpenCode 接入交接与待同步摘要

接入切片已落在独立分支，供主会话评审与接线。产品页面尚未切换真实服务；不能把本轮离线契约/CLI 健康检查写成产品 UI 或真实模型验收。

## 代码归属与接续

- 工作区：`/Users/gongchenyu/code/xier-worktrees/content-opencode-port`。
- 分支：`codex/content-opencode-port`；基线 `8b37a36`；SDD 先行提交 `5bfe218`。
- 本切片 [Draft PR #27](https://github.com/xiersiki/xier/pull/27)，实现提交 `2181b930ad5541e94769ea4d136f553254ce26e7`；PR 保持 Draft，未合并。
- 依赖父 PR：[内容协作固定响应闭环 #25](https://github.com/xiersiki/xier/pull/25)，关联 [Issue #23](https://github.com/xiersiki/xier/issues/23)。
- 详细模块、HTTP 契约和逐步操作：[接线说明](./opencode-integration.md)。
- 验证与探索失败：[本轮证据](../../openspec/changes/integrate-content-opencode/evidence/verification.md)。

main/preload/账号/UI 原有文件没有接线修改，`common/content/contracts.ts` 保持 v1。不要求改共享接口。主会话需要：注入受控 provider 与 CLI 路径、创建工作区 runtime、实现账号/sender/Origin 授权、注册 IPC 或挂载 HTTP handler，再替换 fixture 注入。具体通道建议和示例见接线说明。

注意传输约束：当前 ID 限 ASCII 字母数字及 `_`/`-`，长度 1–128；要求最多 4,000 码点。主会话如使用带冒号的账号 scope 或更长要求，需要先协调这些边界，不能直接假定所有任意字符串都已支持。

## 飞书待同步

按交接约定，04.2、07、05.2 由主会话统一维护。本会话未修改这些页面，避免覆盖并发更新。可使用下列摘要并链接本分支 PR/证据：

| 页面 | 建议同步内容 |
| --- | --- |
| 04.2 内容协作技术方案 | 增加已实现的 gateway/AG-UI 传输与外置 CLI 生命周期；注明仍未接入产品 UI。固定 SDK/CLI 1.19.4、AG-UI 1.0.3，不自研 Agent 内核。 |
| 07 决策与交接 | 独立分支/PR、主会话接线依赖、已知 unknown/进程内映射限制，以及取消必须核实中止记录的规则。 |
| 05.2 SDD/TDD | 引用 integrate-content-opencode 的独立规格、真实 RED/GREEN 日志、最终检查和 Draft 门禁结果；保留父 change 4/20 状态。 |

这次没有读取真实 Xier 配置或聊天，也没有付费模型调用。真实 CLI 冒烟只证明当前 macOS arm64 上配置可启动、携带鉴权 health 成功、进程可停止与 profile 清理；权限工具暴露、真实取消/计费与完整 UI 的验收尚未执行。

## 本轮检查

新增 41 项离线测试；全库 `npm run check` 为 120 passed / 1 live skipped，类型检查成功。renderer build、darwin arm64 package、独立浏览器 bundle 与真实 CLI 无模型健康冒烟通过。OpenSpec 严格校验通过；main/切片范围门禁分别因父任务与本切片 3.3 未完成失败，保持 Draft。

## 评审与未完成项

本 change 保留 3.3：独立评审、主会话接线验收、规格同步与归档。当前不合并。父 3.x 任务包含 UI/IPC/真实工具验证，不能仅按本切片测试通过就全部勾选。

映射在内存中，profile 生命周期结束会删除本次 OpenCode session 数据。需要持久化、跨进程恢复、强制清理旧锁、自动安装 CLI 或正式 Web 发布时，应在主会话的后续规格内处理。
