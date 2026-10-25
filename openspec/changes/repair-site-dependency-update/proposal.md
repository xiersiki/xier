# Proposal

## Why

Dependabot 将 TypeScript 升至 7.0.2 后，vue-tsc 3.3.13 在加载 typescript/lib/tsc 时失败。Node 类型也跨到26，与项目Node22不一致。

关联 [Issue #20](https://github.com/xiersiki/xier/issues/20)、[PR #16](https://github.com/xiersiki/xier/pull/16)、[研发流程](https://pcn11w88fq9h.feishu.cn/wiki/KwbAwXJZ4it8f0kZOHgc56n9nxb)。

## What Changes

保留 Vue 3.5.44 更新；TypeScript 改为兼容的5.9.3，Node类型对齐22最新补丁，重新生成lockfile并验证官网。

## Capabilities

### New Capabilities
无。

### Modified Capabilities
无。保持 delivery-workflow 行为契约；纯依赖/配置维护采用 skip_specs 与 verification-only，不编造红绿记录。

## Impact

仅 site/package.json、site/package-lock.json 和 OpenSpec 资料；不修改站点内容、路由或认证回调。

不发布新的桌面Release、不改账号通知设置、不调用真实模型或生产数据库。原始Dependabot升级早于本补充方案，本记录不声称机器人遵循了SDD先行。
