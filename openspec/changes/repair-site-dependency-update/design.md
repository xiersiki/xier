# Design

## Context

处理Issue #20与已有PR #16。原始机器人升级已存在，本方案先于维护修复；不倒填其历史。已读delivery-workflow主规格，当前行为契约不变。

## Goals / Non-Goals

目标：使本PR的可接受更新可复现、可评审、通过现有必需门禁。
非目标：改变产品行为、绕过CI、发布新版桌面安装包或修改账号偏好。

## Decisions

vue-tsc 3.3.13（当前npm版本）仍require.resolve typescript/lib/tsc；原始CI40180222787明确报ERR_PACKAGE_PATH_NOT_EXPORTED。使用TypeScript5.9.3，保留5.x工具链；Node类型选择22.20.5匹配.nvmrc。Vue补丁更新为3.5.44。

公开验证边界为干净npm ci --prefix site、npm run site:build（包含vue-tsc、VitePress、认证回调保留脚本）、输出HTML和auth/redirect.html检查。禁止删除类型检查来使构建变绿。无UI/路由源代码修改，不增添镜像实现的测试。

## Risks / Trade-offs

依赖升级可能存在现有回归未覆盖的问题；构建不等于跨平台GUI验收。只按已实际执行的边界声明成功。适用检查与局限写入verification.md和PR描述；CI当前结果为合并依据，历史日志不替代最终检查。

回退：以正常PR恢复本次依赖清单/lockfile或工作流SHA，重新通过required；不直接回退受保护main。合并后CI/Pages结果由Issue #20记录，不在合并前伪造完成。
