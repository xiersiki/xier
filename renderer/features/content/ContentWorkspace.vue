<script setup lang="ts">
import { ref } from 'vue';
import type { AgentPort, FilePort } from '../../../common/content/contracts';
import { useContentEditor } from './composables/useContentEditor';
import ContentEditor from './components/ContentEditor.vue';
import ContextSelection from './components/ContextSelection.vue';
import RewriteSuggestion from './components/RewriteSuggestion.vue';
import GenerationStatus from './components/GenerationStatus.vue';
const props = defineProps<{ port: AgentPort; files: FilePort; scopeId: string }>();
const { controller, view } = useContentEditor(props.port, props.scopeId);
const notice = ref('');
const fileInput = ref<HTMLInputElement>();
const reviewPanel = ref<HTMLElement>();
function sample() { controller.newDraft('表达练习.md', '我们希望通过持续改进产品中的每一个细节，让用户在日常使用的过程中获得更加清晰且顺畅的协作体验。'); }
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0];
  try {
    if (!file) return;
    const imported = await props.files.read(file);
    controller.importText(imported.name, imported.bytes);
    notice.value = '已导入副本，源文件不会被修改';
  } catch (error) { notice.value = error instanceof TypeError ? '无法读取，请使用 UTF-8 文本' : (error as Error).message; }
  finally { input.value = ''; }
}
async function copySuggestion() {
  const text = view.value.suggestion?.result?.replacement;
  if (text === undefined) return;
  try { await props.files.copy(text); notice.value = '已复制建议，正文未改变'; }
  catch { notice.value = '复制失败，可在建议区域选择文字后手动复制'; }
}
async function exportDraft() {
  try { await props.files.export(view.value.title, view.value.state.doc.toString()); notice.value = '已请求导出当前正文'; }
  catch { notice.value = '导出失败，请复制正文后自行保存'; }
}
function accept() { notice.value = controller.accept() ? '已替换原选区，可撤销本次改写' : '正文已变化，请重新选择后生成'; }
function retry() { reviewPanel.value?.querySelector('textarea')?.focus(); notice.value = '请确认当前选区和要求，再点击生成'; }
</script>
<template>
  <main class="content-workspace">
    <header class="workspace-header"><div><span class="eyebrow">XIER · CONTENT</span><h1>内容工作台 <span class="badge">固定示例</span></h1></div><div class="header-actions"><button data-action="sample" @click="sample">载入示例</button><button @click="controller.newDraft()">新建草稿</button><button @click="fileInput?.click()">导入副本</button><button @click="exportDraft">导出正文</button><input ref="fileInput" type="file" accept=".md,.txt" hidden @change="importFile" /></div></header>
    <div class="workspace-note">当前使用固定响应验证编辑流程。草稿仅保存在本次打开期间，离开前请导出。</div>
    <div class="workspace-body">
      <section class="document-panel" aria-label="草稿编辑">
        <div class="document-toolbar"><select :value="view.draftId" aria-label="当前草稿" @change="controller.selectDraft(($event.target as HTMLSelectElement).value)"><option v-for="draft in view.drafts" :key="draft.id" :value="draft.id">{{ draft.title }}</option></select><div><button data-action="select-all" @click="controller.select(0, view.state.doc.length)">全选</button><button data-action="undo" @click="controller.undo()">撤销</button><button @click="controller.redo()">重做</button></div></div>
        <div class="editor-area"><ContentEditor :state="view.state" @transaction="controller.dispatch" /></div>
        <footer>{{ view.documentCount.toLocaleString() }} / {{ view.documentLimit.toLocaleString() }} 字 · 超出上限的输入不会写入 <span>Markdown / 纯文本</span></footer>
      </section>
      <aside ref="reviewPanel" class="review-panel" aria-label="改写审阅">
        <ContextSelection :selected-text="view.selection" :count="view.selectionCount" :limit="view.selectionLimit" :disabled-reason="view.disabledReason" @submit="controller.generate($event)" @cancel="controller.select(view.state.selection.main.head, view.state.selection.main.head)" />
        <GenerationStatus :status="view.status" :can-cancel="view.canCancel" :error-message="view.errorMessage" @cancel="controller.cancel()" @refresh="controller.refresh()" @retry="retry" />
        <RewriteSuggestion v-if="view.suggestion?.result" :before="view.suggestion.before" :after="view.suggestion.result.replacement" :explanation="view.suggestion.result.explanation" :status="view.suggestion.status" :can-accept="view.canAccept" @accept="accept" @reject="controller.reject()" @copy="copySuggestion" />
        <div v-else class="review-empty"><span>01 选择文字　02 描述要求　03 审阅差异</span><p>改写建议会出现在这里。<br />接受之前，正文始终由你掌控。</p></div>
      </aside>
    </div>
    <div class="workspace-notice" role="status" aria-live="polite">{{ notice || '提示：选区按 Unicode 字符计数，最多 4,000 字；接受后可用 ⌘Z / Ctrl+Z 撤销。' }}</div>
  </main>
</template>
<style scoped>
.content-workspace { display: flex; flex-direction: column; height: 100%; min-height: 0; color: var(--text-primary); background: var(--bg-color); } .workspace-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 28px 18px; } .eyebrow { font-size: 10px; letter-spacing: .16em; color: var(--text-secondary); } h1 { display: flex; align-items: center; gap: 12px; margin: 6px 0 0; font-size: 22px; font-weight: 600; letter-spacing: -.03em; } .badge { font-size: 10px; font-weight: 400; letter-spacing: 0; padding: 4px 7px; border: 1px solid var(--line); border-radius: 5px; color: var(--text-secondary); } .header-actions { display: flex; flex-wrap: wrap; gap: 8px; } button { cursor: pointer; background: var(--surface); color: var(--text-primary); border: 1px solid var(--line); border-radius: 7px; padding: 7px 10px; font-size: 12px; } button:hover { background: var(--bg-secondary); } .workspace-note { padding: 10px 28px; font-size: 12px; line-height: 1.6; color: var(--text-secondary); border-block: 1px solid var(--line); background: var(--bg-secondary); } .workspace-body { flex: 1; display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 390px); min-height: 0; } .document-panel { display: flex; flex-direction: column; min-height: 0; min-width: 0; } .document-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 20px; border-bottom: 1px solid var(--line); } .document-toolbar select { min-width: 0; max-width: 50%; color: var(--text-primary); background: var(--bg-color); border: 0; font-size: 13px; padding: 5px; } .document-toolbar div { display: flex; gap: 4px; } .document-toolbar button { border-color: transparent; background: transparent; } .editor-area { flex: 1; min-height: 0; } footer { display: flex; justify-content: space-between; gap: 8px; padding: 12px 20px; font-size: 11px; color: var(--text-secondary); border-top: 1px solid var(--line); } .review-panel { overflow: auto; border-left: 1px solid var(--line); background: var(--surface); } .review-empty { padding: 28px 20px; color: var(--text-secondary); } .review-empty span { font-size: 10px; } .review-empty p { font-size: 13px; line-height: 1.9; } .workspace-notice { min-height: 36px; box-sizing: border-box; padding: 10px 20px; border-top: 1px solid var(--line); font-size: 11px; color: var(--text-secondary); }
@media (max-width: 780px) { .workspace-header { align-items: start; flex-direction: column; padding: 16px; gap: 12px; } .workspace-note { padding: 10px 16px; } .workspace-body { display: flex; flex-direction: column; overflow: auto; } .document-panel { min-height: 340px; flex-shrink: 0; } .review-panel { overflow: visible; border-left: 0; border-top: 1px solid var(--line); } footer span { display: none; } }
</style>
