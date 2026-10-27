import { app } from "electron";
import { join } from "node:path";
import { MaterialConnection } from "../../main/materials/connection";
app.setPath("userData", process.env.XIER_MATERIAL_TEST_DIR!);
app.whenReady().then(async () => {
  const connection = new MaterialConnection(
    process.env.XIER_MATERIAL_ENTRY!,
    join(app.getPath("userData"), "probe.sqlite"),
    () => {},
  );
  try {
    const first = (await connection.call("ping")) as { pid: number };
    for (let index = 0; index < 4; index++)
      void connection.call("cancelSearch", `query-${index}`).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const second = (await connection.call("ping")) as { pid: number };
    console.log(
      "MATERIAL_RESULT=" +
        JSON.stringify({ healthy: first.pid === second.pid }),
    );
  } catch (error) {
    console.log("MATERIAL_RESULT=" + JSON.stringify({ error: String(error) }));
  } finally {
    await connection.close();
    app.exit(0);
  }
});
