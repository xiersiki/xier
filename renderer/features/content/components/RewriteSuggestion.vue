<script setup lang="ts">
import { computed } from 'vue';
import { presentableDiff } from '@codemirror/merge';
import type { RewriteSuggestionProps, RewriteSuggestionEmits } from '../../../../common/content/contracts';
const props = defineProps<RewriteSuggestionProps>();
const emit = defineEmits<RewriteSuggestionEmits>();
const labels = { pending: '等待结果', reviewable: '待审阅', stale: '正文已变化，建议已过期', applied: '已接受', rejected: '已拒绝' };
const changes = computed(() => presentableDiff(props.before, props.after, { scanLimit: 2000, timeout: 30 }));
function segments(side: 'before' | 'after') {
  const text = props[side]; let cursor = 0; const result: { text: string; changed: boolean }[] = [];
  for (const change of changes.value) {
    const from = side === 'before' ? change.fromA : change.fromB;
    const to = side === 'before' ? change.toA : change.toB;
    if (from > cursor) result.push({ text: text.slice(cursor, from), changed: false });
    if (to > from) result.push({ text: text.slice(from, to), changed: true });
    cursor = to;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), changed: false });
  return result;
}
const beforeParts = computed(() => segments('before'));
const afterParts = computed(() => segments('after'));
</script>
<template>
  <section class="rewrite-suggestion" aria-label="改写建议">
    <div class="heading"><h2>审阅改写</h2><span role="status">{{ labels[status] }}</span></div>
    <div class="diff-block"><h3>原文 · <span>删去以删除线标记</span></h3><p><template v-for="(part, index) in beforeParts" :key="index"><del v-if="part.changed">{{ part.text }}</del><template v-else>{{ part.text }}</template></template></p></div>
    <div class="diff-block"><h3>建议 · <span>新增以下划线标记</span></h3><p><template v-for="(part, index) in afterParts" :key="index"><ins v-if="part.changed">{{ part.text }}</ins><template v-else>{{ part.text }}</template></template></p></div>
    <p v-if="explanation" class="explanation">{{ explanation }}</p>
    <div class="actions"><button data-action="accept" class="primary" :disabled="!canAccept || status !== 'reviewable'" @click="emit('accept')">接受并替换选区</button><button data-action="reject" :disabled="!['reviewable', 'stale'].includes(status)" @click="emit('reject')">拒绝</button><button data-action="copy" @click="emit('copy')">复制建议</button></div>
  </section>
</template>
<style scoped>
.rewrite-suggestion { padding: 20px; border-top: 1px solid var(--line); } .heading { display: flex; justify-content: space-between; gap: 12px; align-items: start; } h2 { font-size: 14px; margin: 0; } .heading span, .explanation { color: var(--text-secondary); font-size: 12px; line-height: 1.6; } .diff-block { margin: 16px 0; } h3 { font-size: 12px; margin: 0 0 8px; } h3 span { color: var(--text-secondary); font-weight: 400; }
p { white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; margin: 0; font-size: 14px; line-height: 1.8; } .diff-block p { padding: 12px; border: 1px solid var(--line); border-radius: 8px; max-height: 240px; overflow: auto; } del { background: #dc655c1c; text-decoration-thickness: 1px; } ins { background: #458f7521; text-underline-offset: 3px; } .explanation { margin: 12px 0; } .actions { display: flex; gap: 8px; flex-wrap: wrap; } button { cursor: pointer; border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; background: var(--surface); color: var(--text-primary); font-size: 12px; } .primary { background: var(--accent-ink); color: var(--surface); } button:disabled { opacity: .45; cursor: default; }
</style>
