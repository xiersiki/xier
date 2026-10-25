# Design

## Context

见 proposal。现有 WindowService 从主进程目录加载 loading.html；旧 Forge 将 public 复制到该目录，新 Forge 7.11 默认关闭主进程的 copyPublicDir，导致真实启动警告。renderer 的副本不满足现有请求路径。

## Goals / Non-Goals

恢复既有加载页交付，不修改窗口业务代码、加载动画、IPC 或 Release；不通过放宽 SDD 门禁将 TS 配置伪装成纯依赖。

## Decisions

公开验证边界为 npm run make 生成的 app.asar 文件，使用 @electron/asar 的公开 extractFile API 读取运行时预期的 .vite/build/loading.html，与 public/loading.html 字节对比。沿用本任务已授权的桌面产物验收范围，不在组件内部 mock 路径或断言配置值。工具声明直接开发依赖 3.4.1（现有打包工具已安装此版本）。

先用 Node 原生 test 在当前实际产物上观察缺失失败，然后在 vite.main.config.ts 显式 build.copyPublicDir:true，重跑 make 和相同测试，最后复核/重跑。单项配置无需额外重构。测试文件避开默认离线 Vitest include；desktop.yml 每个平台 make 后执行该测试，失败进入现有 required 门禁。

选择恢复旧 public 复制行为，不新增自定义复制插件或更改运行时路径。所有平台按 Electron 的公开应用目录布局定位当前平台/架构产物。

## Risks / Trade-offs

产物检查证明资源存在与内容一致，不证明加载动画时序；本机隔离 profile 再启动检查警告消失与主窗口可用。public 必须保持只含可公开资源；复制行为与旧主进程构建一致，不包含 .env 或用户数据。

回滚通过正常 PR 恢复兼容依赖及配置，保留资源回归检测，不绕过 required。
