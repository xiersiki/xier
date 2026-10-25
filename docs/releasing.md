# 版本发布与安装验收

## 首期发布范围

应用版本来自根 `package.json`，tag 为 `v<version>`。版本变更通过 PR 同步 `package-lock.json` 与版本记录；不要复用已发布 tag 或覆盖旧安装包。Forge 构建桌面产物，GitHub Releases 保存文件，Pages 提供导航。

首期工作流只创建**未签名的 draft prerelease**。macOS arm64 优先做真实安装/启动验收；Windows/Linux 即使打包通过，也必须分别标记安装状态。正式签名和公证尚未配置。

## 正常发布步骤

1. 确认目标提交已进入受保护的 main，PR 验收与评审完成。版本、迁移和已知问题已记录。
2. 在 GitHub Actions 运行 `Draft test release`，选择 main，输入与 `package.json` 完全一致的版本号。流程校验版本和未占用 tag，重新执行应用检查与三平台 Forge make。
3. 全部构建通过后，在**同一次工作流**汇总产物、生成 `SHA256SUMS.txt` 和 `build-info.json`，于触发的准确提交上创建 draft prerelease。无需依赖 token 创建 tag 再触发下一个工作流。
4. 下载实际草稿资产，在独立目录验证校验和、解包，并用隔离 profile 启动。记录窗口加载、基本设置、日志异常及退出；真实模型和云端操作只在另行授权的验收中执行。
5. 更新 Release notes：提交、系统/架构、安装步骤、通过/未测项、签名状态、已知问题、数据迁移与回退限制。完成后再将草稿公开为 prerelease。
6. 核对公开下载与 Pages 链接，更新飞书测试/发布页。不得仅凭 Actions 绿色声称用户安装成功。

如果失败发生在创建草稿之后，先查看该 draft 与已有资产，再在同一草稿补交缺失文件；工作流默认拒绝重复 tag，避免误覆盖。不要删除历史 Release 来规避版本管理。

## 发布入口

`npm run publish` 通过已授权的 GitHub CLI 触发 main 上的 `release.yml`，使用本地 package.json 的版本作为请求参数；工作流会再次验证可信 main 的版本。命令不会上传本地工作树或直接修改既有 Release。

所有产物均由 Forge make 生成，之后先统一为安全文件名，再生成校验和；只有最后的发布 job 拥有 `contents: write`。PR 构建没有发布凭据。原生 Forge publisher 不能保证已存在的公开 Release 保持草稿，因此不提供第二个可绕过验收的发布入口。

## 签名策略

正式分发前：macOS 接入 Developer ID 签名、notarization 与 stapling；Windows 接入代码签名并验证安装器签名。凭据仅放在受保护的发布 environment，不能注入 PR job。证书/账号的采购、签名身份和发布环境配置由维护者决定。

未签名测试不等于稳定分发。不要在指南中要求用户全局关闭系统安全机制；需要正式面向普通用户安装时，完成签名路径后再发布。

## 回退

保留每个版本的 tag、校验和与资产。回退应用前备份用户数据，检查 schema/迁移兼容性；代码回退不自动回退数据库。代码修复通过新 PR 和新版本交付，网站可从已知良好提交重建。记录受影响版本、原因与恢复验证。

## 验收记录模板

日期/执行者；Release/Actions/提交；平台和架构；下载文件和 SHA256；签名状态；安装或解包步骤；隔离 profile 路径；启动/窗口/设置/退出结果；日志；未测的模型与云端项；问题、回退与公开发布决定。
