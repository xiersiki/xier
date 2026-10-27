import { app } from "electron";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { MaterialConnection } from "../../main/materials/connection";
app.setPath("userData", process.env.XIER_MATERIAL_TEST_DIR!);
app.whenReady().then(async () => {
  let unavailableAt: number | undefined;
  let pid: number | undefined;
  const connection = new MaterialConnection(
    process.env.XIER_MATERIAL_ENTRY!,
    join(app.getPath("userData"), "unresponsive.sqlite"),
    (event) => {
      if (
        event.type === "service" &&
        event.status === "unavailable" &&
        unavailableAt === undefined
      )
        unavailableAt = performance.now();
    },
  );
  try {
    const ping = (await connection.call("ping")) as { pid: number };
    pid = ping.pid;
    const at = performance.now();
    process.kill(pid, "SIGSTOP");
    await new Promise((resolve) => setTimeout(resolve, 5500));
    console.log(
      "MATERIAL_RESULT=" +
        JSON.stringify({
          detected: unavailableAt !== undefined,
          delayMs: unavailableAt === undefined ? null : unavailableAt - at,
        }),
    );
  } catch (error) {
    console.log("MATERIAL_RESULT=" + JSON.stringify({ error: String(error) }));
  } finally {
    if (pid) {
      try {
        process.kill(pid, "SIGCONT");
      } catch {}
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
    await connection.close();
    app.exit(0);
  }
});
