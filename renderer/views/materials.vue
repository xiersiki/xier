<script setup lang="ts">
import {
  materialErrorMessages as messages,
  explainMaterialError,
} from "../utils/materialErrors";
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { isWellFormedMaterialText } from "../../common/materials";
import type {
  ImportJob,
  MaterialSummary,
  TextPage,
  MaterialEvent,
} from "../../common/materials";
import ImportPanel from "../components/Materials/ImportPanel.vue";
import MaterialList from "../components/Materials/MaterialList.vue";
import MaterialPreview from "../components/Materials/MaterialPreview.vue";
const api = window.api.materials;
const query = ref(""),
  items = ref<MaterialSummary[]>([]),
  jobs = ref<ImportJob[]>([]),
  cursor = ref<string | null>(null),
  jobCursor = ref<string | null>(null);
const usage = ref({ documents: 0, bytes: 0 }),
  busy = ref(false),
  importing = ref(false),
  previewBusy = ref(false),
  selected = ref<MaterialSummary | null>(null),
  page = ref<TextPage | null>(null),
  confirmRemove = ref(false);
const stopping = ref<string[]>([]),
  unknownRequest = ref<string | null>(null),
  error = ref(""),
  notice = ref(""),
  serviceUnavailable = ref(false),
  searchInput = ref<HTMLInputElement>();
let scopeReady = true;
let alive = true,
  scope = 0,
  searchGeneration = 0,
  previewGeneration = 0,
  activeQuery: string | undefined,
  unsubscribe: undefined | (() => void),
  timer: ReturnType<typeof setTimeout> | undefined;

