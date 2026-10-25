<script setup lang="ts">
import type { GenerationStatusProps, GenerationStatusEmits } from '../../../../common/content/contracts';
defineProps<GenerationStatusProps>(); const emit = defineEmits<GenerationStatusEmits>();
const labels = { ready: '准备就绪', running: '正在生成建议', cancelling: '等待取消确认', completed: '建议已返回，请审阅', failed: '生成失败', cancelled: '已取消', unknown: '任务状态待核实' };
</script>
<template>
  <div class="generation-status">
    <p role="status" aria-live="polite">{{ labels[status] }}<span v-if="errorMessage"> · {{ errorMessage }}</span></p>
    <div class="actions"><button v-if="canCancel" data-action="cancel" @click="emit('cancel')">取消生成</button><button v-if="status === 'unknown'" data-action="refresh" @click="emit('refresh')">核实状态</button><button v-if="['failed', 'cancelled'].includes(status)" data-action="retry" @click="emit('retry')">重新选择并生成</button></div>
  </div>
</template>
<style scoped>
.generation-status { padding: 12px 20px; background: var(--bg-secondary); border-block: 1px solid var(--line); } p { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.6; } .actions { display: flex; gap: 12px; } button { color: var(--accent-ink); background: none; border: 0; padding: 8px 0 0; font-size: 12px; cursor: pointer; }
</style>
