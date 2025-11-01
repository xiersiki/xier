# Xier

> 基于 Electron + Vue 3 的跨平台 AI 对话桌面应用。
> 支持整合多家 LLM 服务商，管理本地数据，并可同步至 Supabase。

## ✨ 功能亮点

- **多服务商整合**：预置 BigModel、DeepSeek、SiliconFlow、千帆等 OpenAI 兼容模型，可自定义扩展。
- **桌面级体验**：Electron Forge + Vite 构建，macOS / Windows 均可打包发布。
- **现代前端栈**：Vue 3 + Pinia，Composition API 组织状态，Naive UI 提供基础组件。
- **云端同步**：可选使用 Supabase 作为 providers / conversations / messages 的后端存储，并集成邮箱密码 + OAuth 登录。
- **离线优先**：Dexie（IndexedDB）本地缓存，预加载层暴露完整 IPC API。
- **对话流程完善**：支持流式回复、停止生成、批量操作、置顶等对话管理能力。

## 🧩 项目结构

```
electron/
├─ main/        # 主进程服务、窗口管理、OpenAI 调用
├─ preload.ts   # 预加载脚本，暴露 window.api
└─ renderer/    # Vue 3 SPA（Vite）
    ├─ components/
    ├─ stores/      # Pinia（auth / providers / conversations / messages）
    ├─ services/    # Supabase 客户端与仓库
    ├─ styles/      # 主题、Tailwind 入口
    └─ views/       # 对话页、设置页等
```

- **IPC**：前端通过 `window.api` 与主进程通信（配置、菜单、对话请求等）。
- **数据层**：Dexie 做本地缓存；Supabase 仓库负责 CRUD（providerRepo、conversationRepo、messageRepo 等）。
- **认证**：`authRepo` 封装 Supabase Auth（邮箱密码、魔法链接、Google、GitHub），`AuthDialog` 负责 UI 流程。

## 🚀 快速开始

> 依赖：Node 20+、pnpm（或 npm/yarn）、可选 Supabase 项目（用于云端功能）。

```bash
pnpm install        # 安装依赖
pnpm start          # 启动 Electron + Vite 开发环境
```

`package.json` 中 `start` 脚本会使用 `dotenv -e .env electron-forge start`，请在根目录准备 `.env` 文件。

### 环境变量示例

```
# Vite 会自动加载 VITE_ 前缀变量
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxx

# 如需主进程/预加载自定义，可使用 .env.main / .env.preload
```

## 🛠️ 常用脚本

| 命令           | 说明                            |
|----------------|---------------------------------|
| `pnpm start`   | 开发模式（Vite + Electron）      |
| `pnpm package` | 打包应用（Electron Forge）       |
| `pnpm make`    | 生成安装包                      |
| `pnpm publish` | 发布到配置的分发渠道             |

（使用 npm/yarn 时替换相应命令即可。）

## 🗄️ Supabase 数据结构

### 表规划

- `providers`：服务商信息（id、user_id、name、models jsonb、openai_setting、时间戳）。
- `conversations`：会话（provider_id、selected_model、pinned、created_at、updated_at）。
- `messages`：消息（conversation_id、type、content、status、时间戳）。

推荐开启 RLS，策略一般为 `user_id = auth.uid()`。若需保存全局默认服务商，可在 `user_id = null` 时开放只读权限。

### 默认服务商

`providerRepo.ensureDefaultProviders(userId)` 会根据当前用户检查缺失的服务商并自动插入（bigmodel、deepseek、siliconflow、qianfan）。建议在 `authStore` 初始化成功后调用一次。

## 🔐 认证流程

- **邮箱密码**：支持注册、登录，注册成功后会提示去邮箱确认。
- **邮箱 OTP**：Supabase Magic Link。
- **第三方登录**：Google / GitHub。
- `AuthDialog`：
  - 注册模式下禁止点击遮罩关闭，并显示“需邮箱验证”提示。
  - 所有操作完成后通过 Naive UI `useMessage` 通知成功/失败。
  - OAuth 按钮互不影响 loading 状态。

## 🎨 主题与样式

- 自定义主题变量位于 `renderer/styles/theme/light.css` 和 `dark.css`，定义 `--bg-color` / `--text-primary` 等。
- `renderer/index.css` 负责 Tailwind 插件、全局滚动条、@theme tokens。
- `useThemeMode` 负责读取/切换系统主题并同步到主进程配置；`useNaiveTheme` 将主题传入 Naive UI。
- `AuthDialog` 等组件使用 `--bg-color`、`--text-secondary` 等变量，确保深浅色一致。

## 💬 对话流程

- `messagesStore.sendMessage` 在本地插入提问/占位回答，调用 `window.api.startADialogue` 触发主进程流式请求。
- 流式响应更新消息内容/状态；支持 `stopMessage` 提前结束。
- `ConversationList` 提供搜索、批量操作、置顶、上下文菜单；底部 `UserBadge` 根据登录态显示提示或打开认证/设置。

## 🔄 本地与云同步

1. 未登录或离线：默认使用 Dexie（IndexedDB）存储。
2. 登录后：Supabase 仓库负责远程数据，Dexie 可作为缓存层（可按需求实现同步策略）。
3. 如需迁移旧数据，可编写脚本将 Dexie 数据导入 Supabase。

## 📦 打包发布

Electron Forge 默认目标：

- Windows：Squirrel / ZIP
- macOS：DMG
- Linux：deb / rpm

构建入口为 Vite 输出的 `.vite/build/index.js`，应用图标位于 `public/noel_icon.ico`。

## 🤝 贡献指南

1. Fork & Clone 仓库。
2. 新建分支 `feature/xxx`。
3. 完成开发并确保 lint/测试通过（可自行配置 `pnpm lint`）。
4. 提交 PR：说明改动、验证方式、附截图（建议提供浅色/深色主题效果）。

### 开发约定

- 全部使用 TypeScript。
- Store 与 Service 保持单一职责；复用逻辑抽离为 composable。
- 修改会话/消息逻辑时，注意保持 Dexie 与 Supabase 状态一致。
- UI 需适配 light/dark 主题，避免写死颜色。

## 📌 未来规划

- 完成会话/消息的云同步与冲突解决。
- 引入自动化测试（Vitest / Playwright）。
- 逐步统一 UI（例如引入 shadcn-vue）。
- 设计离线同步与数据回放机制。

## License
本项目采用 [ISC License](./LICENSE)。

---
如果你正在使用或二次开发本组件库，欢迎通过 Issue / PR 分享需求与建议，共同完善生态。祝开发顺利！