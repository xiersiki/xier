/** Explicit local QA command. Synthetic files and databases stay inside an isolated user-data profile. */
import { app } from "electron";
import { join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { cpus, release } from "node:os";
import { MaterialConnection } from "./connection";
import { authorizeFiles } from "./files";
import type {
  ImportJob,
  MaterialPage,
  MaterialSummary,
} from "../../common/materials";
const p95 = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
export async function benchmarkMaterials(resultPath: string) {
  const root = join(app.getPath("userData"), "benchmark");
  await mkdir(root, { recursive: true });
  const events: { at: number; status: string; error?: string }[] = [];
  const counts: Record<string, number> = {};
  const connection = new MaterialConnection(
    join(__dirname, "material-service.js"),
    join(root, "materials.sqlite"),
    (event) => {
      counts.events = (counts.events ?? 0) + 1;
      if (event.type === "service")
        events.push({
          at: performance.now(),
          status: event.status,
          error: event.error,
        });
    },
  );
  const call = async <T>(method: string, input?: unknown): Promise<T> => {
    counts[method] = (counts[method] ?? 0) + 1;
    return (await connection.call(method, input)) as T;
  };
  const resourceSamples: {
    phase: string;
    atMs: number;
    metrics: ReturnType<typeof app.getAppMetrics>;
  }[] = [];
  const sample = (phase: string) =>
    resourceSamples.push({
      phase,
      atMs: performance.now(),
      metrics: app.getAppMetrics(),
    });
  const begin = performance.now();
  sample("start");
  try {
    // High-variation Chinese trigrams exercise indexing cost; every raw file remains unique.
    let seed = 123456789;
    const codes: number[] = [];
    for (let i = 0; i < 700000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      codes.push(0x4e00 + (seed % 20000));
    }
    let entropy = "";
    for (let offset = 0; offset < codes.length; offset += 8192)
      entropy += String.fromCharCode(...codes.slice(offset, offset + 8192));
    const body = Buffer.from(entropy);
    const paths: string[] = [];
    const expectedHashes = new Map<string, string>();
    for (let index = 0; index < 500; index++) {
      const size = index < 20 ? 2 * 1024 * 1024 : 128 * 1024;
      const prefix = Buffer.from(
        `doc${String(index).padStart(4, "0")} 中文学习资料 React Native 😀 a+b café "+引号"\n`,
      );
      const bytes = Buffer.alloc(size, 0x20);
      prefix.copy(bytes);
      const length = Math.floor((size - prefix.length) / 3) * 3;
      body.copy(bytes, prefix.length, 0, length);
      const path = join(root, `doc${String(index).padStart(4, "0")}.txt`);
      await writeFile(path, bytes);
      paths.push(path);
      expectedHashes.set(
        path,
        createHash("sha256").update(bytes).digest("hex"),
      );
    }
    const start = async (files: string[], requestId = randomUUID()) => {
      const manifest = JSON.stringify(await authorizeFiles(files));
      const chunks: string[] = [];
      let chunk = "",
        bytes = 0;
      for (const char of manifest) {
        const n = Buffer.byteLength(char);
        if (bytes + n > 32768) {
          chunks.push(chunk);
          chunk = "";
          bytes = 0;
        }
        chunk += char;
        bytes += n;
      }
      if (chunk) chunks.push(chunk);
      const token = randomUUID();
      for (let index = 0; index < chunks.length; index++)
        await call("stageManifest", {
          token,
          index,
          total: chunks.length,
          data: chunks[index],
        });
      await call("startImport", {
        requestId,
        manifestToken: token,
        digest: createHash("sha256").update(manifest).digest("hex"),
      });
      return requestId;
    };
    const waitJob = async (id: string) => {
      for (let n = 0; n < 3000; n++) {
        const job = await call<ImportJob>("getImport", id);
        if (!["running", "queued", "cancelling"].includes(job.status))
          return job;
        await delay(20);
      }
      throw new Error("IMPORT_TIMEOUT");
    };
    const batches = [
      paths.slice(0, 10),
      paths.slice(10, 20),
      paths.slice(20, 120),
      paths.slice(120, 220),
      paths.slice(220, 320),
      paths.slice(320, 420),
      paths.slice(420),
    ];
    for (const batch of batches) {
      const job = await waitJob(await start(batch));
      if (job.items.some((i) => i.status !== "imported"))
        throw new Error("IMPORT_NOT_COMPLETE");
      sample("import-batch");
      console.log(`MATERIAL_BENCH imported ${job.items.length}`);
    }
    let cursor: string | undefined;
    const all: MaterialSummary[] = [];
    let usage = { documents: 0, bytes: 0 };
    do {
      const page = await call<MaterialPage>("search", {
        queryId: randomUUID(),
        text: "",
        cursor,
      });
      all.push(...page.items);
      cursor = page.cursor ?? undefined;
      usage = page.usage;
    } while (cursor);
    let correct =
      usage.documents === 500 &&
      usage.bytes === 100 * 1024 * 1024 &&
      new Set(all.map((i) => i.id)).size === 500;
    const searchCold: number[] = [],
      searchWarm: number[] = [],
      queries: string[] = [];
    for (let index = 0; index < 100; index++)
      queries.push(
        [
          `doc${String(index).padStart(4, "0")}`,
          "中",
          "中文",
          "React",
          "😀",
          "a+b",
          "cafe\u0301",
          "龘龘",
          '"+引号"',
          "中文学习资料",
        ][index % 10],
      );
    for (const [mode, samples] of [
      ["cold", searchCold],
      ["warm", searchWarm],
    ] as const) {
      for (const text of queries) {
        if (mode === "cold") await connection.restart();
        const at = performance.now();
        const page = await call<MaterialPage>("search", {
          queryId: randomUUID(),
          text,
        });
        samples.push(performance.now() - at);
        const expected = text.startsWith("doc")
          ? all.filter((item) => item.name === `${text}.txt`)
          : text === "龘龘"
            ? []
            : all;
        if (
          JSON.stringify(page.items.map((i) => i.id)) !==
          JSON.stringify(expected.slice(0, 50).map((i) => i.id))
        )
          correct = false;
      }
      sample(`${mode}-search`);
      console.log(`MATERIAL_BENCH ${mode} search p95 ${p95(samples)}`);
    }
    const cancels: number[] = [];
    const cancellationOutcomes: {
      phase: string;
      status: string;
      firstItem: string;
      latencyMs: number;
    }[] = [];
    for (let index = 0; index < 30; index++) {
      const path = paths[index % 20],
        name = `doc${String(index % 20).padStart(4, "0")}.txt`;
      const existing = await call<MaterialPage>("search", {
        queryId: randomUUID(),
        text: name,
      });
      if (existing.items.length !== 1)
        throw new Error("CANCEL_FIXTURE_MISSING");
      await call("removeMaterial", existing.items[0].id);
      const phase =
        index < 10 ? "reading" : index < 20 ? "commit-wins" : "completed";
      const id = await start(
        phase === "completed" ? [path] : [path, paths[(index + 1) % 20]],
      );
      if (phase === "completed") await waitJob(id);
      else {
        let reading = false;
        for (let n = 0; n < 1000; n++) {
          const snapshot = await call<ImportJob>("getImport", id);
          if (snapshot.items[0].status === "reading") {
            reading = true;
            break;
          }
          if (!["pending", "reading"].includes(snapshot.items[0].status)) break;
        }
        if (!reading) throw new Error("READING_WINDOW_NOT_OBSERVED");
        if (phase === "commit-wins") await delay(100);
      }
      const at = performance.now(),
        job = await call<ImportJob>("cancelImport", id),
        latencyMs = performance.now() - at;
      cancels.push(latencyMs);
      cancellationOutcomes.push({
        phase,
        status: job.status,
        firstItem: job.items[0].status,
        latencyMs,
      });
      if (phase === "reading" && job.items[0].status !== "cancelled")
        correct = false;
      if (phase === "commit-wins" && job.items[0].status !== "imported")
        correct = false;
      if (phase === "completed" && job.status !== "completed") correct = false;
      const after = await call<MaterialPage>("search", {
        queryId: randomUUID(),
        text: "",
      });
      await delay(10);
      const stable = await call<MaterialPage>("search", {
        queryId: randomUUID(),
        text: "",
      });
      if (after.usage.documents !== stable.usage.documents) correct = false;
      if (job.items[0].status !== "imported") {
        const restored = await waitJob(await start([path]));
        if (restored.items[0].status !== "imported")
          throw new Error("CANCEL_FIXTURE_RESTORE_FAILED");
      }
    }
    const faults: number[] = [];
    let restartLimitObserved = false;
    for (let index = 0; index < 10; index++) {
      let ping: { pid: number };
      try {
        ping = await call("ping");
      } catch {
        await connection.restart();
        ping = await call("ping");
      }
      const at = performance.now(),
        eventStart = events.length;
      process.kill(ping.pid, "SIGKILL");
      for (
        let n = 0;
        n < 600 &&
        !events.slice(eventStart).some((e) => e.status === "unavailable");
        n++
      )
        await delay(10);
      const event = events
        .slice(eventStart)
        .find((e) => e.status === "unavailable");
      faults.push(event ? event.at - at : 6000);
      await delay(350);
      try {
        await call("ping");
      } catch {
        restartLimitObserved = true;
        await connection.restart();
      }
    }
    const finalItems: MaterialSummary[] = [];
    let finalCursor: string | undefined;
    do {
      const page = await call<MaterialPage>("search", {
        queryId: randomUUID(),
        text: "",
        cursor: finalCursor,
      });
      finalItems.push(...page.items);
      finalCursor = page.cursor ?? undefined;
    } while (finalCursor);
    let contentLoss = 0;
    for (const item of finalItems) {
      const text = await call<string>("copyText", item.id);
      if (
        createHash("sha256").update(text).digest("hex") !==
        expectedHashes.get(join(root, item.name))
      )
        contentLoss++;
    }
    correct = correct && contentLoss === 0;
    let changedSources = 0;
    for (const path of paths)
      if (
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex") !== expectedHashes.get(path)
      )
        changedSources++;
    correct = correct && changedSources === 0 && restartLimitObserved;
    const final = await call<MaterialPage>("search", {
      queryId: randomUUID(),
      text: "",
    });
    correct =
      correct &&
      final.usage.documents === 500 &&
      final.usage.bytes === 100 * 1024 * 1024;
    const result = {
      correct,
      environment: {
        platform: process.platform,
        arch: process.arch,
        os: release(),
        cpu: cpus()[0]?.model,
        electron: process.versions.electron,
        node: process.versions.node,
      },
      corpus: {
        documents: 500,
        rawBytes: 100 * 1024 * 1024,
        maxFileBytes: 2 * 1024 * 1024,
        distribution:
          "20 × 2 MiB + 480 × 128 KiB, high-variation Chinese trigram body",
      },
      coldDefinition:
        "Each query reopens the real packaged utility and its SQLite connection; OS filesystem cache is not purged.",
      searchColdP95Ms: p95(searchCold),
      searchWarmP95Ms: p95(searchWarm),
      cancelP95Ms: p95(cancels),
      faultMaxMs: Math.max(...faults),
      searchCold,
      searchWarm,
      cancels,
      cancellationOutcomes,
      faults,
      restartLimitObserved,
      changedSources,
      contentLoss,
      counts,
      resourceSamples,
      appMetrics: app.getAppMetrics(),
      elapsedMs: performance.now() - begin,
    };
    await writeFile(resultPath, JSON.stringify(result));
    await connection.close();
    app.exit(0);
  } catch (error) {
    await writeFile(
      resultPath,
      JSON.stringify({
        correct: false,
        error: String(error),
        events,
        counts,
        elapsedMs: performance.now() - begin,
      }),
    );
    await connection.close();
    app.exit(1);
  }
}
