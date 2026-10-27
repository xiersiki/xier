<script setup lang="ts">
import type { MaterialSummary, TextPage } from "../../../common/materials";
defineProps<{
  item: MaterialSummary;
  page: TextPage | null;
  busy: boolean;
  confirmRemove: boolean;
}>();
defineEmits<{
  close: [];
  copy: [];
  remove: [];
  confirm: [];
  abort: [];
  next: [];
  previous: [];
}>();
</script>
<template>
  <aside class="preview" aria-label="资料预览">
    <header>
      <div>
        <span class="eyebrow">只读副本</span>
        <h2>{{ item.name }}</h2>
      </div>
      <button aria-label="关闭预览" @click="$emit('close')">×</button>
    </header>
    <div class="preview-actions">
      <button :disabled="busy || !page" @click="$emit('copy')">复制全文</button
      ><button @click="$emit('remove')">移除副本</button>
    </div>
    <div v-if="confirmRemove" class="remove-confirm" role="alert">
      <p>移除“{{ item.name }}”的本机副本？原文件会保留。</p>
      <button @click="$emit('confirm')">确认移除</button
      ><button @click="$emit('abort')">保留副本</button>
    </div>
    <p v-if="busy" role="status">正在读取…</p>
    <pre v-else-if="page" tabindex="0" aria-label="资料正文">{{
      page.text
    }}</pre>
    <footer v-if="page">
      <button :disabled="page.offset === 0 || busy" @click="$emit('previous')">
        上一段</button
      ><span>第 {{ Math.floor(page.offset / 20000) + 1 }} 段</span
      ><button
        :disabled="page.nextOffset === null || busy"
        @click="$emit('next')"
      >
        下一段
      </button>
    </footer>
  </aside>
</template>
<style scoped>
.preview {
  min-width: 280px;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  border-left: 1px solid var(--line);
  padding: 22px;
  overflow: hidden;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
h2 {
  font-size: 16px;
  font-weight: 550;
  overflow-wrap: anywhere;
  margin: 5px 0 16px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-secondary);
}
.preview-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
pre {
  flex: 1;
  min-height: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, "SFMono-Regular", monospace;
  font-size: 12px;
  line-height: 1.85;
  user-select: text;
  padding: 14px 0;
  margin: 0;
}
footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--text-secondary);
}
.remove-confirm {
  font-size: 12px;
  padding: 12px 0;
}
.remove-confirm button + button {
  margin-left: 8px;
}
</style>
