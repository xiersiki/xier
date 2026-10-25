# Xier 恢复记录

2026-10-23。工作分支：`codex/restore-xier`。

## 资源与启动

本地项目：`/Users/gongchenyu/code/xier`。原 Supabase 项目 `hxpjokwqabfuzjyzwrgg` 当时处于 INACTIVE，已恢复为 ACTIVE_HEALTHY，没有新建空项目，也没有删除旧账号或旧消息。恢复时存在 1 个账号、5 个模型服务商、1 个会话、10 条消息。

使用 Node 22，执行 `npm ci`，复制 `.env.example` 为 `.env` 后填写 Supabase URL 和公开客户端 key，执行 `npm start`。没有云端配置也可启动并使用本地模式。配置改变后需重新启动；打包时 Vite 会将公开客户端配置写入产物。不要填入 service_role / secret key。

macOS 原打包配置的图标路径指向文件系统根目录，现改为项目绝对路径，并补充 icns 图标。`npm run package` 生成 `out/` 下的应用；`npm run make` 生成当前平台安装产物。当前配置的 macOS 产物为 ZIP。

## 登录

GitHub 使用 PKCE。授权在系统默认浏览器完成，桌面进程临时监听 `127.0.0.1:54323`，收到授权码后交给发起登录的渲染进程兑换会话。授权码不写日志，窗口不再被导航到登录网页。完成、失败、用户取消、超时或发起窗口关闭后释放监听。

Supabase Authentication → URL Configuration 的 Redirect URLs 必须包含精确地址：

```
http://127.0.0.1:54323/auth/callback
```

GitHub OAuth App 的回调仍为 Supabase 提供的 `https://<project-ref>.supabase.co/auth/v1/callback`。这与上面的桌面回调不是同一个地址。

已实测旧 GitHub 账号登录、旧对话和消息恢复。邮箱密码入口保留；注册依赖邮箱验证。当前云项目未启用 Google，因此界面禁用该入口。仓库中的 Magic Link helper 尚未接入桌面界面，不能视作已交付功能。

## 数据与同步

- 未登录使用 `xier` 本地数据库；登录后使用 `xier-user-<userId>`。切换账号不会复用另一账号的缓存。旧版 `xier` 数据保留，访客数据不会自动并入登录账号。
- 所有编辑先写入 IndexedDB；模型配置、会话标题/置顶/模型选择、完整或失败回答均保留待同步标记。
- 云端读取先合并服务商，再上传本地修改，然后拉取会话与消息。请求期间产生的新编辑不会被旧响应清除。
- 删除操作保留本地待办，联网后重放。云端拉取不会恢复尚待删除的数据。
- 启动、登录、网络恢复和数据变更会触发同步；失败时保留本机数据，可从账号菜单手动同步或重启重试。
- Supabase 的三张业务表都启用 RLS，以 `user_id = auth.uid()` 限制访问。已用回滚事务验证当前账号 CRUD、删除会话时级联删除消息、其他账号不可读。
- 当前同步采用本地未同步修改优先，不实现跨设备逐字段冲突合并。

## 聊天与设置

回复按接收顺序串行落盘；流结束、API 错误和用户停止都结束占位状态并清理监听。停止会实际取消主进程 HTTP 请求。重启后将未完成的回答标记为中断；打开设置或切换会话不会中断正在进行的回答。

模型接口使用 OpenAI 兼容协议。接口地址应填写 API 根地址，例如 `https://api.deepseek.com/v1`，模型名需为服务商当前开放的 ID。旧配置若误含 `/chat/completions`，调用时自动移除重复后缀。已移除代码里预填的账号密码和 API Key。

恢复后的初次真实服务测试：DeepSeek 旧 key 返回 401；豆包旧模型 ID 返回 404，错误正确展示并同步到云端。用户更新 DeepSeek key 后，独立应用收到真实回复“连接正常”；已验证停止生成、会话重命名和置顶。

经用户明确授权，已通过“导入未登录时的模型配置”将新的 DeepSeek 配置保存到原 GitHub 账号。云端对应服务商版本更新为 4；登录状态下重新发送测试，真实收到“连接正常”，问题和回答均已在 Supabase 中保存为 success。完整退出并重启最终打包版后，原账号登录状态、历史会话和本次成功回答均保留。访客配置也保留在原本机缓存中。

## 验证

`npm run check` 执行 TypeScript 检查和 Vitest。测试覆盖未配置云服务启动、配置传到主进程、多窗口配置不丢失、置顶同步、流式回答落盘、停止请求、多窗口状态、同步期间编辑、分页拉取、离线删除、账号缓存与请求凭据隔离，以及主动导入访客模型配置时保留原服务商 ID。当前 20 项测试通过；额外用本地 HTTP SSE 服务验证了流结束与请求取消。

旧账号中的早期联调会话以“这是 Xier 恢复后的连通性测试”开头；最终成功会话以“Xier 账号同步验证”开头。独立应用访客模式中的成功会话已重命名为“Xier 恢复验证”并置顶，均保留用于复查。

渲染端生产构建、macOS arm64 打包及 ZIP 制作均通过，ZIP 完整性检查无错误。最终恢复版路径：

```
/Users/gongchenyu/Documents/ChatGPT/个人项目/Xier-恢复版/Xier-darwin-arm64/Xier.app
/Users/gongchenyu/Documents/ChatGPT/个人项目/Xier-恢复版/make/zip/darwin/arm64/Xier-darwin-arm64-1.0.0.zip
```

## 尚未覆盖的外部条件

- 豆包仍需用户提供当前可用的模型 ID；本次真实成功链路使用 DeepSeek。
- Google OAuth 尚未在原云项目配置；邮箱注册/验证/密码登录未使用真实邮箱完成端到端验收。
- 本次实际运行平台为 macOS arm64；Windows、Linux 和 macOS Intel 未进行实际打包运行验证。
- 当前为本机开发恢复版，未配置分发所需的正式代码签名与公证。
