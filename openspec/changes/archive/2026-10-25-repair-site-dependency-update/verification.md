# 官网依赖升级验收

关联[PR #16](https://github.com/xiersiki/xier/pull/16)、[Issue #20](https://github.com/xiersiki/xier/issues/20)。本变更只调整依赖，不修改站点内容或认证回调。

| 依赖 | main | 本次采用 |
|---|---|---|
| Vue | 3.5.17 | 3.5.44 |
| TypeScript | 5.8.3 | 5.9.3 |
| @types/node | 22.19.7 | 22.20.5 |

原始机器人建议TypeScript7.0.2，与vue-tsc3.3.13的typescript/lib/tsc入口不兼容；[原始失败CI](https://github.com/xiersiki/xier/actions/runs/40180222787)为ERR_PACKAGE_PATH_NOT_EXPORTED。保留完整类型检查，采用5.x兼容更新；Node类型匹配项目Node22。TypeScript7迁移须等类型工具兼容后再独立评估。

## 实际检查

Node22.23.1/macOS arm64：npm ci --prefix site与npm run site:build退出0。构建包含vue-tsc、VitePress及回调复制。首页、开发规范、开始使用HTML生成，auth-redirect.html与docs源文件逐字节一致。日志见evidence/，不把构建结果宣称为浏览器全量交互验收。最终三平台及required由PR CI执行；合并后的Pages结果记录到Issue。

## 依赖审计边界

本次npm audit的依赖条目计数由main的5项（3高危、2中危）降至3项（1高危、2中危）。残余为VitePress1.6.4引入的Vite/esbuild开发服务器依赖；npm报告当前范围无修复版本。没有用强制升级或关闭检查掩盖问题，开发预览保持本机使用；公开交付是静态HTML。该结论不是所有可执行依赖均无风险的声明，后续需评估VitePress维护版本。

回退通过PR恢复site清单和lockfile并重新验证。飞书交付摘要在本批PR完成后统一同步。
