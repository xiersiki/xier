<template>
  <figure class="preview" aria-label="Xier 对话界面示意，内容为虚构示例">
    <div class="window-top" aria-hidden="true"><span class="window-dots">● ● ●</span><span class="window-name">Xier</span></div>
    <div class="window-body">
      <div class="sidebar" aria-hidden="true">
        <svg class="preview-mark" viewBox="0 0 32 32" fill="none"><path d="M8 6c0 10 16 10 16 20" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M24 6c0 10-16 10-16 20" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity=".48"/></svg>
        <p class="sidebar-label">对话</p>
        <p class="conversation active">把想法写下来</p>
        <p class="conversation">读书时的一个问题</p>
        <p class="conversation">周末的小计划</p>
        <div class="local-note">◌ 本地访客</div>
      </div>
      <div class="conversation-area">
        <div class="conversation-header">把想法写下来 <span class="model-label">示例模型⌄</span></div>
        <div class="messages">
          <p class="question">我有一个模糊的想法，<br>想把它变成能做出来的小项目。</p>
          <p class="thinking">⌄ 思考过程</p>
          <p class="answer">先留住最想解决的那个问题。<br><br>谁会用它？他们现在怎样解决？<br>第一版，只做一件真正有用的事。</p>
          <span class="response-mark" aria-hidden="true">✦</span>
        </div>
        <div class="composer" aria-hidden="true"><span>接着聊聊你的想法…</span><span class="send">↑</span></div>
      </div>
    </div>
    <figcaption class="preview-caption">界面示意 · 示例内容，不包含真实账号与对话</figcaption>
  </figure>
</template>

<style scoped>
.preview { margin: 0; min-width: 0; position: relative; border: 1px solid var(--xier-line); background: var(--xier-paper); border-radius: 12px; box-shadow: 0 20px 64px #2927330a; }
.window-top { height: 32px; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid var(--xier-line); position: relative; }
.window-dots { color: #ceccd5; font-size: 9px; letter-spacing: 3px; }
.window-name { color: var(--xier-muted); font-family: var(--xier-brand); font-size: 10px; position: absolute; left: 50%; }
.window-body { display: grid; grid-template-columns: 136px 1fr; min-height: 350px; }
.sidebar { background: var(--xier-silver); padding: 22px 12px 14px; display: flex; flex-direction: column; border-radius: 0 0 0 12px; }
.preview-mark { width: 28px; height: 28px; color: var(--xier-iris); margin-bottom: 24px; }
.sidebar-label { font-size: 9px; color: var(--xier-muted); padding: 0 9px; margin-bottom: 12px; }
.conversation { font-size: 10px; padding: 9px; color: var(--xier-muted); white-space: nowrap; }
.conversation.active { background: #e7e4ec; color: var(--xier-ink); border-radius: 6px; }
.local-note { margin-top: auto; color: var(--xier-muted); font-size: 10px; padding: 16px 8px 0; }
.conversation-area { padding: 18px; display: flex; flex-direction: column; min-width: 0; }
.conversation-header { font-size: 11px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.model-label { font-size: 9px; color: var(--xier-muted); }
.messages { padding: 30px 0 12px; font-size: 12px; line-height: 1.8; }
.question { padding: 9px 12px; background: var(--xier-silver); border-radius: 7px; width: fit-content; margin-left: auto; margin-bottom: 22px; }
.thinking { color: var(--xier-muted); font-size: 9px; margin-bottom: 8px; }
.answer { color: var(--xier-ink); }
.response-mark { display: block; color: var(--xier-iris); margin-top: 10px; }
.composer { margin-top: auto; border: 1px solid var(--xier-line); border-radius: 8px; padding: 9px 10px; font-size: 10px; display: flex; align-items: center; justify-content: space-between; color: var(--xier-muted); }
.send { background: var(--xier-iris); color: white; padding: 1px 6px; border-radius: 5px; font-size: 13px; }
.preview-caption { position: absolute; top: calc(100% + 14px); width: 100%; text-align: right; color: var(--xier-muted); font-size: 9px; }
@media (max-width: 640px) { .window-body { grid-template-columns: 86px 1fr; } .sidebar { padding: 18px 6px 12px; } .conversation { font-size: 8px; padding: 8px 4px; white-space: normal; } .conversation-area { padding: 14px 12px; } .conversation-header { font-size: 10px; } .model-label { display: none; } .messages { font-size: 11px; } .local-note { padding-left: 4px; font-size: 8px; } }
</style>
