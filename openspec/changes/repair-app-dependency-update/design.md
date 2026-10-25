# Design

## Context

处理Issue #20与已有PR #17。原始机器人升级已存在，本方案先于维护修复；不倒填其历史。已读delivery-workflow主规格，当前行为契约不变。

## Goals / Non-Goals

目标：使本PR的可接受更新可复现、可评审、通过现有必需门禁。
非目标：改变产品行为、绕过CI、发布新版桌面安装包或修改账号偏好。

## Decisions

先将TypeScript7改为已兼容vue-tsc的5.9.3，再从lockfile与npm包元数据确认electron-winstaller/semver安装图。优先修正依赖声明或选择兼容版本，不修改node_modules、忽略错误或跳过make。

原始PR包含Electron37→45、Forge7→8、Vite6→8、Vitest3→5及多个Vue生态major。逐项检查实际入口/运行时和既有回归；允许保留不兼容包的原稳定线，必须在最终verification.md精确列出，不能将全部40项宣传成已升级。若需应用行为调整，另补规格/TDD而非扩大verification-only权限。

公开验证边界为干净npm ci、npm run check（类型+全部离线测试）、npm run build、npm run make、隔离profile启动与GitHub三平台构建。Electron运行时升级尤其核验原有认证/IPC/profile边界；不调用真实模型或数据库。

## Risks / Trade-offs

依赖升级可能存在现有回归未覆盖的问题；构建不等于跨平台GUI验收。只按已实际执行的边界声明成功。适用检查与局限写入verification.md和PR描述；CI当前结果为合并依据，历史日志不替代最终检查。

回退：以正常PR恢复本次依赖清单/lockfile或工作流SHA，重新通过required；不直接回退受保护main。合并后CI/Pages结果由Issue #20记录，不在合并前伪造完成。
