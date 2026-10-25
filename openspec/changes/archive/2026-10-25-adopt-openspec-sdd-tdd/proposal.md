# Proposal

## Why

用户要求 Xier 按 OpenSpec 的 SDD 和 TDD 红绿重构开发，并在 GitHub 上落实。现有 CI 检查实现，但不能检查本次交付是否有规格、完成的任务与测试过程记录。

Issue: https://github.com/xiersiki/xier/issues/18
知识入口: https://pcn11w88fq9h.feishu.cn/wiki/KwbAwXJZ4it8f0kZOHgc56n9nxb

## What Changes

- 项目锁定 OpenSpec 1.15.0，提交 Codex skills、项目上下文与流程规则。
- 增加公开 CLI 门禁，将本次 diff 与 OpenSpec 变更、完成任务和 TDD 证据对应。
- 将规格检查纳入 GitHub required，更新 Issue/PR/交接模板、AGENTS、官网和飞书说明。
- 纯文档不强制 TDD；配置和依赖更新记录适用验证；行为代码必须红绿重构。
- 不更改产品行为、生产服务、签名发布或账号通知偏好。

## Capabilities

### New Capabilities
- `delivery-workflow`: 可复现的规格、测试证据与 GitHub 交付门禁。

### Modified Capabilities
无。当前仓库尚未有 OpenSpec 主规格；本次不倒填产品全部历史需求。

## Impact

package/lock、.agents、openspec、scripts、tests、GitHub CI/模板、开发文档、site、飞书知识库。依赖更新 PR 也需按文件类型满足同样规则，不使用 actor 豁免。
