# Proposal

## Why

PR #17 隔离桌面验收发现 Forge 7.11 默认不复制主进程 public 资源，启动加载页报 ERR_FILE_NOT_FOUND；旧 Forge 7.8 产物包含该页。主窗口虽可打开，仍是升级回归，必须修复后才能合并。

关联 [Issue #20](https://github.com/xiersiki/xier/issues/20)、[PR #17](https://github.com/xiersiki/xier/pull/17)、[工程知识库](https://pcn11w88fq9h.feishu.cn/wiki/KwbAwXJZ4it8f0kZOHgc56n9nxb)。

## What Changes

保留启动加载资源，并在三平台 make 后检查实际 app.asar 中主进程请求的页面。先记录真实失败，再最小配置修复、重建与验证。

## Capabilities

### New Capabilities
- `desktop-startup`: 明确已存在的启动加载页交付契约，防止打包更新丢失运行时资源。

### Modified Capabilities
无。

## Impact

vite.main.config.ts、打包产物测试、desktop CI 与直接测试工具依赖。不修改窗口或聊天业务源码，不发布 Release。与纯依赖 verification-only change 分开保留 TDD 证据。
