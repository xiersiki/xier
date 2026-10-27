import { createHash, randomUUID } from "node:crypto";
import type {
  ImportJob,
  MaterialFile,
  SearchInput,
  MaterialSummary,
} from "../../common/materials";
import {
  normalizeMaterial,
  MATERIAL_LIMITS,
  isWellFormedMaterialText,
} from "../../common/materials";
import { setImmediate as yieldTurn } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";

/** The sole writer of one local material partition. All calls stay in the utility process. */
export class MaterialRepository {
  private readonly database: DatabaseSync;
  constructor(path: string) {
    this.database = new DatabaseSync(path, { allowExtension: false });
    const version = Number(
      this.database.prepare("PRAGMA user_version").get()?.user_version,
    );
    if (version > 1) {
      this.database.close();
      throw new Error("SCHEMA_TOO_NEW");
    }
    this.database
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, raw BLOB NOT NULL,
        text TEXT NOT NULL, search_title TEXT NOT NULL, search_body TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS documents_recent ON documents(created_at DESC,id ASC);
      CREATE VIRTUAL TABLE IF NOT EXISTS document_search USING fts5(title, body, tokenize='trigram case_sensitive 1');
      CREATE TABLE IF NOT EXISTS jobs(request_id TEXT PRIMARY KEY, digest TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value INTEGER NOT NULL);
      INSERT OR IGNORE INTO metadata VALUES('revision',0);
      PRAGMA user_version=1;`);
  }
  startImport(
    requestId: string,
    digest: string,
    files: MaterialFile[],
    retryOf?: string,
  ) {
    const existing = this.getImport(requestId);
    if (existing) {
      if (existing.digest !== digest) throw new Error("REQUEST_CONFLICT");
      return existing;
    }
    if (
      this.allJobs().some((j) =>
        ["queued", "running", "cancelling"].includes(j.status),
      )
    )
      throw new Error("BUSY");
    const job: ImportJob = {
      requestId,
      digest,
      retryOf,
      status: "running",
      createdAt: Date.now(),
      items: files.map((f) => ({ ...f, status: "pending" })),
    };
    this.database
      .prepare("INSERT INTO jobs VALUES(?,?,?)")
      .run(requestId, digest, JSON.stringify(job));
    return job;
  }
  getImport(requestId: string): ImportJob | null {
    const row = this.database
      .prepare("SELECT data FROM jobs WHERE request_id=?")
      .get(requestId);
    if (!row) return null;
    const job: ImportJob = JSON.parse(String(row.data));
    for (const item of job.items)
      if (item.documentId)
        item.removed = !this.database
          .prepare("SELECT id FROM documents WHERE id=?")
          .get(item.documentId);
    return job;
  }
  completeItem(
    requestId: string,
    index: number,
    raw: Uint8Array,
    text: string,
  ) {
    const job = this.getImport(requestId)!;
    if (!job || job.status !== "running") throw new Error("JOB_TERMINAL");
    const item = job.items[index];
    if (!item || !["pending", "reading", "committing"].includes(item.status))
      throw new Error("ITEM_TERMINAL");
    let id: string = randomUUID();
    const hash = createHash("sha256").update(raw).digest("hex");
    const existing = this.database
      .prepare("SELECT id FROM documents WHERE hash=?")
      .get(hash);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      if (!existing) {
        const usage = this.usage();
        if (
          usage.documents >= MATERIAL_LIMITS.documents ||
          usage.bytes + raw.length > MATERIAL_LIMITS.libraryBytes
        )
          throw new Error("LIBRARY_QUOTA");
        this.database
          .prepare("INSERT INTO documents VALUES(?,?,?,?,?,?,?,?)")
          .run(
            id,
            hash,
            item.name,
            raw,
            text,
            normalizeMaterial(item.name),
            normalizeMaterial(text),
            Date.now(),
          );
        this.database
          .prepare(
            "INSERT INTO document_search(rowid,title,body) SELECT rowid,search_title,search_body FROM documents WHERE id=?",
          )
          .run(id);
      } else {
        id = String(existing.id);
      }
      if (!existing) this.bumpRevision();
      item.status = existing ? "duplicate" : "imported";
      item.documentId = id;
      if (job.items.every((i) => i.status !== "pending"))
        job.status = "completed";
      this.database
        .prepare("UPDATE jobs SET data=? WHERE request_id=?")
        .run(JSON.stringify(job), requestId);
      this.database.exec("COMMIT");
    } catch (error) {
      // SQLITE_FULL may already have rolled back the transaction; preserve its original diagnosis.
      try {
        this.database.exec("ROLLBACK");
      } catch {}
      throw error;
    }
    return job;
  }
  readText(id: string, offset: number) {
    const chars = Array.from(this.copyText(id));
    return {
      text: chars.slice(offset, offset + 20000).join(""),
      offset,
      nextOffset: offset + 20000 < chars.length ? offset + 20000 : null,
    };
  }
  copyText(id: string) {
    const row = this.database
      .prepare("SELECT text FROM documents WHERE id=?")
      .get(id);
    if (!row) throw new Error("NOT_FOUND");
    return String(row.text);
  }
  usage() {
    const row = this.database
      .prepare(
        "SELECT count(*) AS count, coalesce(sum(length(raw)),0) AS bytes FROM documents",
      )
      .get()!;
    return { documents: Number(row.count), bytes: Number(row.bytes) };
  }
  private saveJob(job: ImportJob) {
    this.database
      .prepare("UPDATE jobs SET data=? WHERE request_id=?")
      .run(JSON.stringify(job), job.requestId);
    return job;
  }
  setItemStage(
    requestId: string,
    index: number,
    status: "reading" | "committing",
  ) {
    const job = this.getImport(requestId);
    if (!job || job.status !== "running") throw new Error("JOB_TERMINAL");
    const item = job.items[index];
    if (!item || !["pending", "reading"].includes(item.status))
      throw new Error("ITEM_TERMINAL");
    item.status = status;
    return this.saveJob(job);
  }
  failItem(requestId: string, index: number, error: string) {
    const job = this.getImport(requestId);
    if (!job || job.status !== "running") throw new Error("JOB_TERMINAL");
    job.items[index].status = "failed";
    job.items[index].error = error;
    if (
      job.items.every(
        (i) => !["pending", "reading", "committing"].includes(i.status),
      )
    )
      job.status = "completed";
    return this.saveJob(job);
  }
  cancelImport(requestId: string) {
    const job = this.getImport(requestId);
    if (!job) throw new Error("NOT_FOUND");
    if (["running", "queued", "cancelling"].includes(job.status)) {
      job.status = "cancelled";
      for (const item of job.items)
        if (["pending", "reading", "committing"].includes(item.status))
          item.status = "cancelled";
      this.saveJob(job);
    }
    return job;
  }
  recover() {
    for (const job of this.allJobs())
      if (["queued", "running", "cancelling"].includes(job.status)) {
        job.status = "interrupted";
        for (const item of job.items)
          if (["pending", "reading", "committing"].includes(item.status))
            item.status = "interrupted";
        this.saveJob(job);
      }
  }
  private allJobs(): ImportJob[] {
    return this.database
      .prepare("SELECT data FROM jobs")
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }
  listImports(input: { cursor?: string } = {}) {
    const jobs = this.allJobs().sort(
      (a, b) =>
        b.createdAt - a.createdAt || a.requestId.localeCompare(b.requestId),
    );
    const start = input.cursor
      ? jobs.findIndex((j) => j.requestId === input.cursor) + 1
      : 0;
    const items: ImportJob[] = [];
    let bytes = 0;
    for (const job of jobs.slice(start, start + 20)) {
      const snapshot = this.getImport(job.requestId)!;
      const size = Buffer.byteLength(JSON.stringify(snapshot));
      if (items.length && bytes + size > 200 * 1024) break;
      items.push(snapshot);
      bytes += size;
    }
    return {
      items,
      cursor:
        start + items.length < jobs.length
          ? items[items.length - 1].requestId
          : null,
    };
  }
  removeMaterial(id: string) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "DELETE FROM document_search WHERE rowid=(SELECT rowid FROM documents WHERE id=?)",
        )
        .run(id);
      this.database.prepare("DELETE FROM documents WHERE id=?").run(id);
      this.bumpRevision();
      this.database.exec("COMMIT");
    } catch (error) {
      // SQLITE_FULL may already have rolled back the transaction; preserve its original diagnosis.
      try {
        this.database.exec("ROLLBACK");
      } catch {}
      throw error;
    }
  }
  private cancelledQueries = new Set<string>();
  private activeQuery: string | undefined;
  cancelSearch(queryId: string) {
    this.cancelledQueries.add(queryId);
    if (this.cancelledQueries.size > 1000)
      this.cancelledQueries.delete(
        this.cancelledQueries.values().next().value!,
      );
  }
  private bumpRevision() {
    this.database.exec(
      "UPDATE metadata SET value=value+1 WHERE key='revision'",
    );
  }
  async search(input: SearchInput) {
    const trimmed = input.text.trim();
    if (Array.from(trimmed).length > 128 || !isWellFormedMaterialText(trimmed))
      throw new Error("INVALID_QUERY");
    const query = normalizeMaterial(trimmed);
    if (this.activeQuery && this.activeQuery !== input.queryId)
      this.cancelSearch(this.activeQuery);
    this.activeQuery = input.queryId;
    const revision = Number(
      this.database
        .prepare("SELECT value FROM metadata WHERE key='revision'")
        .get()!.value,
    );
    const hash = createHash("sha256").update(query).digest("hex");
    let boundary: { createdAt: number; id: string } | undefined;
    if (input.cursor) {
      let cursor;
      try {
        cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString());
      } catch {
        throw new Error("INVALID_CURSOR");
      }
      if (cursor.hash !== hash || cursor.revision !== revision)
        throw new Error("STALE_CURSOR");
      boundary = cursor.boundary;
    }
    let candidateIds: Set<number> | undefined;
    // Trigram phrases preserve punctuation literally; short queries use a bounded scan.
    if (Array.from(query).length >= 3 && !query.includes("\0")) {
      const phrase = '"' + query.replace(/"/g, '""') + '"';
      candidateIds = new Set(
        this.database
          .prepare(
            "SELECT rowid FROM document_search WHERE document_search MATCH ?",
          )
          .all(phrase)
          .map((r) => Number(r.rowid)),
      );
    }
    const rows = this.database
      .prepare(
        "SELECT rowid,id,name,length(raw) AS bytes,created_at FROM documents ORDER BY created_at DESC,id ASC",
      )
      .all();
    const matches: MaterialSummary[] = [];
    let position = 0;
    while (position < rows.length && matches.length < 51) {
      if (this.cancelledQueries.has(input.queryId))
        throw new Error("CANCELLED");
      const chunk: typeof rows = [];
      let bytes = 0;
      while (position < rows.length) {
        const row = rows[position++],
          id = String(row.id),
          createdAt = Number(row.created_at);
        if (
          boundary &&
          (createdAt > boundary.createdAt ||
            (createdAt === boundary.createdAt && id <= boundary.id))
        )
          continue;
        if (candidateIds && !candidateIds.has(Number(row.rowid))) continue;
        if (chunk.length && bytes + Number(row.bytes) > 4 * 1024 * 1024) {
          position--;
          break;
        }
        chunk.push(row);
        bytes += Number(row.bytes);
        if (chunk.length === 8) break;
      }
      if (!chunk.length) break;
      // Keep exact substring checks in SQLite to avoid decoding/copying the whole corpus into JS.
      // Each statement still scans at most eight rows / roughly four MiB, then yields to controls.
      const qualified = query
        ? new Set(
            this.database
              .prepare(
                `SELECT rowid FROM documents WHERE rowid IN (${chunk.map(() => "?").join(",")}) AND (instr(search_title,?)>0 OR instr(search_body,?)>0)`,
              )
              .all(...chunk.map((row) => Number(row.rowid)), query, query)
              .map((row) => Number(row.rowid)),
          )
        : undefined;
      for (const row of chunk) {
        if (!qualified || qualified.has(Number(row.rowid)))
          matches.push({
            id: String(row.id),
            name: String(row.name),
            bytes: Number(row.bytes),
            createdAt: Number(row.created_at),
          });
        if (matches.length === 51) break;
      }
      await yieldTurn();
    }
    if (this.cancelledQueries.has(input.queryId)) throw new Error("CANCELLED");
    if (
      Number(
        this.database
          .prepare("SELECT value FROM metadata WHERE key='revision'")
          .get()!.value,
      ) !== revision
    )
      throw new Error("STALE_CURSOR");
    const items = matches.slice(0, 50),
      last = items[items.length - 1];
    return {
      items,
      cursor:
        matches.length > 50
          ? Buffer.from(
              JSON.stringify({
                hash,
                revision,
                boundary: { createdAt: last.createdAt, id: last.id },
              }),
            ).toString("base64url")
          : null,
      usage: this.usage(),
    };
  }
  diagnostics() {
    return {
      sqlite: this.database.prepare("SELECT sqlite_version() AS version").get()
        ?.version,
      journal: this.database.prepare("PRAGMA journal_mode").get()?.journal_mode,
      fts5: true,
      schemaVersion: 1,
    };
  }
  close() {
    this.database.close();
  }
}
