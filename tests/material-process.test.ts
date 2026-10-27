// @vitest-environment node
import { expect, it } from "vitest";
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const nativeIt = process.env.XIER_ELECTRON_TESTS === "1" ? it : it.skip;

async function runProcess(
  entrySource = "main/materials/entry.ts",
  evidenceFile?: string,
) {
  const directory = await mkdtemp(join(tmpdir(), "xier-material-process-"));
  try {
    const entry = join(directory, "entry.cjs");
    await build({
      entryPoints: [entrySource],
      outfile: entry,
      bundle: true,
      platform: "node",
      format: "cjs",
      external: ["electron"],
    });
    const result = await new Promise<Record<string, unknown>>(
      (resolveResult, reject) => {
        const child = spawn(
          createRequire(import.meta.url)("electron"),
          [resolve("tests/materials/process-runner.cjs")],
          {
            env: {
              ...process.env,
              XIER_MATERIAL_ENTRY: entry,
              XIER_MATERIAL_TEST_DIR: directory,
            },
          },
        );
        let output = "";
        let error = "";
        child.stdout.on("data", (data) => {
          output += data;
        });
        child.stderr.on("data", (data) => {
          error += data;
        });
        child.on("error", reject);
        child.on("exit", () => {
          const line = output
            .split("\n")
            .find((line) => line.startsWith("MATERIAL_RESULT="));
          if (!line)
            return reject(
              new Error(error || output || "Electron produced no result"),
            );
          resolveResult(JSON.parse(line.slice("MATERIAL_RESULT=".length)));
        });
      },
    );
    if (evidenceFile)
      await writeFile(evidenceFile, JSON.stringify(result, null, 2));
    return result;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

nativeIt(
  "starts a real Electron utility service, exchanges a request and exits cleanly",
  async () => {
    const result = await runProcess();
    expect(result).toMatchObject({
      protocolVersion: 1,
      process: "utility",
      electron: "45.0.0",
    });
    expect(result.error).toBeUndefined();
    console.log("Electron utility runtime:", result);
  },
  15000,
);

nativeIt(
  "validates real Electron SQLite WAL, 2 MiB transactions and 100 substring oracle queries",
  async () => {
    const result = await runProcess(
      "tests/materials/sqlite-probe.ts",
      "openspec/changes/add-local-material-service/evidence/g0-sqlite.json",
    );
    expect(result).toMatchObject({
      journal: "wal",
      correctQueries: 100,
      rollbackSafe: true,
      reopenedCount: 3,
    });
    expect(Number(result.maxCommitMs)).toBeLessThan(1000);
    expect(Number(result.controlLatencyMs)).toBeLessThan(1000);
  },
  20000,
);

nativeIt(
  "opens the partition SQLite store with WAL and FTS5 inside the product utility entry",
  async () => {
    const result = await runProcess();
    expect(result).toMatchObject({
      journal: "wal",
      fts5: true,
      schemaVersion: 1,
    });
    expect(result.sqlite).toBe("3.53.4");
  },
  15000,
);
nativeIt(
  "supervises service exits and coalesces manual restart in the real Electron host",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "xier-supervision-"));
    try {
      const entry = join(directory, "service.cjs"),
        runner = join(directory, "runner.cjs");
      await build({
        entryPoints: ["main/materials/entry.ts"],
        outfile: entry,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      await build({
        entryPoints: ["tests/materials/supervision-runner.ts"],
        outfile: runner,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      const result = await new Promise<string>((accept, reject) => {
        const child = spawn(
          createRequire(import.meta.url)("electron"),
          [runner],
          {
            env: {
              ...process.env,
              XIER_MATERIAL_ENTRY: entry,
              XIER_MATERIAL_TEST_DIR: directory,
            },
          },
        );
        let output = "";
        child.stdout.on("data", (part) => (output += part));
        child.on("error", reject);
        child.on("exit", () => accept(output));
      });
      expect(result).toContain('"restarted":true');
      expect(result).toContain('"manualRestarted":true');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
nativeIt(
  "preserves a future schema and returns an actionable startup error over the real port",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "xier-schema-"));
    try {
      const entry = join(directory, "service.cjs"),
        runner = join(directory, "runner.cjs");
      await build({
        entryPoints: ["main/materials/entry.ts"],
        outfile: entry,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      await build({
        entryPoints: ["tests/materials/schema-runner.ts"],
        outfile: runner,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      const result = await new Promise<string>((accept, reject) => {
        const child = spawn(
          createRequire(import.meta.url)("electron"),
          [runner],
          {
            env: {
              ...process.env,
              XIER_MATERIAL_ENTRY: entry,
              XIER_MATERIAL_TEST_DIR: directory,
            },
          },
        );
        let output = "";
        child.stdout.on("data", (part) => (output += part));
        child.on("error", reject);
        child.on("exit", () => accept(output));
      });
      expect(result).toContain("SCHEMA_TOO_NEW");
      expect(result).toContain('"preserved":true');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
nativeIt(
  "does not kill a healthy service when cancellation traffic fills the control plane",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "xier-control-"));
    try {
      const entry = join(directory, "service.cjs"),
        runner = join(directory, "runner.cjs");
      await build({
        entryPoints: ["tests/materials/control-probe.cjs"],
        outfile: entry,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      await build({
        entryPoints: ["tests/materials/control-runner.ts"],
        outfile: runner,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      const result = await new Promise<string>((accept, reject) => {
        const child = spawn(
          createRequire(import.meta.url)("electron"),
          [runner],
          {
            env: {
              ...process.env,
              XIER_MATERIAL_ENTRY: entry,
              XIER_MATERIAL_TEST_DIR: directory,
            },
          },
        );
        let output = "";
        child.stdout.on("data", (part) => (output += part));
        child.on("error", reject);
        child.on("exit", () => accept(output));
      });
      expect(result).toContain('"healthy":true');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
nativeIt(
  "detects a frozen utility within five seconds and permits fault recovery",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "xier-unresponsive-"));
    try {
      const entry = join(directory, "service.cjs"),
        runner = join(directory, "runner.cjs");
      await build({
        entryPoints: ["main/materials/entry.ts"],
        outfile: entry,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      await build({
        entryPoints: ["tests/materials/unresponsive-runner.ts"],
        outfile: runner,
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["electron"],
      });
      const output = await new Promise<string>((accept, reject) => {
        const child = spawn(
          createRequire(import.meta.url)("electron"),
          [runner],
          {
            env: {
              ...process.env,
              XIER_MATERIAL_ENTRY: entry,
              XIER_MATERIAL_TEST_DIR: directory,
            },
          },
        );
        let output = "";
        child.stdout.on("data", (part) => (output += part));
        child.on("error", reject);
        child.on("exit", () => accept(output));
      });
      const result = JSON.parse(
        output
          .split("\n")
          .find((line) => line.startsWith("MATERIAL_RESULT="))!
          .slice(16),
      );
      expect(result.detected).toBe(true);
      expect(result.delayMs).toBeLessThanOrEqual(5000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
