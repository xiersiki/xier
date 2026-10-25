# 验证与交付

本PR保持CI/部署/发布行为不变，更新7个官方Actions固定SHA；采用verification-only。关联[Issue #20](https://github.com/xiersiki/xier/issues/20)与[PR #15](https://github.com/xiersiki/xier/pull/15)。

| Action | 目标版本 |
|---|---|
| checkout | 7.0.1 |
| setup-node | 7.1.0 |
| upload-artifact | 7.0.2 |
| download-artifact | 8.0.2 |
| configure-pages | 6.0.0 |
| upload-pages-artifact | 5.0.0 |
| deploy-pages | 5.0.1 |

独立评审会话 review_dependencies 对原始配置 b0f06ec 通过GitHub API核对每个tag与完整SHA一致，未发现兼容性阻断。Action运行Node24不改变应用Node22.23.1；hosted runner满足最低2.327.1。现有contents/pages/id-token权限保持不变。

本机actionlint 1.7.12通过，日志见evidence/actionlint.txt。候选配置的[先前CI](https://github.com/xiersiki/xier/actions/runs/40183375041)中应用、站点、三平台make及upload均成功，唯一失败是本次补齐的OpenSpec资料；最终SHA仍以PR的required为准。合并后核验main与Pages，由Issue记录结果。

## 未执行的边界

未创建新的桌面Release；download-artifact与release拼装只做静态兼容审查。upload v7默认archive、download v8默认解压并保留目录，适配现有递归资产搜集；下载摘要不一致仍失败。Pages上传默认隐藏文件策略不影响当前公开站点。构建成功不代表GUI安装验收。

## 官方依据

- [checkout v7](https://github.com/actions/checkout/blob/v7.0.1/README.md)
- [setup-node v7](https://github.com/actions/setup-node/blob/v7.1.0/README.md)
- [upload-artifact v7](https://github.com/actions/upload-artifact/blob/v7.0.2/action.yml)
- [download-artifact v8](https://github.com/actions/download-artifact/releases/tag/v8.0.0)
- [Pages upload v5](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0)
- [Pages deploy](https://github.com/actions/deploy-pages/blob/v5.0.1/src/internal/api-client.js)

回退按design.md通过受保护PR恢复先前SHA。飞书交付摘要随本批三个PR处理完成后统一同步，避免重复状态。
