/** v1: transport-neutral UI boundary. scopeId is correlation, never authentication. */
export interface RewriteRequest {
  readonly requestId: string;
  readonly scopeId: string;
  readonly draftId: string;
  readonly selectedText: string;
  readonly requirement: string;
}
export interface RewriteResult { readonly replacement: string; readonly explanation?: string }
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';
export interface RunSnapshot {
  readonly requestId: string;
  /** Monotonically increasing per run; duplicates and older snapshots are ignored. */
  readonly sequence: number;
  readonly status: RunStatus;
  readonly result?: RewriteResult;
  readonly error?: { readonly code: string; readonly message: string };
}
export interface AgentPort {
  /** Register before start. Unsubscribe only detaches observation; it does NOT cancel. */
  observe(requestId: string, listener: (snapshot: RunSnapshot) => void): () => void;
  /** Resolves on acknowledgement, not necessarily completion. Reuse ID only for identical input. */
  start(request: RewriteRequest): Promise<RunSnapshot>;
  /** Resolves with observed server state, including completed if completion won the race. */
  cancel(requestId: string): Promise<RunSnapshot>;
  /** Never starts/restarts a run. Missing mappings return unknown. */
  get(requestId: string): Promise<RunSnapshot>;
}
export type SuggestionStatus = 'pending' | 'reviewable' | 'stale' | 'applied' | 'rejected';
export interface ContextSelectionProps { selectedText: string; count: number; limit: number; disabledReason?: string }
export interface ContextSelectionEmits { submit: [requirement: string]; cancel: [] }
export interface RewriteSuggestionProps {
  before: string; after: string; explanation?: string; status: SuggestionStatus; canAccept: boolean;
}
export interface RewriteSuggestionEmits { accept: []; reject: []; copy: [] }
export type GenerationStatusValue = 'ready' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'unknown';
export interface GenerationStatusProps { status: GenerationStatusValue; errorMessage?: string; canCancel: boolean }
export interface GenerationStatusEmits { cancel: []; retry: []; refresh: [] }

/** Structural browser File subset; desktop adapters may provide the same bytes. */
export interface ContentFile { readonly name: string; readonly size: number; arrayBuffer(): Promise<ArrayBuffer> }
export interface FilePort {
  read(file: ContentFile): Promise<{ name: string; bytes: Uint8Array }>;
  export(name: string, text: string): Promise<void>;
  copy(text: string): Promise<void>;
}
