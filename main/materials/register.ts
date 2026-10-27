import {
  app,
  clipboard,
  dialog,
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { appendFileSync } from "node:fs";
import { MaterialConnection } from "./connection";
import { MaterialHost } from "./host";
let mainWindow: BrowserWindow | undefined;
const enabled = process.env.XIER_DISABLE_LOCAL_MATERIALS !== "1";
const host = new MaterialHost(
  join(app.getPath("userData"), "local-materials"),
  async (path, emit) =>
    new MaterialConnection(join(__dirname, "material-service.js"), path, emit),
  async () => {
    if (!mainWindow || mainWindow.isDestroyed())
      throw new Error("WINDOW_CLOSED");
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "导入本地资料",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "文本和 Markdown", extensions: ["txt", "md", "markdown"] },
      ],
    });
    return result.canceled ? null : result.filePaths;
  },
  (event) => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send("materials:event", event);
  },
  enabled,
);
function trusted(event: IpcMainInvokeEvent | IpcMainEvent) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame
  )
    return false;
  const expected = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/html/index.html`
    : pathToFileURL(
        join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/html/index.html`),
      ).href;
  return event.senderFrame?.url.split("#")[0] === expected;
}
// Opt-in local QA only: no content, file names, key values or account data.
const traceArg = process.argv.find((arg) =>
  arg.startsWith("--material-ui-trace="),
);
const tracePath = process.argv.some((arg) => arg.startsWith("--user-data-dir="))
  ? traceArg?.slice("--material-ui-trace=".length)
  : undefined;
let traceCount = 0;
ipcMain.handle(
  "materials:trace-enabled",
  (event) => trusted(event) && Boolean(tracePath),
);
ipcMain.on("materials:trace", (event, sample) => {
  if (
    !tracePath ||
    !trusted(event) ||
    traceCount >= 500 ||
    !["click", "keydown", "input"].includes(sample?.type) ||
    !Number.isFinite(sample.durationMs) ||
    sample.durationMs < 0 ||
    sample.durationMs > 60_000
  )
    return;
  traceCount++;
  try {
    appendFileSync(
      tracePath,
      JSON.stringify({ type: sample.type, durationMs: sample.durationMs }) +
        "\n",
    );
  } catch {}
});
ipcMain.on("materials:watch", (event, lease, enabled) => {
  try {
    host.watch(trusted(event), lease, enabled === true);
  } catch {}
});
ipcMain.on("materials:ack", (event, lease, sequence) => {
  try {
    host.acknowledge(trusted(event), lease, sequence);
  } catch {}
});
ipcMain.handle("materials:enabled", (event) => {
  if (!trusted(event)) throw new Error("UNTRUSTED_SOURCE");
  return enabled;
});
ipcMain.handle("materials:auth", (event, account) =>
  host.bindAuth(trusted(event), account),
);
ipcMain.handle("materials:request", async (event, lease, method, input) => {
  const result = await host.invoke(trusted(event), lease, method, input);
  if (method === "copyText") {
    clipboard.writeText(String(result));
    return;
  }
  return result;
});
export function bindMaterialWindow(window: BrowserWindow) {
  mainWindow = window;
  window.once("closed", () => {
    if (mainWindow === window) {
      mainWindow = undefined;
      void host.close();
    }
  });
}
let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void host.close().finally(() => app.quit());
});
