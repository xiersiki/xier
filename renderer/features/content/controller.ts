import { EditorState, type Extension, Transaction } from '@codemirror/state';
import { history, undo, redo, isolateHistory } from '@codemirror/commands';
import type { AgentPort, RewriteResult, GenerationStatusValue, SuggestionStatus, RunSnapshot } from '../../../common/content/contracts';

export const DOCUMENT_LIMIT = 20000;
export const SELECTION_LIMIT = 4000;
export const characterCount = (text: string) => Array.from(text).length;
export interface Suggestion {
  requestId: string; draftId: string; scopeId: string; revision: number;
  from: number; to: number; before: string; status: SuggestionStatus; result?: RewriteResult;
}
interface Draft {
  id: string; title: string; state: EditorState; revision: number;
  suggestion?: Suggestion; status: GenerationStatusValue; errorMessage?: string;
}
interface ActiveRun { requestId: string; draft: Draft; receive: (snapshot: RunSnapshot) => void; detach: () => void }

/** The editor state is the document's only source of truth. No model response writes it. */
export class ContentController {
  private records = new Map<string, Draft>();
  private currentId = '';
  private disposed = false;
  private listeners = new Set<() => void>();
  private active?: ActiveRun;
  constructor(readonly port?: AgentPort, readonly scopeId = 'guest', private extensions: Extension = []) { this.newDraft(); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { if (!this.disposed) this.listeners.forEach(listener => listener()); }
  dispose() {
    this.disposed = true;
    this.active?.detach();
    if (this.active && this.port) void this.port.cancel(this.active.requestId).catch(() => {});
    this.active = undefined;
    this.listeners.clear();
  }
  private get current() { return this.records.get(this.currentId)!; }
  get state() { return this.current.state; }
  get revision() { return this.current.revision; }
  get draftId() { return this.current.id; }
  get title() { return this.current.title; }
  get suggestion() { return this.current.suggestion; }
  get status() { return this.current.status; }
  get errorMessage() { return this.current.errorMessage; }
  get busy() { return !!this.active; }
  get canCancel() { return this.active?.draft === this.current && ['running', 'unknown'].includes(this.status); }
  get selectionText() { const { from, to } = this.state.selection.main; return this.state.sliceDoc(from, to); }
  get selectionProblem(): string | undefined {
    const { from, to } = this.state.selection.main;
    if (from === to) return '请先选择要修改的文本';
    if (characterCount(this.selectionText) > SELECTION_LIMIT) return '选区不能超过 4,000 字';
    const text = this.state.doc.toString();
    const splitsPair = (at: number) => at > 0 && at < text.length && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]);
    if (splitsPair(from) || splitsPair(to)) return '请选择完整字符';
    return undefined;
  }
  get canAccept() {
    const proposal = this.suggestion;
    return !!proposal?.result && proposal.status === 'reviewable' && proposal.revision === this.revision &&
      proposal.draftId === this.draftId && proposal.scopeId === this.scopeId &&
      this.state.sliceDoc(proposal.from, proposal.to) === proposal.before;
  }
  get drafts() { return [...this.records.values()].map(({ id, title }) => ({ id, title })); }
  newDraft(title = '未命名草稿', text = '') {
    if (this.disposed) return;
    if (characterCount(text) > DOCUMENT_LIMIT) throw new Error('正文不能超过 20,000 字');
    const id = crypto.randomUUID();
    const state = EditorState.create({ doc: text, extensions: [history(), this.extensions,
      EditorState.changeFilter.of(tr => !tr.docChanged || characterCount(tr.newDoc.toString()) <= DOCUMENT_LIMIT),
    ] });
    this.records.set(id, { id, title, state, revision: 0, status: 'ready' });
    this.currentId = id;
    this.notify();
  }
  dispatch = (transaction: Transaction) => {
    if (this.disposed || transaction.startState !== this.state) return;
    this.current.state = transaction.state;
    if (transaction.docChanged) {
      this.current.revision++;
      if (this.suggestion && ['pending', 'reviewable'].includes(this.suggestion.status)) this.current.suggestion = { ...this.suggestion, status: 'stale' };
    }
    this.notify();
  };
  select(from: number, to: number) { this.dispatch(this.state.update({ selection: { anchor: from, head: to } })); }
  undo() { return undo(this); }
  redo() { return redo(this); }
  accept(): boolean {
    if (!this.canAccept || this.disposed) return false;
    const proposal = this.suggestion!;
    this.current.suggestion = { ...proposal, status: 'applied' };
    this.dispatch(this.state.update({ changes: { from: proposal.from, to: proposal.to, insert: proposal.result!.replacement },
      annotations: isolateHistory.of('full'), userEvent: 'input.acceptSuggestion' }));
    return true;
  }
  reject(): void {
    if (this.suggestion && ['reviewable', 'stale'].includes(this.suggestion.status)) this.current.suggestion = { ...this.suggestion, status: 'rejected' };
    this.notify();
  }
  selectDraft(draftId: string): void { if (this.records.has(draftId)) this.currentId = draftId; this.notify(); }
  async generate(requirement: string): Promise<void> {
    if (this.disposed || !this.port || this.active || this.selectionProblem || !requirement.trim()) return;
    const draft = this.current;
    const { from, to } = this.state.selection.main;
    const before = this.state.sliceDoc(from, to);
    const requestId = crypto.randomUUID();
    const proposal: Suggestion = { requestId, draftId: this.draftId, scopeId: this.scopeId, revision: this.revision, from, to, before, status: 'pending' };
    draft.suggestion = proposal;
    draft.status = 'running';
    draft.errorMessage = undefined;
    let sequence = -1;
    let terminal = false;
    let detach = () => {};
    const receive = (snapshot: RunSnapshot) => {
      if (this.disposed || terminal || snapshot.requestId !== requestId || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence <= sequence) return;
      sequence = snapshot.sequence;
      draft.status = snapshot.status;
      draft.errorMessage = undefined;
      if (snapshot.status === 'completed') {
        const result = snapshot.result;
        if (!result || typeof result.replacement !== 'string' || !result.replacement.trim() ||
            (result.explanation !== undefined && typeof result.explanation !== 'string') ||
            characterCount(draft.state.doc.toString()) - characterCount(before) + characterCount(result.replacement) > DOCUMENT_LIMIT) {
          draft.status = 'failed'; draft.errorMessage = '建议格式无效或替换后正文超过 20,000 字';
        } else {
          draft.suggestion = { ...proposal, result: { ...result, replacement: result.replacement.replace(/\r\n?/g, '\n') },
            status: proposal.revision === draft.revision ? 'reviewable' : 'stale' };
        }
      }
      if (snapshot.status === 'failed') draft.errorMessage = '生成未完成，请重新选择后再试';
      terminal = ['completed', 'failed', 'cancelled'].includes(draft.status);
      if (terminal) { detach(); this.active = undefined; }
      this.notify();
    };
    this.active = { requestId, draft, receive, detach: () => detach() };
    this.notify();
    try {
      detach = this.port.observe(requestId, receive);
      if (terminal) { detach(); return; }
      receive(await this.port.start({ requestId, scopeId: this.scopeId, draftId: draft.id, selectedText: before, requirement: requirement.trim() }));
    } catch { if (!terminal && !this.disposed) this.markUnknown(draft); }
  }
  private markUnknown(draft: Draft) { draft.status = 'unknown'; draft.errorMessage = '连接中断，任务可能仍在运行'; this.notify(); }
  async cancel(): Promise<void> {
    const active = this.active;
    if (!active || !this.port) return;
    active.draft.status = 'cancelling'; this.notify();
    try { active.receive(await this.port.cancel(active.requestId)); }
    catch { if (this.active === active && !this.disposed) this.markUnknown(active.draft); }
  }
  async refresh(): Promise<void> {
    const active = this.active;
    if (!active || !this.port) return;
    try { active.receive(await this.port.get(active.requestId)); }
    catch { if (this.active === active && !this.disposed) this.markUnknown(active.draft); }
  }
  importText(name: string, bytes: Uint8Array): void {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
    this.newDraft(name, text);
  }
}
