# Design

## Context

处理Issue #20与已有PR #15。原始机器人升级已存在，本方案先于维护修复；不倒填其历史。已读delivery-workflow主规格，当前行为契约不变。

## Goals / Non-Goals

目标：使本PR的可接受更新可复现、可评审、通过现有必需门禁。
非目标：改变产品行为、绕过CI、发布新版桌面安装包或修改账号偏好。

## Decisions

七个Action保留官方固定SHA；运行时从旧Node20更新到Node24，项目Node仍为.nvmrc指定22.23.1。GitHub hosted runner满足要求。最小权限不变，仍只在部署/发布job授权写入。

官方版本审查确认upload v7默认archive与download v8默认解压兼容，Pages使用同run的github-pages artifact，站点无必须发布的隐藏目录。不同于跨run下载，无需额外actions:read。

公开验证边界为actionlint、实际Actions jobs的结果与产物。已有40183375041的app/site/三平台成功是候选版本证据，最终提交仍需重跑required；merge后核验Pages。release工作流只做静态兼容审查，不为验证依赖新建Release。

## Risks / Trade-offs

依赖升级可能存在现有回归未覆盖的问题；构建不等于跨平台GUI验收。只按已实际执行的边界声明成功。适用检查与局限写入verification.md和PR描述；CI当前结果为合并依据，历史日志不替代最终检查。

回退：以正常PR恢复本次依赖清单/lockfile或工作流SHA，重新通过required；不直接回退受保护main。合并后CI/Pages结果由Issue #20记录，不在合并前伪造完成。
