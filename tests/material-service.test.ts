// @vitest-environment node
import { expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { MaterialService } from "../main/materials/service";
import { authorizeFiles } from "../main/materials/files";
import type { ImportJob } from "../common/materials";
it("imports a selected manifest in the service and discovers the completed job without replaying paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xier-service-"));
  const service = new MaterialService(join(dir, "materials.sqlite"), () => {});
  try {
    const path = join(dir, "材料.txt");
    await writeFile(path, "中文搜索 <script>inert</script>");
    const manifest = JSON.stringify(await authorizeFiles([path]));
    const digest = createHash("sha256").update(manifest).digest("hex");
    await service.request("stageManifest", {
      token: "manifest",
      index: 0,
      total: 1,
      data: manifest,
    });
    const start = { requestId: "request", manifestToken: "manifest", digest };
    await service.request("startImport", start);
    let job: ImportJob;
    for (let i = 0; i < 100; i++) {
      job = (await service.request("getImport", "request")) as ImportJob;
      if (job.status === "completed") break;
      await delay(10);
    }
    expect(job!).toMatchObject({
      status: "completed",
      items: [{ status: "imported", name: "材料.txt" }],
    });
    expect(await service.request("startImport", start)).toMatchObject({
      status: "completed",
    });
    expect(
      await service.request("search", { queryId: "q", text: "中文" }),
    ).toMatchObject({ items: [{ name: "材料.txt" }] });
  } finally {
    await service.close();
    await rm(dir, { recursive: true, force: true });
  }
});
it("reports an unavailable service when cancellation cannot be persisted, then allows a durable retry", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = await mkdtemp(join(tmpdir(), "xier-cancel-failure-"));
  const events: import("../common/materials").MaterialEvent[] = [];
  const path = join(dir, "materials.sqlite");
  const service = new MaterialService(path, (event) => events.push(event));
  const blocker = new DatabaseSync(path);
  try {
    const source = join(dir, "source.txt");
    await writeFile(source, "x".repeat(2 * 1024 * 1024));
    const raw = JSON.stringify(await authorizeFiles([source]));
    const digest = createHash("sha256").update(raw).digest("hex");
    await service.request("stageManifest", {
      token: "manifest",
      index: 0,
      total: 1,
      data: raw,
    });
    await service.request("startImport", {
      requestId: "cancel-failure",
      manifestToken: "manifest",
      digest,
    });
    blocker.exec("BEGIN IMMEDIATE");
    await expect(
      service.request("cancelImport", "cancel-failure"),
    ).rejects.toThrow();
    blocker.exec("ROLLBACK");
    await delay(20);
    expect(
      events.some(
        (event) => event.type === "service" && event.status === "unavailable",
      ),
    ).toBe(true);
    expect(
      await service.request("cancelImport", "cancel-failure"),
    ).toMatchObject({ status: "cancelled" });
    expect(
      await service.request("search", { queryId: "after-stop", text: "" }),
    ).toMatchObject({ items: [] });
  } finally {
    try {
      blocker.exec("ROLLBACK");
    } catch {}
    blocker.close();
    await service.close();
    await rm(dir, { recursive: true, force: true });
  }
});
it("exposes the current item as reading and stops it before commit when cancellation is acknowledged", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xier-reading-"));
  const service = new MaterialService(join(dir, "materials.sqlite"), () => {});
  try {
    const path = join(dir, "source.txt");
    await writeFile(path, "x".repeat(2 * 1024 * 1024));
    const manifest = JSON.stringify(await authorizeFiles([path]));
    await service.request("stageManifest", {
      token: "reading",
      index: 0,
      total: 1,
      data: manifest,
    });
    await service.request("startImport", {
      requestId: "reading",
      manifestToken: "reading",
      digest: createHash("sha256").update(manifest).digest("hex"),
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(await service.request("getImport", "reading")).toMatchObject({
      status: "running",
      items: [{ status: "reading" }],
    });
    expect(await service.request("cancelImport", "reading")).toMatchObject({
      status: "cancelled",
      items: [{ status: "cancelled" }],
    });
    await delay(20);
    expect(
      await service.request("search", { queryId: "cancelled-copy", text: "" }),
    ).toMatchObject({ items: [] });
  } finally {
    await service.close();
    await rm(dir, { recursive: true, force: true });
  }
});
