<script setup lang="ts">
import type { Message } from '@common/types';
import MessageRender from './MessageRender.vue';

defineProps<{ message: Message }>();
</script>

<template>
  <details v-if="message.reasoningContent" class="reasoning">
    <summary>{{ message.status === 'streaming' && !message.content ? '正在思考…' : '查看思考过程' }}</summary>
    <div class="reasoning-text">{{ message.reasoningContent }}</div>
  </details>
  <MessageRender v-if="message.content" :msg-id="message.id" :content="message.content"
    :is-streaming="message.status === 'streaming'" />
  <span v-else-if="message.status === 'loading' || message.status === 'streaming'" role="status">
    {{ message.reasoningContent ? '正在组织回答…' : '等待模型回复…' }}
  </span>
  <p v-if="message.error" role="alert" class="notice error">{{ message.error }}</p>
  <p v-else-if="message.finishReason === 'length'" class="notice">已达到模型输出上限，回答可能不完整。</p>
  <p v-else-if="message.finishReason === 'cancelled'" class="notice">已停止生成</p>
</template>

<style scoped>
.reasoning { margin: 0 0 15px; font-size: 12px; color: var(--text-secondary); }
summary { cursor: pointer; width: fit-content; padding: 5px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-color); }
summary:hover { color: var(--text-primary); }
.reasoning-text { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 20rem; overflow-y: auto; margin: 12px 0; border-left: 2px solid var(--line); padding: 2px 0 2px 14px; line-height: 1.8; }
.notice { margin: 12px 0 0; font-size: 12px; color: var(--text-secondary); }
.error { color: #cf5965; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, #cf5965 7%, transparent); }
[role="status"] { font-size: 13px; color: var(--text-secondary); }
</style>
