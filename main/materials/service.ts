import { createHash } from "node:crypto";
import { MaterialRepository } from "./repository";
import { readAuthorizedFile, type AuthorizedFile } from "./files";
import {
  MATERIAL_LIMITS,
  type ImportJob,
  type MaterialEvent,
  type SearchInput,
} from "../../common/materials";
import { setImmediate as yieldTurn } from "node:timers/promises";
const terminal = (job: ImportJob) =>
  !["queued", "running", "cancelling"].includes(job.status);
export class MaterialService {
  private repository: MaterialRepository;
  private manifests = new Map<
    string,
    { parts: string[]; total: number; bytes: number; created: number }
  >();
  private stopping = false;
  private processing: Promise<void> | undefined;
  private cancelled = new Set<string>();
  private progressTimer: ReturnType<typeof setTimeout> | undefined;
  private latest: ImportJob | undefined;
  private lastProgress = 0;
  constructor(
    path: string,
    private emit: (event: MaterialEvent) => void,
  ) {
    this.repository = new MaterialRepository(path);
    this.repository.recover();
  }
  async request(method: string, input?: unknown): Promise<unknown> {
    if (this.stopping) throw new Error("SERVICE_STOPPING");
    switch (method) {
      case "ping":
        return {
          protocolVersion: 1,
          process: "utility",
          pid: process.pid,
          electron: process.versions.electron,
          node: process.versions.node,
          ...this.repository.diagnostics(),
        };
      case "stageManifest":
        return this.stage(
          input as {
            token: string;
            index: number;
            total: number;
            data: string;
          },
        );
      case "startImport":
        return this.start(
          input as {
            requestId: string;
            manifestToken: string;
            digest: string;
            retryOf?: string;
          },
        );
      case "getImport":
        return this.repository.getImport(String(input));
      case "listImports":
        return this.repository.listImports(
          input as { cursor?: string } | undefined,
        );
      case "cancelImport": {
        this.cancelled.add(String(input));
        try {
          const job = this.repository.cancelImport(String(input));
          this.progress(job);
          return job;
        } catch {
          this.emit({
            type: "service",
            lease: "",
            status: "unavailable",
            error: "CANCEL_UNCONFIRMED",
          });
          throw new Error("UNKNOWN_OUTCOME");
        }
      }
      case "search":
        return this.repository.search(input as SearchInput);
      case "cancelSearch":
        this.repository.cancelSearch(String(input));
        return;
      case "readText": {
        const { documentId, offset } = input as {
          documentId: string;
          offset: number;
        };
        return this.repository.readText(documentId, offset);
      }
      case "copyText":
        return this.repository.copyText(String(input));
      case "removeMaterial":
        this.repository.removeMaterial(String(input));
        return;
      default:
        throw new Error("UNKNOWN_METHOD");
    }
  }
  private stage(input: {
    token: string;
    index: number;
    total: number;
    data: string;
  }) {
    if (
      !input ||
      typeof input.token !== "string" ||
      input.token.length > 128 ||
      !Number.isInteger(input.index) ||
      !Number.isInteger(input.total) ||
      input.total < 1 ||
      input.total > 128 ||
      typeof input.data !== "string" ||
      Buffer.byteLength(input.data) > 32768
    )
      throw new Error("INVALID_MANIFEST");
    for (const [key, value] of this.manifests)
      if (Date.now() - value.created > 600000) this.manifests.delete(key);
    if (input.index === 0) {
      if (this.manifests.size >= 4 && !this.manifests.has(input.token))
        throw new Error("BUSY");
      this.manifests.set(input.token, {
        parts: [],
        total: input.total,
        bytes: 0,
        created: Date.now(),
      });
    }
    const stage = this.manifests.get(input.token);
    if (
      !stage ||
      stage.parts.length !== input.index ||
      stage.total !== input.total
    )
      throw new Error("INVALID_MANIFEST");
    stage.bytes += Buffer.byteLength(input.data);
    if (stage.bytes > 4 * 1024 * 1024) {
      this.manifests.delete(input.token);
      throw new Error("MANIFEST_TOO_LARGE");
    }
    stage.parts.push(input.data);
  }
  private start(input: {
    requestId: string;
    manifestToken: string;
    digest: string;
    retryOf?: string;
  }) {
    if (
      !input ||
      typeof input.requestId !== "string" ||
      input.requestId.length > 128 ||
      !input.requestId
    )
      throw new Error("INVALID_REQUEST");
    const existing = this.repository.getImport(input.requestId);
    if (existing) {
      if (existing.digest !== input.digest) throw new Error("REQUEST_CONFLICT");
      return existing;
    }
    const stage = this.manifests.get(input.manifestToken);
    if (!stage || stage.parts.length !== stage.total)
      throw new Error("SELECTION_EXPIRED");
    const raw = stage.parts.join("");
    if (createHash("sha256").update(raw).digest("hex") !== input.digest)
      throw new Error("INVALID_MANIFEST");
    const files: AuthorizedFile[] = JSON.parse(raw);
    if (
      !Array.isArray(files) ||
      !files.length ||
      files.length > MATERIAL_LIMITS.batchFiles ||
      files.some(
        (f) =>
          typeof f.path !== "string" ||
          typeof f.name !== "string" ||
          typeof f.fingerprint !== "string" ||
          !Number.isSafeInteger(f.size) ||
          (!f.error && (f.size <= 0 || f.size > MATERIAL_LIMITS.fileBytes)),
      ) ||
      files.reduce((n, f) => n + f.size, 0) > MATERIAL_LIMITS.batchBytes
    )
      throw new Error("INVALID_MANIFEST");
    const job = this.repository.startImport(
      input.requestId,
      input.digest,
      files.map(({ name, size }) => ({ name, size })),
      input.retryOf,
    );
    this.manifests.delete(input.manifestToken);
    this.processing = this.importFiles(job, files).catch((error) => {
      this.emit({
        type: "service",
        lease: "",
        status: "unavailable",
        error: safeMaterialError(error),
      });
    });
    this.progress(job);
    return job;
  }
  private async importFiles(job: ImportJob, files: AuthorizedFile[]) {
    await yieldTurn();
    let bytes = 0;
    for (let index = 0; index < files.length; index++) {
      if (this.stopping || this.cancelled.has(job.requestId)) return;
      try {
        if (bytes >= MATERIAL_LIMITS.batchBytes && files[index].size > 0)
          throw new Error("BATCH_BYTE_LIMIT");
        this.progress(
          this.repository.setItemStage(job.requestId, index, "reading"),
        );
        const result = await readAuthorizedFile(
          files[index],
          () => this.stopping || this.cancelled.has(job.requestId),
          (readBytes) => {
            bytes += readBytes;
            if (bytes > MATERIAL_LIMITS.batchBytes)
              throw new Error("BATCH_BYTE_LIMIT");
          },
        );
        if (this.stopping || this.cancelled.has(job.requestId)) return;
        this.progress(
          this.repository.setItemStage(job.requestId, index, "committing"),
        );
        await yieldTurn();
        if (this.stopping || this.cancelled.has(job.requestId)) return;
        // No await between this check and COMMIT: whichever is processed first wins.
        this.progress(
          this.repository.completeItem(
            job.requestId,
            index,
            result.raw,
            result.text,
          ),
        );
      } catch (error) {
        if (this.stopping || this.cancelled.has(job.requestId)) return;
        this.progress(
          this.repository.failItem(
            job.requestId,
            index,
            safeMaterialError(error),
          ),
        );
      }
      await yieldTurn();
    }
  }
  private progress(job: ImportJob) {
    this.latest = job;
    const send = () => {
      if (this.progressTimer) clearTimeout(this.progressTimer);
      this.progressTimer = undefined;
      this.lastProgress = Date.now();
      const latest = this.latest;
      this.latest = undefined;
      if (latest) this.emit({ type: "job", lease: "", job: latest });
    };
    if (terminal(job) || Date.now() - this.lastProgress >= 250) send();
    else if (!this.progressTimer)
      this.progressTimer = setTimeout(
        send,
        250 - (Date.now() - this.lastProgress),
      );
  }
  async close() {
    this.stopping = true;
    await this.processing;
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.repository.close();
  }
}
export function safeMaterialError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known = [
    "SOURCE_CHANGED",
    "INVALID_UTF8",
    "BINARY_FILE",
    "FILE_TOO_LARGE",
    "BATCH_BYTE_LIMIT",
    "EMPTY_FILE",
    "LIBRARY_QUOTA",
    "CANCELLED",
    "JOB_TERMINAL",
    "NOT_REGULAR_FILE",
    "UNSUPPORTED_FILE",
    "FILE_UNREADABLE",
  ];
  if (known.includes(message)) return message;
  if (/full|ENOSPC/i.test(message)) return "DISK_FULL";
  if (/readonly|EACCES|EPERM/i.test(message)) return "READ_ONLY";
  return "STORAGE_UNAVAILABLE";
}
