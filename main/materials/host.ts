import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { authorizeFiles, type AuthorizedFile } from "./files";
import { isWellFormedMaterialText } from "../../common/materials";
import type { MaterialEvent } from "../../common/materials";
export interface MaterialConnection {
  call(method: string, input?: unknown): Promise<unknown>;
  close(): Promise<void>;
  restart?(): Promise<void>;
}
export type MaterialFactory = (
  path: string,
  emit: (event: MaterialEvent) => void,
) => Promise<MaterialConnection>;
/** Main-process partition authority. Business requests carry only a host-issued lease. */
export class MaterialHost {
  private lease: string | null = null;
  private account: string | null | undefined;
  private connection: Promise<MaterialConnection> | undefined;
  private selections = new Map<
    string,
    {
      lease: string;
      files: AuthorizedFile[];
      expires: number;
      requestId?: string;
    }
  >();
  constructor(
    private root: string,
    private factory: MaterialFactory,
    private pick: () => Promise<string[] | null>,
    private emit: (event: MaterialEvent) => void,
    private enabled = true,
  ) {}
  private authorize(trusted: boolean, lease?: string) {
    if (!trusted) throw new Error("UNTRUSTED_SOURCE");
    if (!this.enabled) throw new Error("FEATURE_DISABLED");
    if (!this.lease) throw new Error("UNBOUND");
    if (lease !== this.lease) throw new Error("STALE_LEASE");
  }
  private transition = Promise.resolve();
  private epoch = 0;
  private binding:
    { account: string | null; promise: Promise<string> } | undefined;
  bindAuth(trusted: boolean, account: string | null): Promise<string> {
    if (!trusted) return Promise.reject(new Error("UNTRUSTED_SOURCE"));
    if (
      account !== null &&
      (typeof account !== "string" || account.length > 256 || !account.length)
    )
      return Promise.reject(new Error("INVALID_ACCOUNT"));
    if (this.binding?.account === account) return this.binding.promise;
    if (this.account === account && this.lease)
      return Promise.resolve(this.lease);
    this.inflight = null;
    this.latest = undefined;
    const ticket = ++this.epoch;
    this.selections.clear();
    this.lease = null;
    this.emit({ type: "scope", lease: null });
    const old = this.connection;
    this.connection = undefined;
    const promise = this.transition.then(async () => {
      await old?.then((c) => c.close()).catch(() => {});
      if (ticket !== this.epoch) throw new Error("STALE_LEASE");
      this.account = account;
      this.lease = randomUUID();
      this.emit({ type: "scope", lease: this.lease });
      return this.lease;
    });
    this.transition = promise.then(
      () => {},
      () => {},
    );
    this.binding = { account, promise };
    void promise
      .finally(() => {
        if (this.binding?.promise === promise) this.binding = undefined;
      })
      .catch(() => {});
    return promise;
  }
  private observing = false;
  private inflight: number | null = null;
  private sequence = 0;
  private latest: Extract<MaterialEvent, { type: "job" }> | undefined;
  watch(trusted: boolean, lease: string | null, enabled: boolean) {
    if (!trusted) throw new Error("UNTRUSTED_SOURCE");
    if (enabled) this.authorize(trusted, lease ?? undefined);
    this.observing = enabled;
    this.inflight = null;
    this.latest = undefined;
  }
  acknowledge(trusted: boolean, lease: string, sequence: number) {
    this.authorize(trusted, lease);
    if (sequence !== this.inflight) return;
    this.inflight = null;
    this.flush();
  }
  private publish(event: MaterialEvent) {
    if (event.type !== "job") {
      this.emit(event);
      return;
    }
    if (!this.observing) return;
    this.latest = event;
    this.flush();
  }
  private flush() {
    if (!this.observing || this.inflight !== null || !this.latest) return;
    const event = this.latest;
    this.latest = undefined;
    this.inflight = ++this.sequence;
    this.emit({ ...event, sequence: this.inflight });
  }
  private dataPending = 0;
  private controlPending = 0;
  async invoke(
    trusted: boolean,
    lease: string,
    method: string,
    input?: unknown,
  ): Promise<unknown> {
    this.authorize(trusted, lease);
    validateInput(method, input);
    const control = ["cancelImport", "cancelSearch", "restartService"].includes(
      method,
    );
    if (control ? this.controlPending >= 3 : this.dataPending >= 16)
      throw new Error("BUSY");
    if (control) this.controlPending++;
    else this.dataPending++;
    try {
      return await this.execute(trusted, lease, method, input);
    } finally {
      if (control) this.controlPending--;
      else this.dataPending--;
    }
  }
  private async execute(
    trusted: boolean,
    lease: string,
    method: string,
    input?: unknown,
  ): Promise<unknown> {
    this.authorize(trusted, lease);
    validateInput(method, input);
    if (method === "chooseFiles") {
      const paths = await this.pick();
      this.authorize(trusted, lease);
      if (!paths) return null;
      const files = await authorizeFiles(paths);
      this.authorize(trusted, lease);
      for (const [id, selection] of this.selections)
        if (selection.expires < Date.now()) this.selections.delete(id);
      if (this.selections.size >= 8) throw new Error("BUSY");
      const selectionId = randomUUID();
      this.selections.set(selectionId, {
        lease,
        files,
        expires: Date.now() + 600000,
      });
      return {
        selectionId,
        files: files.map(({ name, size }) => ({ name, size })),
      };
    }
    if (!this.connection) {
      const scope = lease;
      const hash = createHash("sha256")
        .update(this.account === null ? "guest" : `account:${this.account}`)
        .digest("hex");
      this.connection = this.factory(
        join(this.root, hash, "materials.sqlite"),
        (event) => {
          if (this.lease === scope) this.publish({ ...event, lease: scope });
        },
      );
    }
    const connection = await this.connection;
    this.authorize(trusted, lease);
    if (method === "restartService") {
      if (!connection.restart) throw new Error("SERVICE_UNAVAILABLE");
      await connection.restart();
      this.authorize(trusted, lease);
      return;
    }
    let result: unknown;
    if (method === "startImport") {
      const start = input as {
        requestId: string;
        selectionId: string;
        retryOf?: string;
      };
      const selection = this.selections.get(start.selectionId);
      if (
        !selection ||
        selection.lease !== lease ||
        selection.expires < Date.now()
      )
        throw new Error("SELECTION_EXPIRED");
      if (selection.requestId && selection.requestId !== start.requestId)
        throw new Error("SELECTION_USED");
      selection.requestId = start.requestId;
      const raw = JSON.stringify(selection.files),
        digest = createHash("sha256").update(raw).digest("hex");
      const existing = await connection.call("getImport", start.requestId);
      this.authorize(trusted, lease);
      if (existing) {
        if ((existing as { digest: string }).digest !== digest)
          throw new Error("REQUEST_CONFLICT");
        return existing;
      }
      // Split by UTF-8 bytes without cutting code points; each private message is <=32 KiB.
      const chunks: string[] = [];
      let chunk = "",
        bytes = 0;
      for (const char of raw) {
        const size = Buffer.byteLength(char);
        if (bytes + size > 32768) {
          chunks.push(chunk);
          chunk = "";
          bytes = 0;
        }
        chunk += char;
        bytes += size;
      }
      if (chunk) chunks.push(chunk);
      if (Buffer.byteLength(raw) > 4 * 1024 * 1024)
        throw new Error("MANIFEST_TOO_LARGE");
      const token = randomUUID();
      for (let index = 0; index < chunks.length; index++) {
        this.authorize(trusted, lease);
        await connection.call("stageManifest", {
          token,
          index,
          total: chunks.length,
          data: chunks[index],
        });
      }
      this.authorize(trusted, lease);
      result = await connection.call("startImport", {
        requestId: start.requestId,
        manifestToken: token,
        digest,
        retryOf: start.retryOf,
      });
    } else result = await connection.call(method, input);
    this.authorize(trusted, lease);
    if (
      method !== "copyText" &&
      Buffer.byteLength(JSON.stringify(result) ?? "null") > 256 * 1024
    )
      throw new Error("RESPONSE_TOO_LARGE");
    return result;
  }
  async close() {
    this.observing = false;
    this.inflight = null;
    this.latest = undefined;
    this.epoch++;
    this.lease = null;
    this.selections.clear();
    const old = this.connection;
    this.connection = undefined;
    const closing = this.transition.then(async () => {
      await old?.then((c) => c.close()).catch(() => {});
    });
    this.transition = closing;
    await closing;
  }
}

