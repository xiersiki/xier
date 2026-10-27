import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
let connect;
let receive;
process.parentPort = {
  on(_event, handler) {
    connect = handler;
  },
};
const entryPath = process.argv[2];
const databasePath = process.argv[3];
process.argv[2] = databasePath;
const port = {
  on(_event, handler) {
    receive = handler;
  },
  start() {},
  postMessage(message) {
    process.stdout.write(JSON.stringify(message) + "\n");
  },
};
await import(pathToFileURL(entryPath).href);
connect({ ports: [port] });
createInterface({ input: process.stdin }).on("line", (line) => {
  try {
    receive?.({ data: JSON.parse(line) });
  } catch (error) {
    port.postMessage({ adapterError: String(error) });
  }
});
