import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Xier',
  description: '一张安静的 AI 对话桌面。连接自己的模型，保留自己的思考。',
  base: '/xier/',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/xier/mark.svg' }]],
  lastUpdated: true,
  themeConfig: {
    logo: '/mark.svg',
    nav: [
      { text: '开始使用', link: '/guide/getting-started' },
      { text: '下载与版本', link: '/download' },
      { text: '参与开发', link: '/guide/development' },
    ],
    sidebar: [
      { text: '使用 Xier', items: [
        { text: '开始使用', link: '/guide/getting-started' },
        { text: '下载与版本', link: '/download' },
        { text: '路线图', link: '/roadmap' },
      ] },
      { text: '一起开发', items: [{ text: '贡献指南', link: '/guide/development' }] },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/xiersiki/xier' }],
    outline: { label: '本页内容' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    search: { provider: 'local' },
    footer: { message: 'Xier · 让对话回到想法本身', copyright: '由个人项目持续构建' },
  },
})
