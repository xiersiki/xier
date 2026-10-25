<script setup lang="ts">
import { ref } from 'vue';
import type { ContextSelectionProps, ContextSelectionEmits } from '../../../../common/content/contracts';
const props = defineProps<ContextSelectionProps>();
const emit = defineEmits<ContextSelectionEmits>();
const requirement = ref('让表达更清晰，保留原意');
const presets = ['让表达更清晰，保留原意', '精简文字，保留关键信息', '调整为更自然的语气'];
function submit() { if (!props.disabledReason && requirement.value.trim()) emit('submit', requirement.value.trim()); }
</script>
<template>
  <section class="context-selection">
    <div class="panel-heading"><h2>选区与要求</h2><span>{{ count }} / {{ limit }} 字</span></div>
    <blockquote class="selection-excerpt">{{ selectedText || '在左侧正文中选择一段文字，开始改写。' }}</blockquote>
    <form @submit.prevent="submit">
      <fieldset><legend>改写方向</legend><div class="presets">
        <button v-for="preset in presets" :key="preset" type="button" :aria-pressed="requirement === preset" @click="requirement = preset">{{ preset.split('，')[0] }}</button>
      </div></fieldset>
      <label>具体要求<textarea v-model="requirement" rows="3" maxlength="1000" placeholder="例如：保留第一人称，语气更简洁" /></label>
      <p v-if="disabledReason" class="muted" role="status">{{ disabledReason }}</p>
      <div class="actions"><button class="primary" type="submit" :disabled="!!disabledReason || !requirement.trim()">生成改写建议</button><button type="button" @click="emit('cancel')">清除选区</button></div>
    </form>
  </section>
</template>
<style scoped>
.context-selection { padding: 20px; } .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; } h2 { font-size: 14px; font-weight: 600; margin: 0; } span, .muted { font-size: 12px; color: var(--text-secondary); }
.selection-excerpt { max-height: 150px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; margin: 16px 0; padding: 12px; border-left: 2px solid var(--accent-ink); background: var(--bg-secondary); font-size: 13px; line-height: 1.7; }
fieldset { border: 0; padding: 0; margin: 0 0 16px; } legend, label { font-size: 12px; color: var(--text-secondary); } .presets { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; } button[aria-pressed="true"] { border-color: var(--accent-ink); background: var(--accent-soft); }
textarea { display: block; width: 100%; box-sizing: border-box; margin: 8px 0 14px; resize: vertical; padding: 10px; border: 1px solid var(--line); border-radius: 8px; color: var(--text-primary); background: var(--input-bg); font: inherit; line-height: 1.6; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; } button { cursor: pointer; border: 1px solid var(--line); border-radius: 7px; padding: 7px 10px; background: var(--surface); color: var(--text-primary); font-size: 12px; } .primary { background: var(--accent-ink); color: var(--surface); } button:disabled { opacity: .45; cursor: default; }
</style>
