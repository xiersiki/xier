import { app } from "electron";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { MaterialConnection } from "../../main/materials/connection";
app.setPath("userData", process.env.XIER_MATERIAL_TEST_DIR!);
app.whenReady().then(async () => {
  const path = join(app.getPath("userData"), "future.sqlite");
  const database = new DatabaseSync(path);
  database.exec("PRAGMA user_version=99");
  database.close();
  const before = readFileSync(path);
  const connection = new MaterialConnection(
    process.env.XIER_MATERIAL_ENTRY!,
    path,
    () => {},
  );
  try {
    await connection.call("ping");
    console.log(
      "MATERIAL_RESULT=" + JSON.stringify({ error: "unexpected success" }),
    );
  } catch (error) {
    console.log(
      "MATERIAL_RESULT=" +
        JSON.stringify({
          error: String(error),
          preserved: before.equals(readFileSync(path)),
        }),
    );
  } finally {
    await connection.close();
    app.exit(0);
  }
});
