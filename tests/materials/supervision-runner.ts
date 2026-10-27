import { app } from "electron";
import { join } from "node:path";
import { MaterialConnection } from "../../main/materials/connection";
app.setPath("userData", process.env.XIER_MATERIAL_TEST_DIR!);
app.whenReady().then(async () => {
  const events: unknown[] = [];
  const connection = new MaterialConnection(
    process.env.XIER_MATERIAL_ENTRY!,
    join(app.getPath("userData"), "supervised.sqlite"),
    (event) => events.push(event),
  );
  try {
    const first = (await connection.call("ping")) as { pid: number };
    process.kill(first.pid, "SIGKILL");
    await new Promise((resolve) => setTimeout(resolve, 800));
    const second = (await connection.call("ping")) as { pid: number };
    if (first.pid === second.pid) throw new Error("Service did not restart");
    await Promise.all([connection.restart(), connection.restart()]);
    const third = (await connection.call("ping")) as { pid: number };
    console.log(
      "MATERIAL_RESULT=" +
        JSON.stringify({
          restarted: first.pid !== second.pid,
          manualRestarted: third.pid !== second.pid,
          events: events.length,
        }),
    );
  } catch (error) {
    console.log("MATERIAL_RESULT=" + JSON.stringify({ error: String(error) }));
  } finally {
    await connection.close();
    app.exit(0);
  }
});
