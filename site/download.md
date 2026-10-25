# 下载与版本

Xier 仍在开发中。安装包统一放在 GitHub Releases，版本说明记录平台、验证范围与已知限制。

[查看 GitHub Releases →](https://github.com/xiersiki/xier/releases)

如果尚无公开版本，可以按照[开始使用](guide/getting-started.md)从源码运行。此页面不提供未经验证的“最新版”直链。

## 平台与状态

| 平台 | 构建格式 | 验收范围 |
| --- | --- | --- |
| macOS Apple Silicon | ZIP 内的 `.app` | 当前优先验证的平台；具体以版本记录为准 |
| Windows x64 | Squirrel 安装包 | 自动构建；安装验收以版本记录为准 |
| Linux x64 | deb / rpm | 自动构建；安装验收以版本记录为准 |

当前测试包未接入正式签名或公证，不应视为稳定发行版。没有已发布测试包时，Actions 中的构建产物仅供开发验证。

## 验证下载

测试发布附带 `SHA256SUMS.txt`。下载到同一目录后，macOS 可用 `shasum -a 256 -c SHA256SUMS.txt` 核对；只下载单个安装包时，对照文件中的对应条目。校验和验证文件完整性，不代替开发者签名。

API Key 在你自己的模型服务商创建，在 Xier 的模型设置中配置。应用安装包不包含共享模型额度或内置私人 Key。
