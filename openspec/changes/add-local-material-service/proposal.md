# Proposal

## Why

Xier 当前没有本地资料副本的导入与检索能力。用户选择以该场景练习桌面进程通信、资源管理、存储与故障恢复，要求先形成可评审 PRD 和技术方案；产品价值尚无访谈或效率基线，不将求职学习目标冒充市场需求。

[Issue #28](https://github.com/xiersiki/xier/issues/28) · [PRD 快照](../../../docs/product/local-material-service.md) · [PRD](https://pcn11w88fq9h.feishu.cn/wiki/LMW1w1n5AiSIDBkeheac4WWQnij) · [技术评审](https://pcn11w88fq9h.feishu.cn/wiki/Hf02wtW5eiXhRfkUQDec9qCpnWe) · [前期研究](https://pcn11w88fq9h.feishu.cn/wiki/JaZTwFr8FiTCrCkA7xucFThKnnb)。本 change 为拟新增行为，当前仅交付设计，不代表代码已实现。

## What Changes

- 增加独立「本地资料」入口，选择 UTF-8 TXT/Markdown 并保存本机副本，逐项展示成功、重复和失败。
- 支持标题/正文的字面子串搜索、分页只读预览、复制及确认移除副本，原文件保持不变。
- 设计受控独立服务、单批次任务、取消与终态、异常恢复、重开核对、访客/账号本地分区。
- 为已确认内容、重复请求、服务退出与性能提供可复现验证边界。
- 首期不做原文件编辑/监听、目录导入、PDF/图片/OCR、云同步、模型/RAG、RN 和新的多窗口产品功能；保留原聊天和一期内容协作的职责。

## Capabilities

### New Capabilities

- `local-material-library`: 文本副本、容量与重复、离线字面查询、预览和移除。
- `local-material-jobs`: 导入任务的提交、进度、取消、幂等、异常恢复和身份生命周期。

### Modified Capabilities

无。本次不改变已有 desktop-startup、delivery-workflow 主规格。未来仅为新服务接入增加局部流程，不重写既有聊天存储和模型请求。

## Impact

预计新增 `main/materials/` 的宿主管理、utility entry 和本地存储，`common/materials/` 的协议，`renderer/features/materials/` 的 Vue 页面及平台接口。共享接点是 preload、主窗口 auth 生命周期、导航/路由、Forge/Vite 打包配置；与 PR #25/#27 合并前核对实际接口并确定单一写入归属。

优先验证 Electron 内置 node:sqlite 和 FTS5，验证不通过再评估固定版本 better-sqlite3；本轮不安装应用新依赖、不修改可执行源码。首期主验收环境为 macOS arm64，新增资料数据位于独立分区，不迁移既有 Dexie 或写入 Supabase。所有实现任务保持未完成，门禁不得被解释为已交付。
