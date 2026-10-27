import { app, MessageChannelMain, utilityProcess } from "electron";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
/** Local CLI probe; always run with an isolated --user-data-dir. Never exposed over IPC. */
export function smokeMaterials(resultPath: string) {
  const child = utilityProcess.fork(join(__dirname, "material-service.js"), [
    join(app.getPath("userData"), "smoke.sqlite"),
  ]);
  const { port1, port2 } = new MessageChannelMain();
  let finished = false;
  const finish = (result: unknown, code: number) => {
    if (finished) return;
    finished = true;
    writeFileSync(resultPath, JSON.stringify(result));
    port1.close();
    child.kill();
    app.exit(code);
  };
  port1.on("message", ({ data }) => {
    if (data.type === "ready")
      port1.postMessage({ id: "probe", method: "ping" });
    if (data.id === "probe") finish(data.result, 0);
  });
  port1.start();
  child.postMessage({ type: "connect" }, [port2]);
  child.on("exit", (code) => finish({ error: `Service exited: ${code}` }, 1));
  setTimeout(() => finish({ error: "Service ready timeout" }, 1), 5000);
}
