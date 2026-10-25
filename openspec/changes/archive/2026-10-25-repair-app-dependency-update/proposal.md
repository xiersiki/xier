# Proposal

## Why

40项依赖升级组合使类型检查在TypeScript7入口失败，三平台Forge构建又出现electron-winstaller缺少semver。

关联 [Issue #20](https://github.com/xiersiki/xier/issues/20)、[PR #17](https://github.com/xiersiki/xier/pull/17)、[研发流程](https://pcn11w88fq9h.feishu.cn/wiki/KwbAwXJZ4it8f0kZOHgc56n9nxb)。

## What Changes

修复依赖组合与安装图，验证现有行为与三平台构建；TypeScript使用兼容5.9.3。其余升级以兼容检查结果决定，无法保持现有行为的版本保留原稳定线并明确记录原因。

## Capabilities

### New Capabilities
无。

### Modified Capabilities
无。保持 delivery-workflow 行为契约；纯依赖/配置维护采用 skip_specs 与 verification-only，不编造红绿记录。

## Impact

仅根package/lock及OpenSpec资料；不借升级改变产品行为。若必须修改行为代码，先转为带specs和TDD的独立变更。

不发布新的桌面Release、不改账号通知设置、不调用真实模型或生产数据库。原始Dependabot升级早于本补充方案，本记录不声称机器人遵循了SDD先行。
