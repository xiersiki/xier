<script setup lang="ts">
import type { MaterialSummary } from "../../../common/materials";
defineProps<{
  items: MaterialSummary[];
  selected: string | null;
  busy: boolean;
  more: boolean;
  filtered: boolean;
}>();
defineEmits<{ select: [item: MaterialSummary]; more: [] }>();
</script>
<template>
  <section aria-label="资料列表" :aria-busy="busy">
    <div class="list-head"><span>名称</span><span>大小</span></div>
    <ul v-if="items.length">
      <li
        v-for="item in items"
        :key="item.id"
        :class="{ selected: item.id === selected }"
      >
        <button
          class="material-name"
          :aria-pressed="item.id === selected"
          @click="$emit('select', item)"
        >
          {{ item.name }}</button
        ><span>{{ (item.bytes / 1024).toFixed(1) }} KB</span>
      </li>
    </ul>
    <div v-else class="empty">
      <h2>
        {{ filtered ? "没有找到匹配资料" : "把需要随时查阅的文字放在这里" }}
      </h2>
      <p>
        {{
          filtered
            ? "试试更短的关键词，支持中文、英文和标点的字面搜索。"
            : "导入 TXT 或 Markdown 后，即可离线搜索和阅读。每份不超过 2 MiB。"
        }}
      </p>
    </div>
    <button v-if="more" :disabled="busy" @click="$emit('more')">
      加载更多资料
    </button>
  </section>
</template>
<style scoped>
.list-head,
li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.list-head {
  color: var(--text-secondary);
  font-size: 11px;
  padding: 12px 10px;
  border-bottom: 1px solid var(--line);
}
ul {
  padding: 0;
  list-style: none;
  margin: 0;
}
li {
  padding: 4px 10px;
  border-bottom: 1px solid var(--line);
  border-radius: 6px;
}
li.selected {
  background: var(--hover-bg, rgba(128, 128, 128, 0.1));
}
li button {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  background: none;
  padding: 11px 0;
  font-size: 13px;
  color: var(--text-primary);
}
li span {
  font-size: 11px;
  color: var(--text-secondary);
}
.empty {
  text-align: center;
  padding: 45px 15px;
}
h2 {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 12px;
}
.empty p {
  color: var(--text-secondary);
  font-size: 12px;
  max-width: 320px;
  margin: auto;
  line-height: 1.8;
}
</style>