function validateInput(method: string, input: unknown) {
  if (Buffer.byteLength(JSON.stringify(input) ?? "null") > 65536)
    throw new Error("PAYLOAD_TOO_LARGE");
  const id = (value: unknown) =>
    typeof value === "string" && value.length > 0 && value.length <= 128;
  const object =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const fields = (allowed: string[]) =>
    Boolean(input && typeof input === "object" && !Array.isArray(input)) &&
    Object.keys(object).every((key) => allowed.includes(key));
  let valid = false;
  switch (method) {
    case "chooseFiles":
    case "restartService":
      valid = input === undefined;
      break;
    case "getImport":
    case "cancelImport":
    case "cancelSearch":
    case "copyText":
    case "removeMaterial":
      valid = id(input);
      break;
    case "listImports":
      valid =
        input === undefined ||
        (fields(["cursor"]) &&
          (object.cursor === undefined || id(object.cursor)));
      break;
    case "search":
      valid =
        fields(["queryId", "text", "cursor"]) &&
        id(object.queryId) &&
        typeof object.text === "string" &&
        Array.from(object.text.trim()).length <= 128 &&
        isWellFormedMaterialText(object.text) &&
        (object.cursor === undefined ||
          (typeof object.cursor === "string" &&
            object.cursor.length > 0 &&
            object.cursor.length <= 2048));
      break;
    case "readText":
      valid =
        fields(["documentId", "offset"]) &&
        id(object.documentId) &&
        Number.isSafeInteger(object.offset) &&
        Number(object.offset) >= 0;
      break;
    case "startImport":
      valid =
        fields(["requestId", "selectionId", "retryOf"]) &&
        id(object.requestId) &&
        id(object.selectionId) &&
        (object.retryOf === undefined || id(object.retryOf));
      break;
    default:
      throw new Error("UNKNOWN_METHOD");
  }
  if (!valid) throw new Error("INVALID_INPUT");
}
