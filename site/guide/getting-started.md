# 开始使用

Xier 把多个模型放在一个桌面对话界面中。你需要自己的模型服务与 API Key；账号和云端同步是可选项。

## 从源码运行

安装 Git 与 Node.js 22，然后执行：

```bash
git clone https://github.com/xiersiki/xier.git
cd xier
npm ci
cp .env.example .env
npm start
```

仓库 `.nvmrc` 固定已验证的 Node 版本。Windows 可以用文件管理器复制 `.env.example` 为 `.env`。

## 连接模型

打开「设置 → 模型配置」，填写服务商地址与 API Key，启用服务商，添加有效模型 ID。可以尝试读取接口的模型列表，也可以手动填写。模型名称和可用能力取决于所选服务商。

官方 DeepSeek 接口会使用相应适配；代理接口按需手动选择适配类型。模型的思考内容与回答分开显示，生成时可以停止。

## 本地与云端

不配置 Supabase 时，可以用访客身份保存本地对话。访客记录不会因为登录而自动上传。

需要账号同步时，按[仓库 README](https://github.com/xiersiki/xier#账号与云端)配置自己的 Supabase 项目和 OAuth 回调。客户端只能使用公开的 publishable/anon key，不能放入服务端密钥。云端同步不是本地数据备份的替代品。

## 检查与反馈

遇到问题，在 [GitHub Issues](https://github.com/xiersiki/xier/issues) 提供应用版本、操作系统、复现步骤和脱敏日志。不要附上模型 Key 或私人聊天记录。