function report(value: unknown) {
  if (alive) error.value = explainMaterialError(value);
}
function setJob(job: ImportJob) {
  jobs.value = [
    job,
    ...jobs.value.filter((j) => j.requestId !== job.requestId),
  ].sort((a, b) => b.createdAt - a.createdAt);
}
function clear() {
  query.value = "";
  importing.value = false;
  busy.value = false;
  previewBusy.value = false;
  confirmRemove.value = false;
  serviceUnavailable.value = false;
  scope++;
  searchGeneration++;
  previewGeneration++;
  items.value = [];
  jobs.value = [];
  selected.value = null;
  page.value = null;
  usage.value = { documents: 0, bytes: 0 };
  cursor.value = null;
  jobCursor.value = null;
  stopping.value = [];
  unknownRequest.value = null;
  error.value = "";
  notice.value = "";
}
async function search(more = false) {
  if (!isWellFormedMaterialText(query.value)) {
    error.value = "搜索词含无法识别的字符，请重新输入。";
    busy.value = false;
    return;
  }
  if (Array.from(query.value.trim()).length > 128) {
    error.value = "搜索词最多 128 个字符，请缩短后重试。";
    busy.value = false;
    return;
  }
  const generation = ++searchGeneration,
    epoch = scope;
  if (activeQuery) void api.cancelSearch(activeQuery).catch(() => {});
  const queryId = crypto.randomUUID();
  activeQuery = queryId;
  busy.value = true;
  error.value = "";
  try {
    const result = await api.search({
      queryId,
      text: query.value,
      cursor: more ? (cursor.value ?? undefined) : undefined,
    });
    if (!alive || scope !== epoch || generation !== searchGeneration) return;
    items.value = more ? [...items.value, ...result.items] : result.items;
    cursor.value = result.cursor;
    usage.value = result.usage;
  } catch (value) {
    if (
      alive &&
      epoch === scope &&
      generation === searchGeneration &&
      !String(value).includes("CANCELLED")
    ) {
      if (String(value).includes("STALE_CURSOR")) {
        cursor.value = null;
        void search();
      } else report(value);
    }
  } finally {
    if (alive && generation === searchGeneration) busy.value = false;
  }
}
async function history(more = false) {
  const epoch = scope;
  try {
    const result = await api.listImports({
      cursor: more ? (jobCursor.value ?? undefined) : undefined,
    });
    if (!alive || epoch !== scope) return;
    jobs.value = more ? [...jobs.value, ...result.items] : result.items;
    jobCursor.value = result.cursor;
  } catch (value) {
    if (epoch === scope) report(value);
  }
}
async function load() {
  await Promise.all([search(), history()]);
}
async function importFiles(retryOf?: string) {
  const epoch = scope;
  importing.value = true;
  error.value = "";
  try {
    const selection = await api.chooseFiles();
    if (!selection || !alive || epoch !== scope) return;
    const requestId = crypto.randomUUID();
    unknownRequest.value = requestId;
    const job = await api.startImport({
      requestId,
      selectionId: selection.selectionId,
      retryOf,
    });
    if (!alive || epoch !== scope) return;
    setJob(job);
    unknownRequest.value = null;
    void search();
  } catch (value) {
    if (epoch === scope) report(value);
  } finally {
    if (alive && epoch === scope) importing.value = false;
  }
}
async function verify(id: string) {
  const epoch = scope;
  try {
    const job = await api.getImport(id);
    if (!alive || epoch !== scope) return;
    if (job) {
      setJob(job);
      if (!["running", "queued", "cancelling"].includes(job.status)) {
        unknownRequest.value = null;
        stopping.value = stopping.value.filter((value) => value !== id);
      } else notice.value = "任务尚未结束，可再次停止导入或重启资料服务核对。";
      void search();
    } else notice.value = "尚未发现此任务。请稍后再次查询，或重新选择文件。";
  } catch (value) {
    if (epoch === scope) report(value);
  }
}
async function cancel(id: string) {
  const epoch = scope;
  stopping.value.push(id);
  try {
    const job = await api.cancelImport(id);
    if (!alive || epoch !== scope) return;
    setJob(job);
    stopping.value = stopping.value.filter((value) => value !== id);
    void search();
  } catch (value) {
    if (epoch === scope) {
      unknownRequest.value = id;
      serviceUnavailable.value = true;
      stopping.value = stopping.value.filter((value) => value !== id);
      report(value);
    }
  }
}
async function preview(item: MaterialSummary, offset = 0) {
  const generation = ++previewGeneration,
    epoch = scope;
  selected.value = item;
  page.value = null;
  confirmRemove.value = false;
  previewBusy.value = true;
  try {
    const result = await api.readText({ documentId: item.id, offset });
    if (alive && epoch === scope && generation === previewGeneration)
      page.value = result;
  } catch (value) {
    if (epoch === scope && generation === previewGeneration) report(value);
  } finally {
    if (alive && generation === previewGeneration) previewBusy.value = false;
  }
}
async function copy() {
  const item = selected.value,
    epoch = scope;
  if (!item) return;
  try {
    await api.copyText(item.id);
    if (alive && epoch === scope) notice.value = "已复制全文";
  } catch (value) {
    if (epoch === scope) report(value);
  }
}
async function remove() {
  const item = selected.value,
    epoch = scope;
  if (!item) return;
  try {
    await api.removeMaterial(item.id);
    if (!alive || epoch !== scope) return;
    selected.value = null;
    page.value = null;
    confirmRemove.value = false;
    notice.value = "已移除本机副本，原文件已保留";
    await load();
  } catch (value) {
    if (epoch === scope) report(value);
  }
}
async function restart() {
  try {
    await api.restartService();
    if (alive) {
      serviceUnavailable.value = false;
      await load();
    }
  } catch (value) {
    report(value);
  }
}
function onEvent(event: MaterialEvent) {
  if (event.type === "scope") {
    scopeReady = !!event.lease;
    clear();
    if (event.lease) void load();
  } else if (event.type === "job") {
    setJob(event.job);
    if (!["running", "queued", "cancelling"].includes(event.job.status))
      void search();
  } else {
    serviceUnavailable.value = event.status === "unavailable";
    if (serviceUnavailable.value) {
      error.value = messages[event.error ?? ""] ?? messages.SERVICE_UNAVAILABLE;
      unknownRequest.value =
        jobs.value.find((job) =>
          ["running", "queued", "cancelling"].includes(job.status),
        )?.requestId ?? unknownRequest.value;
    }
  }
}
function keyboard(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    searchInput.value?.focus();
    searchInput.value?.select();
  }
  if (event.key === "Escape") {
    selected.value = null;
    page.value = null;
    previewGeneration++;
  }
}
watch(query, () => {
  if (!scopeReady) return;
  searchGeneration++;
  if (activeQuery) void api.cancelSearch(activeQuery).catch(() => {});
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void search(), 200);
});
onMounted(() => {
  unsubscribe = api.observeImports(onEvent);
  window.addEventListener("keydown", keyboard);
  void load();
});
onBeforeUnmount(() => {
  alive = false;
  scope++;
  searchGeneration++;
  previewGeneration++;
  if (timer) clearTimeout(timer);
  unsubscribe?.();
  if (activeQuery) void api.cancelSearch(activeQuery).catch(() => {});
  window.removeEventListener("keydown", keyboard);
});
</script>
<template>
  <div class="materials-view">
    <div class="library" :class="{ reading: selected }">
      <header class="library-heading">
        <div>
          <p class="eyebrow">XIER / LOCAL LIBRARY</p>
          <h1>本地资料库</h1>
          <p>你的文字资料，随时离线查阅。</p>
        </div>
        <span class="usage"
          >{{ usage.documents }} / 500 份<br />{{
            (usage.bytes / 1024 / 1024).toFixed(1)
          }}
          / 100 MiB</span
        >
      </header>
      <label class="search"
        ><span class="sr-only">搜索资料</span
        ><input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="搜索标题或正文…"
          maxlength="256"
          aria-label="搜索资料"
        /><kbd>⌘ / Ctrl K</kbd></label
      >
      <div v-if="error" class="error" role="alert">
        <p>{{ error }}</p>
        <button @click="load">刷新资料</button
        ><button v-if="serviceUnavailable" @click="restart">
          重启资料服务
        </button>
      </div>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <div class="library-scroll">
        <MaterialList
          :items="items"
          :selected="selected?.id ?? null"
          :busy="busy"
          :more="!!cursor"
          :filtered="!!query.trim()"
          @select="(item) => preview(item)"
          @more="search(true)"
        />
        <ImportPanel
          :jobs="jobs"
          :stopping="stopping"
          :busy="importing"
          :unknown-request="unknownRequest"
          :more="!!jobCursor"
          @import="importFiles()"
          @cancel="cancel"
          @retry="importFiles"
          @verify="verify"
          @more="history(true)"
        />
      </div>
    </div>
    <MaterialPreview
      v-if="selected"
      :item="selected"
      :page="page"
      :busy="previewBusy"
      :confirm-remove="confirmRemove"
      @close="
        selected = null;
        previewGeneration++;
      "
      @copy="copy"
      @remove="confirmRemove = true"
      @confirm="remove"
      @abort="confirmRemove = false"
      @next="
        page?.nextOffset !== null &&
        page &&
        preview(selected!, page.nextOffset!)
      "
      @previous="page && preview(selected!, Math.max(0, page.offset - 20000))"
    />
  </div>
