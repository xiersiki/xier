// @vitest-environment node
import { expect, it } from "vitest";
import { MaterialHost, type MaterialConnection } from "../main/materials/host";
it("starts unbound, rejects untrusted callers and revokes old leases before an account switch", async () => {
  const paths: string[] = [];
  let closed = 0;
  const connection: MaterialConnection = {
    call: async (method) =>
      method === "listImports" ? { items: [], cursor: null } : undefined,
    close: async () => {
      closed++;
    },
  };
  const host = new MaterialHost(
    "/tmp/material-host-test",
    async (path) => {
      paths.push(path);
      return connection;
    },
    async () => null,
    () => {},
  );
  await expect(host.invoke(true, "none", "listImports")).rejects.toThrow(
    "UNBOUND",
  );
  await expect(host.bindAuth(false, null)).rejects.toThrow("UNTRUSTED_SOURCE");
  const guest = await host.bindAuth(true, null);
  await host.invoke(true, guest, "listImports");
  expect(await host.bindAuth(true, null)).toBe(guest);
  expect(paths).toHaveLength(1);
  const account = await host.bindAuth(true, "account-A");
  expect(account).not.toBe(guest);
  expect(closed).toBe(1);
  await expect(host.invoke(true, guest, "listImports")).rejects.toThrow(
    "STALE_LEASE",
  );
  await expect(host.invoke(false, account, "listImports")).rejects.toThrow(
    "UNTRUSTED_SOURCE",
  );
  await host.invoke(true, account, "listImports");
  expect(paths[0]).not.toBe(paths[1]);
  expect(paths[1]).not.toContain("account-A");
  await host.close();
});
it("binds picker selections to the lease and only sends authorized paths through private manifest chunks", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "xier-host-picker-"));
  try {
    const path = join(directory, "notes.md");
    await writeFile(path, "hello");
    const calls: { method: string; input: unknown }[] = [];
    const host = new MaterialHost(
      directory,
      async () => ({
        call: async (method, input) => {
          calls.push({ method, input });
          return method === "getImport" ? null : { status: "running" };
        },
        close: async () => {},
      }),
      async () => [path],
      () => {},
    );
    const lease = await host.bindAuth(true, null);
    const selected = (await host.invoke(true, lease, "chooseFiles")) as {
      selectionId: string;
      files: unknown[];
    };
    expect(JSON.stringify(selected)).not.toContain(directory);
    await expect(
      host.invoke(true, lease, "startImport", {
        requestId: "x",
        selectionId: "invented",
      }),
    ).rejects.toThrow("SELECTION_EXPIRED");
    await host.invoke(true, lease, "startImport", {
      requestId: "x",
      selectionId: selected.selectionId,
    });
    expect(calls.some((c) => c.method === "stageManifest")).toBe(true);
    expect(JSON.stringify(calls)).toContain(path);
    await expect(
      host.invoke(true, lease, "startImport", {
        requestId: "y",
        selectionId: selected.selectionId,
      }),
    ).rejects.toThrow("SELECTION_USED");
    const next = await host.bindAuth(true, "other");
    await expect(
      host.invoke(true, next, "startImport", {
        requestId: "z",
        selectionId: selected.selectionId,
      }),
    ).rejects.toThrow("SELECTION_EXPIRED");
    await host.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("rejects unknown operations, malformed public inputs and payloads above the IPC limit", async () => {
  const host = new MaterialHost(
    "/tmp/xier-host-validation",
    async () => ({ call: async () => null, close: async () => {} }),
    async () => null,
    () => {},
  );
  const lease = await host.bindAuth(true, null);
  await expect(
    host.invoke(true, lease, "executeSql", { sql: "DROP TABLE documents" }),
  ).rejects.toThrow("UNKNOWN_METHOD");
  await expect(
    host.invoke(true, lease, "readText", { documentId: "doc", offset: -1 }),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    host.invoke(true, lease, "search", {
      queryId: "q",
      text: "x".repeat(70000),
    }),
  ).rejects.toThrow("PAYLOAD_TOO_LARGE");
  await host.close();
});
it("does not bind a superseded account while an old service is still closing", async () => {
  let finishClose: () => void = () => {};
  const closing = new Promise<void>((resolve) => (finishClose = resolve));
  const host = new MaterialHost(
    "/tmp/material-host-race",
    async () => ({
      call: async () => ({ items: [], cursor: null }),
      close: () => closing,
    }),
    async () => null,
    () => {},
  );
  const guest = await host.bindAuth(true, null);
  await host.invoke(true, guest, "listImports");
  const first = host.bindAuth(true, "A");
  const firstResult = first.catch((error) => String(error));
  const second = host.bindAuth(true, "B");
  let bound = false;
  void second.then(() => (bound = true));
  await Promise.resolve();
  await Promise.resolve();
  expect(bound).toBe(false);
  finishClose();
  expect(await firstResult).toContain("STALE_LEASE");
  const lease = await second;
  await expect(host.invoke(true, lease, "listImports")).resolves.toMatchObject({
    items: [],
  });
  await host.close();
});
it("keeps only one delivered progress event and one latest pending snapshot for a slow observer", async () => {
  const events: import("../common/materials").MaterialEvent[] = [];
  let publish: (
    event: import("../common/materials").MaterialEvent,
  ) => void = () => {};
  const host = new MaterialHost(
    "/tmp/host-observer",
    async (_path, emit) => {
      publish = emit;
      return { call: async () => null, close: async () => {} };
    },
    async () => null,
    (event) => events.push(event),
  );
  const lease = await host.bindAuth(true, null);
  await host.invoke(true, lease, "listImports");
  host.watch(true, lease, true);
  events.length = 0;
  for (let index = 1; index <= 100; index++)
    publish({
      type: "job",
      lease: "",
      job: {
        requestId: "batch",
        digest: "d",
        createdAt: 1,
        status: "running",
        items: Array.from({ length: index }, () => ({
          name: "a.txt",
          size: 1,
          status: "pending",
        })),
      },
    });
  expect(events).toHaveLength(1);
  host.acknowledge(true, lease, (events[0] as { sequence: number }).sequence);
  expect(events).toHaveLength(2);
  expect(events[1]).toMatchObject({
    type: "job",
    job: {
      items: expect.arrayContaining([
        expect.objectContaining({ name: "a.txt" }),
      ]),
    },
  });
  expect(
    (events[1] as { job: import("../common/materials").ImportJob }).job.items,
  ).toHaveLength(100);
  host.watch(true, lease, false);
  await host.close();
});
it("rejects unknown request fields and malformed history requests instead of forwarding them", async () => {
  const host = new MaterialHost(
    "/tmp/xier-material-field-validation",
    async () => ({ call: async () => null, close: async () => {} }),
    async () => null,
    () => {},
  );
  const lease = await host.bindAuth(true, null);
  await expect(
    host.invoke(true, lease, "search", {
      queryId: "q",
      text: "",
      path: "/invented",
    }),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(host.invoke(true, lease, "listImports", [])).rejects.toThrow(
    "INVALID_INPUT",
  );
  await expect(
    host.invoke(true, lease, "listImports", { cursor: false }),
  ).rejects.toThrow("INVALID_INPUT");
  await host.close();
});
it("keeps existing material bytes untouched when the feature is disabled", async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const root = await mkdtemp(join(tmpdir(), "xier-feature-off-"));
  try {
    const file = join(root, "existing-materials.sqlite");
    const before = Buffer.from("existing material fixture bytes");
    await writeFile(file, before);
    let starts = 0;
    const host = new MaterialHost(
      root,
      async () => {
        starts++;
        throw new Error("Feature-off must not open storage");
      },
      async () => [],
      () => {},
      false,
    );
    const lease = await host.bindAuth(true, null);
    await expect(host.invoke(true, lease, "listImports")).rejects.toThrow(
      "FEATURE_DISABLED",
    );
    await expect(host.invoke(true, lease, "chooseFiles")).rejects.toThrow(
      "FEATURE_DISABLED",
    );
    await host.close();
    expect(starts).toBe(0);
    expect(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ).toBe(createHash("sha256").update(before).digest("hex"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
