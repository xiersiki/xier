import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const profile = await mkdtemp(join(tmpdir(), "xier-material-package-"));
const resultPath = join(profile, "result.json");
const benchmark = process.argv[3] === "benchmark";
const child = spawn(
  resolve(process.argv[2]),
  [
    `--user-data-dir=${profile}`,
    `--material-${benchmark ? "benchmark" : "smoke"}=${resultPath}`,
  ],
  { stdio: "ignore" },
);
try {
  const code = await new Promise((accept, reject) => {
    const timer = setTimeout(
      () => {
        child.kill("SIGKILL");
        reject(new Error("Packaged material smoke timed out"));
      },
      Number(process.env.XIER_BENCH_TIMEOUT ?? 12000),
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      accept(code);
    });
  });
  assert.equal(code, 0);
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (benchmark) {
    console.log(JSON.stringify(result, null, 2));
    assert.equal(result.correct, true);
    assert.ok(result.searchColdP95Ms <= 300);
    assert.ok(result.searchWarmP95Ms <= 300);
    assert.ok(result.cancelP95Ms <= 1000);
    assert.ok(result.faultMaxMs <= 5000);
  } else {
    assert.equal(result.journal, "wal");
    assert.equal(result.process, "utility");
    assert.equal(result.fts5, true);
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  child.kill();
  await rm(profile, { recursive: true, force: true });
}
