import { computed, onScopeDispose, ref } from 'vue';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { ContentController, characterCount, DOCUMENT_LIMIT, SELECTION_LIMIT } from '../controller';
import type { AgentPort } from '../../../../common/content/contracts';

export function useContentEditor(port: AgentPort, scopeId: string) {
  const controller = new ContentController(port, scopeId, [
    markdown(), keymap.of([...defaultKeymap, ...historyKeymap]), EditorView.lineWrapping,
    placeholder('写下你的草稿，或导入一份 Markdown / 文本副本。'),
    EditorView.contentAttributes.of({ 'aria-label': '正文', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'false' }),
    EditorView.theme({
      '&': { height: '100%', color: 'var(--text-primary)', backgroundColor: 'transparent' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.9' },
      '.cm-content': { padding: '28px 32px', minHeight: '260px', caretColor: 'var(--accent-ink)' },
      '&.cm-focused': { outline: 'none' },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft)' },
      '.cm-placeholder': { color: 'var(--text-secondary)' },
    }),
  ]);
  const version = ref(0);
  const unsubscribe = controller.subscribe(() => version.value++);
  const view = computed(() => {
    void version.value;
    return { state: controller.state, draftId: controller.draftId, title: controller.title, drafts: controller.drafts,
      suggestion: controller.suggestion, status: controller.status, errorMessage: controller.errorMessage,
      selection: controller.selectionText, selectionCount: characterCount(controller.selectionText),
      documentCount: characterCount(controller.state.doc.toString()), documentLimit: DOCUMENT_LIMIT, selectionLimit: SELECTION_LIMIT,
      disabledReason: controller.busy ? '请先处理正在运行或待核实的任务' : controller.selectionProblem,
      canAccept: controller.canAccept, canCancel: controller.canCancel,
    };
  });
  onScopeDispose(() => { unsubscribe(); controller.dispose(); });
  return { controller, view };
}
