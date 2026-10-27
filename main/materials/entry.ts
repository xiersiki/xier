import { MaterialService } from "./service";
interface Port {
  postMessage(value: unknown): void;
  on(
    event: "message",
    listener: (event: {
      data: { id: string; method: string; input?: unknown };
    }) => void,
  ): void;
  start(): void;
}
const parent = (
  process as typeof process & {
    parentPort: {
      on(event: "message", listener: (event: { ports: Port[] }) => void): void;
    };
  }
).parentPort;
parent.on("message", ({ ports }) => {
  const port = ports[0];
  let service: MaterialService;
  try {
    service = new MaterialService(process.argv[2], (event) =>
      port.postMessage({ type: "event", event }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code =
      message === "SCHEMA_TOO_NEW"
        ? "SCHEMA_TOO_NEW"
        : /malformed|not a database|corrupt/i.test(message)
          ? "DATABASE_CORRUPT"
          : /readonly|EACCES|EPERM/i.test(message)
            ? "READ_ONLY"
            : "STORAGE_UNAVAILABLE";
    port.start();
    port.postMessage({ type: "startup-error", error: code });
    return;
  }
  let pending = 0;
  port.on("message", async ({ data }) => {
    const control = [
      "ping",
      "cancelImport",
      "cancelSearch",
      "shutdown",
    ].includes(data.method);
    if (!control && pending >= 32) {
      port.postMessage({ id: data.id, error: "BUSY" });
      return;
    }
    if (!control) pending++;
    try {
      if (data.method === "shutdown") {
        await service.close();
        port.postMessage({ id: data.id, result: null });
        process.exit(0);
      }
      const result = await service.request(data.method, data.input);
      port.postMessage({ id: data.id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SERVICE_ERROR";
      port.postMessage({
        id: data.id,
        error: /^[A-Z_]+$/.test(message) ? message : "STORAGE_UNAVAILABLE",
      });
    } finally {
      if (!control) pending--;
    }
  });
  port.start();
  port.postMessage({ type: "ready" });
});
