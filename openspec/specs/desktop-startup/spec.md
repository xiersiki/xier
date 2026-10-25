# desktop-startup Specification

## Purpose
确保用户从发布的桌面包启动 Xier 时，启动加载提示所需的本地页面随包交付。该契约约束实际安装产物，防止构建工具更新后出现源码存在但运行时资源缺失的回归。

## Requirements

### Requirement: Startup loading page is shipped
桌面安装产物 MUST 包含启动过程请求的本地加载页面，内容与项目维护的加载页一致；依赖或打包工具更新 SHALL NOT 静默丢失该资源。

#### Scenario: Packaging for a supported platform
- **WHEN** 为 macOS、Windows 或 Linux 构建桌面产物
- **THEN** 打包归档中包含运行时请求的加载页，且内容与源页面逐字节一致
