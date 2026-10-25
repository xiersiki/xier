# 架构入口

Xier 是 Electron + Vue 3 + TypeScript 桌面对话应用。架构意图与变更背景维护在[飞书技术架构页](https://pcn11w88fq9h.feishu.cn/wiki/ZT9ywpmJvimcqxkbJ21cKW3xn3H)，实际接口以类型、代码和迁移为准。

| 边界 | 职责 | 修改时关注 |
| --- | --- | --- |
| `main/` | 窗口、模型请求、配置与 OAuth 回调 | 系统权限、取消与流式终态、回调校验 |
| `preload.ts` | 有限 IPC 桥接 | 不向 renderer 暴露任意系统能力 |
| `renderer/` | Vue UI、Pinia 状态、本地数据和同步 | 账号隔离、离线行为、交互和错误状态 |
| `common/` | 共享类型、模型适配、OAuth 工具 | 两端契约与向后兼容 |
| `supabase/` | schema 与版本迁移 | 已有数据不可通过重复建表覆盖 |
| `tests/` | 离线回归与显式 opt-in 实际接口测试 | 默认不依赖外部凭据 |
| `site/` | 独立 VitePress 项目介绍与公开指南 | 不包含内部知识库或用户数据 |

访客和登录账号使用独立本地缓存。写入先在本地落盘，再同步到当前账号；离线删除需要保留重放信息。不要在 UI 层绕过数据服务直接建立第二套同步机制。

模型请求由主进程执行，renderer 通过受控 IPC 接收状态。适配器区分正文、思考、截断、中断与错误；改动必须保留这些语义。[模型适配记录](MODEL-ADAPTER.md) 包含协议与迁移背景。

`npm run build` 构建 renderer；Forge 才组合主进程、preload、renderer 和 Electron 形成桌面包。桌面发布与静态官网部署各有独立流程，后者不代表应用已经发布。