</template>
<style scoped>
.materials-view {
  height: 100%;
  display: flex;
  overflow: hidden;
  color: var(--text-primary);
}
.library {
  flex: 1;
  min-width: 330px;
  padding: 28px 32px 0;
  display: flex;
  flex-direction: column;
}
.library.reading {
  flex: 0 0 48%;
  max-width: 520px;
}
.library-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--text-secondary);
  margin: 0 0 10px;
}
h1 {
  font-size: 23px;
  letter-spacing: -0.5px;
  font-weight: 550;
  margin: 0 0 8px;
}
.library-heading p:last-child {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 0;
}
.usage {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  line-height: 1.9;
  color: var(--text-secondary);
  text-align: right;
  white-space: nowrap;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 12px;
  margin-bottom: 12px;
}
.search:focus-within {
  outline: 2px solid var(--text-secondary);
  outline-offset: 2px;
}
.search input {
  width: 100%;
  font-size: 13px;
  background: transparent;
  border: 0;
  outline: 0;
  min-width: 0;
  color: inherit;
}
.search kbd {
  font:
    10px ui-monospace,
    monospace;
  color: var(--text-secondary);
  white-space: nowrap;
}
.library-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 16px;
}
.error,
.notice {
  font-size: 12px;
  line-height: 1.7;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 0 0 12px;
}
.error {
  border-left: 3px solid #b75a46;
}
.error p {
  margin: 0 0 6px;
}
.error button + button {
  margin-left: 8px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
:deep(button) {
  cursor: pointer;
}
:deep(button:disabled) {
  cursor: default;
  opacity: 0.45;
}
:deep(button:focus-visible),
:deep(summary:focus-visible),
:deep(pre:focus-visible) {
  outline: 2px solid var(--text-secondary);
  outline-offset: 3px;
}
:deep(button:not(.primary):not(.material-name)) {
  border: 1px solid var(--line);
  background: transparent;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-primary);
}
:deep(button.primary) {
  border: 1px solid var(--text-primary);
  border-radius: 6px;
  background: var(--text-primary);
  color: var(--bg-color);
  padding: 8px 13px;
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 850px) {
  .library {
    padding: 20px 18px 0;
  }
  .library.reading {
    display: none;
  }
  .materials-view :deep(.preview) {
    border: 0;
    min-width: 0;
  }
}
</style>
