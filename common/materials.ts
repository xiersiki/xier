export type JobStatus =
  | "queued"
  | "running"
  | "cancelling"
  | "completed"
  | "cancelled"
  | "failed"
  | "interrupted";
export type ItemStatus =
  | "pending"
  | "reading"
  | "committing"
  | "imported"
  | "duplicate"
  | "failed"
  | "cancelled"
  | "interrupted";
export interface MaterialFile {
  name: string;
  size: number;
}
export interface ImportItem extends MaterialFile {
  status: ItemStatus;
  documentId?: string;
  error?: string;
  removed?: boolean;
}
export interface ImportJob {
  requestId: string;
  digest: string;
  retryOf?: string;
  status: JobStatus;
  createdAt: number;
  items: ImportItem[];
}
export interface MaterialSummary {
  id: string;
  name: string;
  bytes: number;
  createdAt: number;
}
export interface SearchInput {
  queryId: string;
  text: string;
  cursor?: string;
}
export interface MaterialPage {
  items: MaterialSummary[];
  cursor: string | null;
  usage: { documents: number; bytes: number };
}
export interface TextPage {
  text: string;
  offset: number;
  nextOffset: number | null;
}
export interface JobPage {
  items: ImportJob[];
  cursor: string | null;
}
export interface SelectionSummary {
  selectionId: string;
  files: MaterialFile[];
}
export type MaterialEvent =
  | { type: "scope"; lease: string | null }
  | { type: "job"; lease: string; job: ImportJob; sequence?: number }
  | {
      type: "service";
      lease: string;
      status: "starting" | "ready" | "unavailable";
      error?: string;
    };
export interface MaterialApi {
  isEnabled(): Promise<boolean>;
  bindAuth(accountId: string | null): Promise<string>;
  chooseFiles(): Promise<SelectionSummary | null>;
  startImport(input: {
    requestId: string;
    selectionId: string;
    retryOf?: string;
  }): Promise<ImportJob>;
  getImport(requestId: string): Promise<ImportJob | null>;
  listImports(input?: { cursor?: string }): Promise<JobPage>;
  cancelImport(requestId: string): Promise<ImportJob>;
  observeImports(callback: (event: MaterialEvent) => void): () => void;
  search(input: SearchInput): Promise<MaterialPage>;
  cancelSearch(queryId: string): Promise<void>;
  readText(input: { documentId: string; offset: number }): Promise<TextPage>;
  copyText(documentId: string): Promise<void>;
  removeMaterial(documentId: string): Promise<void>;
  restartService(): Promise<void>;
}
export const MATERIAL_LIMITS = {
  fileBytes: 2 * 1024 * 1024,
  batchFiles: 100,
  batchBytes: 20 * 1024 * 1024,
  documents: 500,
  libraryBytes: 100 * 1024 * 1024,
} as const;
export function normalizeMaterial(value: string) {
  return value.normalize("NFC").toLowerCase().normalize("NFC");
}

/** SQLite binds strings as UTF-8; reject lone UTF-16 surrogates instead of silently replacing them. */
export function isWellFormedMaterialText(value: string) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
