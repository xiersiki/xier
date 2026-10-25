<script setup lang="ts">
import { withBase } from 'vitepress'
import ConversationPreview from './ConversationPreview.vue'

const capabilities = [
  { title: '模型由你选择', description: '连接 OpenAI 兼容服务，自定义模型 ID。DeepSeek 官方接口支持独立的思考模式设置。', detail: '自己的服务商 · 自己的 API Key' },
  { title: '对话留在手边', description: '历史记录保存在本机。不登录也能使用本地对话，需要时再配置账号与云端同步。', detail: '本地记录 · 可选同步' },
  { title: '思考与回答分开', description: '流式阅读回复，展开模型的思考过程。遇到截断或中断，界面明确保留当前状态。', detail: '流式输出 · 清晰状态' },
]
</script>

<template>
  <div class="xier-home">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">XIER / AI 对话桌面</p>
        <h1 id="hero-title" class="hero-title">给想法，<br>留一张安静的桌面。</h1>
        <p class="hero-description">连接自己的模型，接着上一次的思考。<br>从一个问题开始，让对话自然展开。</p>
        <div class="hero-actions">
          <a class="primary-link" :href="withBase('/download.html')">查看下载与版本 <span aria-hidden="true">↗</span></a>
          <a class="text-link" :href="withBase('/guide/getting-started.html')">从源码开始 →</a>
        </div>
        <p class="release-note">开发阶段 · macOS 优先验证 · 自备模型服务</p>
      </div>
      <ConversationPreview />
    </section>

    <section class="capabilities" aria-labelledby="capabilities-title">
      <div class="section-heading">
        <p class="eyebrow">让工具安静一点</p>
        <h2 id="capabilities-title">把注意力留给问题。</h2>
      </div>
      <div class="capability-list">
        <article v-for="item in capabilities" :key="item.title" class="capability">
          <h3 class="capability-title">{{ item.title }}</h3>
          <p class="capability-description">{{ item.description }}</p>
          <p class="capability-detail">{{ item.detail }}</p>
        </article>
      </div>
    </section>

    <section class="build-note" aria-labelledby="build-title">
      <div>
        <p class="eyebrow">一个持续生长的个人项目</p>
        <h2 id="build-title">每一步，都留下来路。</h2>
        <p class="build-description">在 GitHub 上记录问题、讨论改动和交付版本。<br>无论是开发者还是 Agent，会话结束，工作仍然可以继续。</p>
      </div>
      <a class="text-link" :href="withBase('/guide/development.html')">了解开发方式 →</a>
    </section>
  </div>
</template>

<style scoped>
.xier-home { max-width: 1200px; margin: auto; padding: 0 36px; }
.hero { display: grid; grid-template-columns: .9fr 1.1fr; align-items: center; gap: 44px; padding: 88px 0 90px; }
.eyebrow { color: var(--xier-muted); font-size: 11px; letter-spacing: .12em; margin-bottom: 24px; font-weight: 600; }
.hero-title { font-family: var(--xier-display); font-size: clamp(34px, 3.6vw, 52px); font-weight: 500; line-height: 1.35; letter-spacing: -.04em; }
.hero-description { margin-top: 24px; color: var(--xier-muted); font-size: 16px; line-height: 1.9; }
.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 24px; margin-top: 36px; }
.primary-link { display: inline-flex; gap: 24px; padding: 12px 18px; color: white; background: var(--xier-iris); border-radius: 8px; font-size: 14px; font-weight: 500; }
.primary-link:hover { background: var(--vp-c-brand-2); }
.text-link { color: var(--xier-iris); font-size: 14px; font-weight: 600; }
.text-link:hover { text-decoration: underline; text-underline-offset: 5px; }
.release-note { margin-top: 20px; font-size: 11px; color: var(--xier-muted); }
.capabilities { padding: 50px 0 72px; border-top: 1px solid var(--xier-line); }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; margin-bottom: 34px; }
.section-heading .eyebrow { margin: 0; }
.section-heading h2, .build-note h2 { font-family: var(--xier-display); font-size: 28px; font-weight: 500; line-height: 1.5; }
.capability-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; }
.capability-title { font-size: 18px; font-weight: 600; margin-bottom: 14px; }
.capability-description { font-size: 14px; line-height: 1.9; color: var(--xier-muted); }
.capability-detail { color: var(--xier-iris); font-size: 11px; margin-top: 22px; }
.build-note { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 46px 0 64px; border-top: 1px solid var(--xier-line); }
.build-note .eyebrow { margin-bottom: 16px; }
.build-description { color: var(--xier-muted); font-size: 14px; line-height: 1.9; margin-top: 18px; }
@media (max-width: 960px) { .hero { grid-template-columns: 1fr; gap: 44px; padding-top: 48px; } .hero-copy { max-width: 620px; } .hero-title { font-size: 44px; } }
@media (max-width: 640px) { .xier-home { padding: 0 22px; } .hero { padding: 40px 0 48px; } .hero-title { font-size: 36px; } .hero-description { font-size: 14px; } .hero-actions { gap: 18px; } .section-heading { display: block; } .section-heading .eyebrow { margin-bottom: 16px; } .capability-list { grid-template-columns: 1fr; gap: 32px; } .capabilities { padding: 34px 0 40px; } .capability-detail { margin-top: 10px; } .build-note { align-items: flex-start; flex-direction: column; padding: 36px 0; } }
</style>
