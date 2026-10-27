process.parentPort.on("message", ({ ports }) => {
  const port = ports[0];
  port.on("message", ({ data }) => {
    if (data.method === "ping")
      port.postMessage({ id: data.id, result: { pid: process.pid } });
    if (data.method === "shutdown") process.exit(0);
  });
  port.start();
  port.postMessage({ type: "ready" });
});
