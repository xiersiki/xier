// Independent storage fault review. Only self-created synthetic data is accessed.
// Run from the implementation worktree with the system Node, not Electron.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
  readdirSync,
  statSync,
  statfsSync,
  openSync,
  writeSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const root = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ?? process.cwd();
const { build } = createRequire(join(repo, "package.json"))("esbuild");
const bundle = async (name, source) => {
  const target = join(root, name + ".mjs");
  await build({
    entryPoints: [join(repo, source)],
    outfile: target,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  return target;
};
const repositoryPath = await bundle(
  "repository",
  "main/materials/repository.ts",
);
const filesPath = await bundle("files", "main/materials/files.ts");
const entryPath = await bundle("entry", "main/materials/entry.ts");
const { MaterialRepository } = await import(pathToFileURL(repositoryPath).href);
const { authorizeFiles } = await import(pathToFileURL(filesPath).href);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const snapshots = (directory) =>
  Object.fromEntries(
    readdirSync(directory)
      .filter((name) => name.startsWith("materials.sqlite"))
      .map((name) => [
        name,
        {
          bytes: statSync(join(directory, name)).size,
          sha256: hash(readFileSync(join(directory, name))),
        },
      ]),
  );
const seedText = "keep 已提交资料 😀 / local-only";
function seed(directory) {
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "materials.sqlite");
  const store = new MaterialRepository(path);
  store.startImport("seed", "seed-digest", [
    { name: "sentinel.txt", size: Buffer.byteLength(seedText) },
  ]);
  const job = store.completeItem("seed", 0, Buffer.from(seedText), seedText);
  const id = job.items[0].documentId;
  store.close();
  return { path, id };
}
class Worker {
  constructor(databasePath) {
    this.events = [];
    this.pending = new Map();
    this.sequence = 0;
    this.stderr = "";
    this.child = spawn(
      process.execPath,
      [join(root, "worker.mjs"), entryPath, databasePath],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    this.exited = new Promise((resolve) => this.child.once("exit", resolve));
    this.startup = new Promise((resolve, reject) => {
      this.child.once("error", reject);
      this.startupResolve = resolve;
    });
    this.child.stderr.on("data", (part) => {
      this.stderr += part;
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.type === "ready" || message.type === "startup-error")
        this.startupResolve(message);
      else if (message.type === "event") this.events.push(message.event);
      else if (message.id) {
        const item = this.pending.get(message.id);
        if (item) {
          clearTimeout(item.timer);
          this.pending.delete(message.id);
          message.error
            ? item.reject(new Error(message.error))
            : item.resolve(message.result);
        }
      }
    });
  }
  call(method, input) {
    const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("REVIEW_RPC_TIMEOUT"));
      }, 5000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, input }) + "\n");
    });
  }
  async stop() {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("REVIEW_SHUTDOWN"));
    }
    this.pending.clear();
    this.child.stdin.write(
      JSON.stringify({ id: "shutdown", method: "shutdown" }) + "\n",
    );
    const timer = setTimeout(() => this.child.kill("SIGKILL"), 2000);
    try {
      await this.exited;
    } finally {
      clearTimeout(timer);
    }
  }
}
const report = {
  timestamp: new Date().toISOString(),
  root,
  repo,
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    uid: process.getuid?.(),
    distinction:
      "System Node 22 + actual bundled utility entry with an in-process fake parentPort adapter; this is not an Electron/package verification.",
  },
  sourceHashes: Object.fromEntries(
    ["repository.ts", "service.ts", "entry.ts", "files.ts"].map((name) => [
      name,
      hash(readFileSync(join(repo, "main/materials", name))),
    ]),
  ),
  scenarios: {},
};
try {
  // Read-only: same unprivileged user, real filesystem permissions, actual startup error DTO.
  {
    const directory = join(root, "readonly");
    const { path } = seed(directory);
    const before = snapshots(directory);
    chmodSync(path, 0o444);
    chmodSync(directory, 0o555);
    const worker = new Worker(path);
    try {
      const startup = await worker.startup;
      const after = snapshots(directory);
      report.scenarios.readonly = {
        startup,
        preserved: JSON.stringify(before) === JSON.stringify(after),
        before,
        after,
      };
      assert.deepEqual(startup, { type: "startup-error", error: "READ_ONLY" });
      assert.deepEqual(after, before);
    } finally {
      await worker.stop();
      chmodSync(directory, 0o755);
      chmodSync(path, 0o644);
    }
  }
  // Damaged header: preserve a healthy backup, then verify opening never silently reinitializes the damaged file.
  {
    const directory = join(root, "corrupt");
    const { path } = seed(directory);
    copyFileSync(path, join(directory, "healthy-before-corruption.sqlite"));
    const descriptor = openSync(path, "r+");
    writeSync(descriptor, Buffer.from("XierCorruptData!!"), 0, 16, 0);
    closeSync(descriptor);
    const before = snapshots(directory);
    const worker = new Worker(path);
    try {
      const startup = await worker.startup;
      const after = snapshots(directory);
      report.scenarios.corrupt = {
        startup,
        preserved: JSON.stringify(before) === JSON.stringify(after),
        before,
        after,
      };
      assert.deepEqual(startup, {
        type: "startup-error",
        error: "DATABASE_CORRUPT",
      });
      assert.deepEqual(after, before);
    } finally {
      await worker.stop();
    }
  }
  // Physical disk pressure stays inside a 32 MiB self-created HFS+ image.
  {
    const volume = join(root, "volume");
    assert.notEqual(
      statSync(volume).dev,
      statSync(root).dev,
      "Refuse to fill a host-filesystem directory",
    );
    const directory = join(volume, "library");
    const { path, id } = seed(directory);
    const sourcePath = join(root, "disk-full-source.txt");
    const source = Buffer.from(
      "new-text-for-disk-full\n" + "x".repeat(2 * 1024 * 1024 - 23),
    );
    writeFileSync(sourcePath, source);
    const sourceHash = hash(source);
    const worker = new Worker(path);
    const startup = await worker.startup;
    assert.equal(startup.type, "ready");
    report.runtime.sqlite = (await worker.call("ping")).sqlite;
    const initialFree =
      Number(statfsSync(volume).bavail) * Number(statfsSync(volume).bsize);
    const fillerPath = join(volume, "bounded-filler.bin");
    const filler = openSync(fillerPath, "wx");
    let fillerBytes = 0,
      fillerError;
    try {
      const block = Buffer.alloc(1024 * 1024, 0x66);
      while (fillerBytes < 32 * 1024 * 1024) {
        const stats = statfsSync(volume);
        const free = Number(stats.bavail) * Number(stats.bsize);
        const wanted = Math.min(block.length, Math.max(0, free - 256 * 1024));
        if (!wanted) break;
        fillerBytes += writeSync(filler, block, 0, wanted);
      }
    } catch (error) {
      fillerError = { code: error.code, message: error.message };
    } finally {
      closeSync(filler);
    }
    const remainingFree =
      Number(statfsSync(volume).bavail) * Number(statfsSync(volume).bsize);
    let job, failedDuring, searchDuring, errorDuring;
    try {
      const manifest = JSON.stringify(await authorizeFiles([sourcePath]));
      await worker.call("stageManifest", {
        token: "full",
        index: 0,
        total: 1,
        data: manifest,
      });
      await worker.call("startImport", {
        requestId: "disk-full",
        manifestToken: "full",
        digest: hash(manifest),
      });
      for (let index = 0; index < 300; index++) {
        job = await worker.call("getImport", "disk-full");
        if (
          !["running", "queued", "cancelling"].includes(job.status) ||
          worker.events.some(
            (event) =>
              event.type === "service" && event.status === "unavailable",
          )
        )
          break;
        await delay(10);
      }
      failedDuring = job;
      searchDuring = await worker.call("search", {
        queryId: "during-full",
        text: "",
      });
    } catch (error) {
      errorDuring = String(error);
    } finally {
      await worker.stop();
    }
    const preservedDirectory = join(root, "disk-full-preserved");
    mkdirSync(preservedDirectory);
    for (const name of readdirSync(directory))
      if (name.startsWith("materials.sqlite"))
        copyFileSync(join(directory, name), join(preservedDirectory, name));
    const preserved = snapshots(preservedDirectory);
    unlinkSync(fillerPath);
    const restored = new Worker(path);
    let afterRecovery;
    try {
      const recoveredStartup = await restored.startup;
      assert.equal(recoveredStartup.type, "ready");
      const text = await restored.call("copyText", id);
      const after = await restored.call("search", {
        queryId: "after-full",
        text: "",
      });
      const recoveredJob = await restored.call("getImport", "disk-full");
      afterRecovery = {
        originalContentIntact: text === seedText,
        sourceUnchanged: hash(readFileSync(sourcePath)) === sourceHash,
        count: after.usage.documents,
        job: recoveredJob,
      };
      assert.equal(text, seedText);
      assert.equal(after.usage.documents, 1);
      assert.equal(afterRecovery.sourceUnchanged, true);
      assert(
        !recoveredJob ||
          recoveredJob.items.every(
            (item) => !["imported", "duplicate"].includes(item.status),
          ),
        "Disk-full item must not become a fake success",
      );
    } finally {
      await restored.stop();
    }
    report.scenarios.diskFull = {
      physicalVolume: "self-created 32 MiB HFS+ sparse disk image",
      initialFree,
      remainingFree,
      fillerBytes,
      fillerError,
      failedDuring,
      searchDuring,
      errorDuring,
      events: worker.events,
      preserved,
      afterRecovery,
    };
    assert.equal(
      failedDuring?.items[0]?.error,
      "DISK_FULL",
      "The public failed item must retain the physical disk-full diagnosis instead of a rollback error",
    );
  }
} finally {
  writeFileSync(join(root, "results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  execFileSync("/usr/bin/hdiutil", ["detach", join(root, "volume")]);
  console.log("DETACHED_SELF_CREATED_VOLUME");
}
