# Xier

Electron + Vue 3 桌面对话助手，支持 OpenAI 兼容模型、流式回复、本地历史记录和 Supabase 账号同步。

[项目网站](https://xiersiki.github.io/xier/) · [下载与版本](https://github.com/xiersiki/xier/releases) · [参与开发](CONTRIBUTING.md) · [Agent 入口](AGENTS.md)

项目处于开发阶段。安装包的签名、平台和验收状态以具体 Release 说明为准；没有公开 Release 时可从源码运行。路线图见[项目站点](https://xiersiki.github.io/xier/roadmap.html)。

## 本地运行

推荐 Node 22，使用仓库中的 npm lockfile 安装。

```bash
npm ci
cp .env.example .env
npm start
```

Supabase 为可选项。不填云端环境变量也能使用本地对话；模型 API Key 在应用「设置 → 模型配置」中填写，同时启用服务商并添加有效的模型 ID。

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
# 旧项目可用 VITE_SUPABASE_ANON_KEY 代替 publishable key
```

只使用公开客户端 key。环境变量变更后重启应用；打包产物需要重新构建。环境文件已被 Git 忽略。

## 账号与云端

支持邮箱密码和 GitHub 登录。GitHub 授权在系统浏览器中进行，成功后自动返回桌面窗口。Supabase 的 Redirect URLs 需要添加：

```
http://127.0.0.1:54323/auth/callback
```

GitHub OAuth App 的 Authorization callback URL 使用 Supabase 控制台给出的 `/auth/v1/callback` 地址。当前恢复项目未启用 Google 登录，应用中的对应入口暂时禁用。邮箱注册需要完成邮箱验证后再登录。

使用全新 Supabase 项目时，可在空的 `public` 业务 schema 中执行 [supabase/schema.sql](supabase/schema.sql)，再配置 Auth；已有项目不要直接重复执行建表脚本。

访客与每个账号使用独立本地缓存。访客对话及配置会保留在本机，登录不会自动上传访客数据。需要时可在登录后的模型设置中点击“导入未登录时的模型配置”，将访客配置显式同步到当前账号。所有修改先落盘，联网后同步；离线删除在恢复网络后重放。账号菜单提供“立即同步”。多个设备同时修改同一条数据时，以本机尚未同步的修改优先，不进行逐字段合并。

## 开发与构建

```bash
npm run check      # TypeScript + 回归测试
npm run build      # 渲染端生产构建
npm run package    # 独立桌面应用，输出到 out/
npm run make       # 当前平台安装/分发文件
```

当前 Forge 配置：macOS ZIP、Windows Squirrel、Linux deb/rpm。macOS 应用图标包含 icns。跨平台产物需在对应平台验证；仓库没有配置正式代码签名或公证。

CI 验证类型、离线回归、renderer、官网与三平台桌面构建；固定汇总检查为 `required`。main 的实际保护与运行状态见 [GitHub Actions](https://github.com/xiersiki/xier/actions)。构建绿色不替代安装/启动验收。

官网在独立的 `site/` 中维护：`npm ci --prefix site` 后运行 `npm run site:dev` 或 `npm run site:build`。Pages 发布只使用官网构建产物，并原样保留历史 `auth-redirect.html` 路径。

发布流程创建未签名的草稿预发布，附校验和和提交信息；完成安装验收后再公开。详见[发布指南](docs/releasing.md)。

开发环境不会自动安装 Vue Devtools。需要时可运行 `XIER_DEVTOOLS=1 npm start`。

## 代码位置

- `main/`：窗口、配置、OAuth 回调、流式模型请求。
- `preload.ts`：受控 IPC 接口。
- `renderer/stores/`：账号、服务商、对话和消息状态。
- `renderer/services/`：Supabase 仓库和同步流程。
- `renderer/dataBase.ts`：本地 IndexedDB schema。
- `tests/`：启动、流式状态、同步竞争和 OAuth 校验回归。

本次修复详情、验证结果和仍需配置的服务见 [docs/RECOVERY.md](docs/RECOVERY.md)。

模型设置支持获取接口当前可用的模型列表，并可手动保留或添加模型 ID。官方 DeepSeek 接口自动启用专用适配，可设置思考模式及强度；代理服务按需显式选择适配类型。思考内容与正文分开保存和展示，截断、中断和错误均有独立提示。

已有云项目升级本次模型适配前需应用 `supabase/migrations/20261023055319_add_message_model_metadata.sql`；本次恢复的原项目已应用。适配依据、开源参考和真实接口测试结果见 [docs/MODEL-ADAPTER.md](docs/MODEL-ADAPTER.md)。

## 规格与开发流程

需求按 [OpenSpec SDD/TDD 规范](docs/spec-driven-development.md) 开发：先规格、再测试、红绿重构，PR 通过规格门禁和实际测试后合并。`npm ci` 安装项目固定 CLI，运行 `npm run spec -- list` 查看变更。
