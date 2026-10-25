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

## macOS 独立 profile 验收

适用 Electron 37.1.0。2026-10-25 已核对其 [PreSandboxStartup 实现](https://github.com/electron/electron/blob/v37.1.0/shell/app/electron_main_delegate.cc#L298-L303)，同版本隔离探针已确认 `app.getPath('userData')` 返回指定临时目录，证据见 [Issue #3](https://github.com/xiersiki/xier/issues/3)。这些证据只确认参数生效；实际 Release 的下载、窗口与退出验收须另行记录，Windows/Linux 尚未做实际 GUI 验收。

先下载目标 macOS ZIP、`SHA256SUMS.txt` 和 `build-info.json`，核对来源提交与 ZIP 的 SHA256，再解包。下载了全部资产时可运行 `shasum -a 256 -c SHA256SUMS.txt`；只下载目标 ZIP 时，运行 `shasum -a 256 "/绝对路径/目标.zip"`，逐字核对清单中该文件的条目，匹配后继续。

在同一个终端执行，先将 `xier_app` 改为已解包 App 的绝对路径。临时目录每次新建，保持 `HOME` 原值，不导入个人配置或聊天数据。

```bash
xier_app="/绝对路径/Xier.app"
xier_test_root="$(mktemp -d /private/tmp/xier-acceptance.XXXXXX)"
xier_profile="$xier_test_root/user-data"
mkdir -p "$xier_profile"
"$xier_app/Contents/MacOS/Xier" --user-data-dir="$xier_profile" >"$xier_test_root/stdout.log" 2>&1 &
xier_pid=$!
printf '验收目录: %s\n进程: %s\n' "$xier_test_root" "$xier_pid"
```

先确认 `$xier_profile/logs` 已生成；[日志服务](../main/service/LogService.ts)和[配置服务](../main/service/ConfigService.ts)分别使用该 profile 下的 `logs/` 和 `config.json`。首次启动没有 `config.json` 属正常情况。在测试窗口切换一次本地主题后，检查文件与日志中的配置保存路径：

```bash
ls -l "$xier_profile/config.json" "$xier_profile/logs"
tail -n 40 "$xier_profile"/logs/*.log
```

确认路径属于本次临时目录，再记录窗口是否完整加载、访客界面和本地设置是否可用、日志是否有异常；仅有 PID 或日志文件不算窗口验收通过。默认不登录云端、不填写模型凭据、不发送模型请求。若系统阻止未签名 App 启动，记录为阻断，不使用 `sudo` 或关闭 Gatekeeper。

在该测试窗口按 `Cmd+Q` 退出，然后回到原终端检查主进程结束及退出码：

```bash
wait "$xier_pid"
printf '退出码: %s\n' "$?"
```

保留本次目录中的配置路径、日志和必要的脱敏截图作为证据，完成交接且进程退出后再清理该任务目录。不要清理个人默认 profile。实际验收结果按文末模板写入对应 Release，不把本指南当作已通过记录。

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
