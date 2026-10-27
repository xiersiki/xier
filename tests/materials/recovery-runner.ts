import { app } from "electron";
import { join, basename } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { MaterialConnection } from "../../main/materials/connection";
import { authorizeFiles } from "../../main/materials/files";
import type { ImportJob, MaterialPage } from "../../common/materials";
app.setPath("userData", process.env.XIER_MATERIAL_TEST_DIR!);
app.whenReady().then(async () => {
  const root = app.getPath("userData");
  let childPid = 0,
    dropTerminalFor = "",
    terminalDropped: () => void = () => {};
  const connection = new MaterialConnection(
    process.env.XIER_MATERIAL_ENTRY!,
    join(root, "recovery.sqlite"),
    (event) => {
      if (
        event.type === "job" &&
        event.job.requestId === dropTerminalFor &&
        event.job.status === "completed"
      ) {
        // Host receives but deliberately does not deliver this terminal snapshot to a UI observer.
        process.kill(childPid, "SIGKILL");
        terminalDropped();
      }
    },
  );
  const call = async <T>(method: string, input?: unknown) =>
    (await connection.call(method, input)) as T;
  const start = async (
    requestId: string,
    paths: string[],
    retryOf?: string,
  ) => {
    const manifest = JSON.stringify(await authorizeFiles(paths));
    const digest = createHash("sha256").update(manifest).digest("hex");
    await call("stageManifest", {
      token: requestId,
      index: 0,
      total: 1,
      data: manifest,
    });
    return call<ImportJob>("startImport", {
      requestId,
      digest,
      manifestToken: requestId,
      retryOf,
    });
  };
  const finished = async (id: string) => {
    for (let n = 0; n < 1000; n++) {
      const job = await call<ImportJob>("getImport", id);
      if (!["queued", "running", "cancelling"].includes(job.status)) return job;
      await delay(5);
    }
    throw new Error("IMPORT_TIMEOUT");
  };
  try {
    childPid = (await call<{ pid: number }>("ping")).pid;
    const baseline = join(root, "baseline.md");
    await writeFile(baseline, "confirmed baseline");
    const baselineJob = await finished(
      (await start("baseline", [baseline])).requestId,
    );
    const baselineId = baselineJob.items[0].documentId!;
    let entropy = "",
      seed = 20261027;
    for (let i = 0; i < 650000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      entropy += String.fromCharCode(0x4e00 + (seed % 20000));
    }
    const paths: string[] = [],
      hashes = new Map<string, string>();
    hashes.set(baseline, createHash("sha256").update(await readFile(baseline)).digest("hex"));
    for (let i = 0; i < 3; i++) {
      const raw = Buffer.from(`source-${i}\n${entropy}`),
        path = join(root, `large-${i}.txt`);
      await writeFile(path, raw);
      paths.push(path);
      hashes.set(path, createHash("sha256").update(raw).digest("hex"));
    }
    await start("interrupted", paths);
    let reading = false;
    for (let n = 0; n < 100; n++) {
      const job = await call<ImportJob>("getImport", "interrupted");
      if (job.items.some((i) => i.status === "reading")) {
        reading = true;
        break;
      }
      if (job.status === "completed") break;
    }
    if (!reading)
      throw new Error("Did not observe the pre-commit read boundary");
    process.kill(childPid, "SIGKILL");
    await connection.restart();
    const recovered = await call<ImportJob>("getImport", "interrupted");
    if (recovered.status !== "interrupted")
      throw new Error("Unfinished batch was not interrupted");
    if (recovered.items.some((i) => i.status === "imported"))
      throw new Error("Unexpected commit before the killed read");
    const retainedBaseline =
      (await call("copyText", baselineId)) === "confirmed baseline";
    const retried = await finished(
      (await start("retry", paths, "interrupted")).requestId,
    );
    if (retried.items.some((i) => i.status !== "imported"))
      throw new Error("Retry did not import each interrupted source");
    childPid = (await call<{ pid: number }>("ping")).pid;
    const afterCommit = join(root, "after-commit.md");
    await writeFile(
      afterCommit,
      "committed before the UI sees its terminal result",
    );
    hashes.set(
      afterCommit,
      createHash("sha256")
        .update(await readFile(afterCommit))
        .digest("hex"),
    );
    const dropped = new Promise<void>((resolve) => (terminalDropped = resolve));
    dropTerminalFor = "dropped-terminal";
    await start(dropTerminalFor, [afterCommit]);
    await Promise.race([
      dropped,
      delay(5000).then(() => {
        throw new Error("Terminal event timeout");
      }),
    ]);
    await connection.restart();
    dropTerminalFor = "";
    const terminal = await call<ImportJob>("getImport", "dropped-terminal");
    const replay = await finished(
      (await start("retry-dropped", [afterCommit], "dropped-terminal"))
        .requestId,
    );
    const page = await call<MaterialPage>("search", {
      queryId: "verify",
      text: "",
    });
    let contentLoss = 0;
    for (const item of page.items) {
      const source = [...hashes.keys()].find(path => basename(path) === item.name);
      const saved = await call<string>('copyText', item.id);
      if (!source || createHash('sha256').update(saved).digest('hex') !== hashes.get(source)) contentLoss++;
    }
    let changedSources = 0;
    for (const [path, hash] of hashes)
      if (
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex") !== hash
      )
        changedSources++;
    console.log(
      "MATERIAL_RESULT=" +
        JSON.stringify({
          interrupted: true,
          retainedBaseline,
          retryLinked: retried.retryOf === "interrupted",
          droppedTerminalRetained:
            terminal.status === "completed" &&
            terminal.items[0].status === "imported",
          replayDeduplicated: replay.items[0].status === "duplicate",
          documents: page.usage.documents,
          changedSources,
        verifiedCopies: page.items.length,
        sourceFiles: hashes.size,
        contentLoss,
        }),
    );
  } catch (error) {
    console.log("MATERIAL_RESULT=" + JSON.stringify({ error: String(error) }));
  } finally {
    await connection.close();
    app.exit(0);
  }
});
