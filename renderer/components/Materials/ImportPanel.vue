<script setup lang="ts">
import { explainMaterialError } from "../../utils/materialErrors";
import type { ImportJob } from "../../../common/materials";
defineProps<{
  jobs: ImportJob[];
  stopping: string[];
  busy: boolean;
  unknownRequest: string | null;
  more: boolean;
}>();
defineEmits<{
  import: [];
  cancel: [id: string];
  retry: [id: string];
  verify: [id: string];
  more: [];
}>();
const labels: Record<string, string> = {
  queued: "等待导入",
  running: "正在导入",
  cancelling: "正在停止",
  completed: "已完成",
  cancelled: "已取消",
  failed: "导入失败",
  interrupted: "已中断",
  pending: "等待",
  reading: "正在读取",
  committing: "正在保存",
  imported: "已导入",
  duplicate: "已有相同内容",
};
</script>
<template>
  <section class="import-panel" aria-label="导入任务">
    <div class="import-heading">
      <div>
        <h2>导入记录</h2>
        <p>文件副本仅保存在本机，原文件保持原样。</p>
      </div>
      <button
        class="primary"
        :disabled="
          busy ||
          jobs.some((j) =>
            ['queued', 'running', 'cancelling'].includes(j.status),
          )
        "
        @click="$emit('import')"
      >
        导入资料
      </button>
    </div>
    <p v-if="unknownRequest" role="status">
      提交结果待核实，请先查询任务。<button
        @click="$emit('verify', unknownRequest)"
      >
        查询结果
      </button>
    </p>
    <details
      v-for="job in jobs"
      :key="job.requestId"
      :open="['running', 'cancelling'].includes(job.status)"
    >
      <summary>
        <span>{{
          stopping.includes(job.requestId) ? "正在停止" : labels[job.status]
        }}</span
        ><span
          >{{
            job.items.filter((i) =>
              ["imported", "duplicate", "failed"].includes(i.status),
            ).length
          }}
          / {{ job.items.length }} 项</span
        ><time>{{
          new Date(job.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        }}</time>
      </summary>
      <ul>
        <li v-for="(item, index) in job.items" :key="index">
          <span class="filename">{{ item.name }}</span
          ><span
            >{{
              item.removed ? "副本已移除" : labels[item.status] || item.status
            }}<template v-if="item.error">
              · {{ explainMaterialError(item.error) }}</template
            ></span
          >
        </li>
      </ul>
      <button
        v-if="['queued', 'running', 'cancelling'].includes(job.status)"
        :disabled="stopping.includes(job.requestId)"
        @click="$emit('cancel', job.requestId)"
      >
        停止导入
      </button>
      <button
        v-else-if="
          job.status !== 'completed' ||
          job.items.some((i) => i.status === 'failed')
        "
        @click="$emit('retry', job.requestId)"
      >
        重新选文件重试
      </button>
    </details>
    <button v-if="more" @click="$emit('more')">更早的导入记录</button>
  </section>
</template>
<style scoped>
.import-panel {
  border-top: 1px solid var(--line);
  padding: 18px 0;
}
.import-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
h2 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 5px 0 12px;
}
details {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
}
summary {
  display: flex;
  gap: 14px;
  align-items: center;
  cursor: pointer;
  list-style: none;
}
summary::before {
  content: "›";
  color: var(--text-secondary);
}
details[open] summary::before {
  transform: rotate(90deg);
}
time {
  margin-left: auto;
  color: var(--text-secondary);
}
ul {
  list-style: none;
  padding: 0;
  margin: 10px 0;
}
li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  color: var(--text-secondary);
}
.filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
  color: var(--text-primary);
}
</style>
