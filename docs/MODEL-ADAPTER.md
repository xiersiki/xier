# 模型适配更新（2026-10-23）

## 结论和依据

原项目的 OpenAI 兼容 Chat Completions 接口仍可使用；需要更新的是模型发现、服务商参数和流式结果语义，而不是直接换掉整个 SDK。当前仍是文本对话客户端，未实现工具执行、图片上传、Anthropic 原生接口或 Responses API。

本次核对的官方文档与开源参考：

- [DeepSeek 当前接入文档](https://api-docs.deepseek.com/)：当前推荐模型 ID 为 `deepseek-flash` 和 `deepseek-v4-pro`，仍支持 `/chat/completions`。
- [DeepSeek 模型列表](https://api-docs.deepseek.com/api/list-models/)：通过 `/models` 查询账户当前可用的模型。
- [DeepSeek 思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)：`thinking.type` 和 `reasoning_effort` 控制思考，`reasoning_content` 与 `content` 分开返回；纯文本无 tools 请求无需回传思考内容。未来接入工具循环时，必须按官方要求保存并回传 reasoning/tool_calls/tool 消息，不能沿用现在的纯文本历史组装。
- [DeepSeek 结束原因](https://api-docs.deepseek.com/api/create-chat-completion/)：正常结束、长度限制、过滤、工具调用、资源不足和中断必须区分。
- [Vercel AI SDK 的 DeepSeek 实现](https://github.com/vercel/ai/blob/main/packages/deepseek/src/chat/deepseek-chat-language-model.ts)：参考其正文/思考分流、结束原因与流错误处理边界，没有引入整套 SDK。
- [Cherry Studio 的 reasoning control 设计](https://github.com/CherryHQ/cherry-studio/blob/main/packages/provider-registry/docs/reasoning-control.md)：参考按实际服务端接口确定参数格式、保留显式配置的做法，避免仅凭模型名称向代理服务发送不兼容参数。

## 实现

- `common/modelAdapter.ts`：解析 API 根地址；自动识别官方 DeepSeek 域名，支持显式指定通用 OpenAI 兼容或 DeepSeek 适配。代理服务可显式选择 DeepSeek；模型 ID 不用于猜测协议。
- `main/providers/OpenAIProvider.ts`：继续使用现有 OpenAI SDK 的 HTTP/SSE 解析；DeepSeek 专用参数仅在对应适配启用。没有自动重试付费生成，也不会静默替换模型 ID。DeepSeek 请求响应等待上限放宽到 10 分钟，保留用户主动取消。
- 新的“获取模型列表”调用服务商 `/models`，用户选择后添加模型；保留手工输入及既有模型。现有账号模型不会随默认模板变化被覆盖。
- `ProviderModelControls.vue` 只负责模型发现、接口和思考参数编辑，使用 props/emits 与设置页通信；设置页负责保存。
- `AnswerContent.vue` 负责折叠思考内容、渲染正文和展示结束提示；消息 Store 负责持久化与历史组装。思考文本按纯文本展示；复制正文不会混入思考或错误。
- 请求失败保留已接收的正文/思考，错误单独保存。达到输出上限展示提示；内容过滤、服务端中断、空答案、无结束标记的 EOF 不再伪装成成功。停止生成不再将“已停止”拼进模型上下文。
- 原数据库新增 `messages.metadata jsonb` 保存 `reasoningContent`、`finishReason`、`error`；正文列和旧消息不变，继续使用原有 4 条用户归属 RLS 策略。已有其他 Supabase 项目需应用 `supabase/migrations/20261023055319_add_message_model_metadata.sql`；新项目使用更新后的 `schema.sql`。

## 验证

TypeScript 与 35 项离线回归测试通过，其中覆盖实际本地 HTTP/SSE 解析、思考/正文混合流、keep-alive/usage 空块、参数隔离、模型发现、取消、流内错误脱敏、过滤/截断/资源不足/服务端中断、思考落盘、历史过滤和终态界面。macOS arm64 应用和 ZIP 已构建。

数据库扩展后验证：16 条既有消息保留，metadata 默认为空对象，RLS 保持启用。安全 Advisor 与恢复阶段相同，没有新增的缺失 RLS 告警；原有 [函数 search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)、[GraphQL schema 可发现性](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed)、[函数公开执行权限](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) 和 [密码泄露保护](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) 提示未在本次模型适配范围内变更。


真实 DeepSeek API 集成测试单独显式执行并通过（默认 `npm run check` 不调用付费接口）：

- 从已保存的官方 DeepSeek 配置安全读取密钥，未打印密钥或完整配置。
- `/models` 实际返回 `deepseek-flash`、`deepseek-v4-pro`。
- Flash `thinking: disabled` 正常回复，思考内容为空。
- Flash `thinking: enabled` + `reasoning_effort: low` 返回独立思考内容和正确答案 `323`。
- 多轮请求仅回传正文即可记住前文暗号，未发生 `reasoning_content` 缺失错误。
- 已在最终 macOS arm64 打包版界面完成模型发现、添加模型、关闭/开启思考模式及选择低思考强度。
- GUI 连续三轮真实请求依次得到“已记住”“XIER-42 323”“XIER-42 324”，验证从普通模式切换到思考模式，以及已有思考回复后的多轮上下文。
- 思考内容默认折叠，点击可展开；正文与思考分开展示。云端三条回答均为 success/stop，思考字符数依次为 0、129、106。
- 完整退出并重新启动最终打包版后，原账号仍登录，三轮问题/回答及思考内容均恢复，展开查看正常。GUI 验收已完成。
- 验收会话以“Xier 模型适配验收”开头，保留供复查；当前 DeepSeek 配置为开启思考、低强度，可在设置中调整。截图保存在 `/Users/gongchenyu/Documents/ChatGPT/个人项目/xier-模型适配验收.png`。
- 通过已认证角色的回滚事务，实测 metadata 写入读取成功，另一个账号不可读取测试消息；测试数据未留存。

可在本机显式复跑（路径改为自己的 Xier 配置文件；命令本身不包含密钥）：

```bash
XIER_LIVE_PROVIDER_CONFIG='/path/to/Xier/config.json' npx vitest run tests/deepseek.live.test.ts
```

最终应用：`/Users/gongchenyu/Documents/ChatGPT/个人项目/Xier-模型适配版/Xier-darwin-arm64/Xier.app`。
ZIP：`/Users/gongchenyu/Documents/ChatGPT/个人项目/Xier-模型适配版/make/zip/darwin/arm64/Xier-darwin-arm64-1.0.0.zip`，已验证压缩包完整性。
