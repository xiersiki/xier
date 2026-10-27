const { app, utilityProcess, MessageChannelMain } = require("electron");
const { join } = require("node:path");
app.setPath("userData", process.env.XIER_MATERIAL_TEST_DIR);
app.whenReady().then(() => {
  const child = utilityProcess.fork(
    process.env.XIER_MATERIAL_ENTRY,
    [join(process.env.XIER_MATERIAL_TEST_DIR, "materials.sqlite")],
    { stdio: "pipe" },
  );
  let finished = false;
  const finish = (value) => {
    if (finished) return;
    finished = true;
    console.log("MATERIAL_RESULT=" + JSON.stringify(value));
    child.kill();
    app.exit(value.error ? 1 : 0);
  };
  child.stderr?.on("data", (data) => process.stderr.write(data));
  const { port1, port2 } = new MessageChannelMain();
  let probe;
  let controlStart;
  let controlLatencyMs;
  port1.on("message", ({ data }) => {
    if (data.type === "ready") {
      port1.postMessage({ id: "probe", method: "ping" });
      setTimeout(() => {
        controlStart = performance.now();
        port1.postMessage({ id: "control", method: "ping" });
      }, 5);
    } else if (data.id === "probe") probe = data.result;
    else if (data.id === "control")
      controlLatencyMs = performance.now() - controlStart;
    if (probe && controlLatencyMs !== undefined)
      finish({ ...probe, controlLatencyMs });
  });
  port1.start();
  child.postMessage({ type: "connect" }, [port2]);
  child.on("exit", (code) => finish({ error: `Service exited: ${code}` }));
  setTimeout(
    () => finish({ error: "Service did not become ready and answer ping" }),
    5000,
  );
});
