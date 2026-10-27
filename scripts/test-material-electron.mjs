import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [
    join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
    "run",
    "tests/material-process.test.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, XIER_ELECTRON_TESTS: "1" },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
