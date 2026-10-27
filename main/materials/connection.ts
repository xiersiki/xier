import {
  MessageChannelMain,
  utilityProcess,
  type UtilityProcess,
  type MessagePortMain,
} from "electron";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { MaterialEvent } from "../../common/materials";
interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  control: boolean;
  method: string;
}
/** Private MessagePort supervisor. Old generations cannot deliver replies or restart a new scope. */
export class MaterialConnection {
  private child: UtilityProcess | undefined;
  private port: MessagePortMain | undefined;
  private pending = new Map<string, Pending>();
  private starting: Promise<void> | undefined;
  private restartPromise: Promise<void> | undefined;
  private desired = true;
  private generation = 0;
  private attempts: number[] = [];
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private unavailable = false;
  private lastMessage = Date.now();
  private hardKill(child: UtilityProcess) {
    const pid = child.pid;
    if (!pid) return;
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
  constructor(
    private entry: string,
    private path: string,
    private emit: (event: MaterialEvent) => void,
  ) {}
  private status(status: "starting" | "ready" | "unavailable", error?: string) {
    this.emit({ type: "service", lease: "", status, error });
  }
  private ensure(): Promise<void> {
    if (!this.desired) return Promise.reject(new Error("SERVICE_STOPPING"));
    if (this.unavailable)
      return Promise.reject(new Error("SERVICE_UNAVAILABLE"));
    if (this.starting) return this.starting;
    if (this.port) return Promise.resolve();
    const generation = ++this.generation;
    this.status("starting");
    const launch = (async () => {
      await mkdir(dirname(this.path), { recursive: true });
      if (generation !== this.generation || !this.desired)
        throw new Error("STALE_LEASE");
      const child = utilityProcess.fork(this.entry, [this.path], {
        stdio: "pipe",
      });
      this.child = child;
      const { port1, port2 } = new MessageChannelMain();
      this.port = port1;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.status("unavailable", "SERVICE_READY_TIMEOUT");
          reject(new Error("SERVICE_READY_TIMEOUT"));
          this.hardKill(child);
        }, 5000);
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("SERVICE_EXITED"));
        });
        port1.on("message", ({ data }) => {
          if (generation !== this.generation) return;
          this.lastMessage = Date.now();
          if (data.type === "startup-error") {
            clearTimeout(timer);
            this.unavailable = true;
            this.status("unavailable", data.error);
            reject(new Error(data.error));
            this.hardKill(child);
            return;
          }
          if (data.type === "ready") {
            clearTimeout(timer);
            resolve();
            return;
          }
          if (data.type === "event") {
            this.emit(data.event);
            return;
          }
          const pending = this.pending.get(data.id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(data.id);
          if (data.error) pending.reject(new Error(data.error));
          else pending.resolve(data.result);
        });
        child.on("exit", () => {
          if (generation !== this.generation) return;
          this.drop("UNKNOWN_OUTCOME");
          this.child = undefined;
          this.port = undefined;
          this.starting = undefined;
          if (!this.desired) return;
          if (!this.unavailable) {
            this.status("unavailable", "SERVICE_EXITED");
            this.scheduleRestart();
          }
        });
        port1.start();
        child.postMessage({ type: "connect" }, [port2]);
      });
      if (generation !== this.generation) throw new Error("STALE_LEASE");
      this.lastMessage = Date.now();
      this.status("ready");
      let pinging = false;
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastMessage >= 4000) {
          this.status("unavailable", "SERVICE_UNRESPONSIVE");
          this.hardKill(child);
          return;
        }
        if (pinging) return;
        pinging = true;
        this.send("ping", undefined, true, 3500)
          .catch((error) => {
            if (
              generation === this.generation &&
              String(error) !== "Error: BUSY"
            ) {
              this.status("unavailable", "SERVICE_UNRESPONSIVE");
              this.hardKill(child);
            }
          })
          .finally(() => {
            pinging = false;
          });
      }, 1000);
    })();
    this.starting = launch;
    void launch.catch(() => {
      if (this.starting === launch) this.starting = undefined;
    });
    return launch;
  }
  private scheduleRestart() {
    if (!this.desired) return;
    this.attempts = this.attempts.filter((t) => Date.now() - t < 60000);
    if (this.attempts.length >= 2) {
      this.unavailable = true;
      this.status("unavailable", "RESTART_LIMIT");
      return;
    }
    this.attempts.push(Date.now());
    this.retry = setTimeout(() => {
      this.retry = undefined;
      void this.ensure().catch(() => {});
    }, 100 * this.attempts.length);
  }
  private drop(code: string) {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.port?.close();
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(code));
    }
    this.pending.clear();
  }
  private send(
    method: string,
    input: unknown,
    control: boolean,
    timeout = 10000,
  ) {
    const count = [...this.pending.values()].filter((p) =>
      method === "ping"
        ? p.method === "ping"
        : p.control === control && p.method !== "ping",
    ).length;
    if (count >= (method === "ping" ? 1 : control ? 3 : 32))
      return Promise.reject(new Error("BUSY"));
    const id = randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("UNKNOWN_OUTCOME"));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer, control, method });
      try {
        this.port!.postMessage({ id, method, input });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  async call(method: string, input?: unknown) {
    await this.ensure();
    return this.send(
      method,
      input,
      ["ping", "cancelImport", "cancelSearch"].includes(method),
    );
  }
  private async stop() {
    if (this.retry) clearTimeout(this.retry);
    this.retry = undefined;
    const child = this.child,
      port = this.port;
    this.generation++;
    this.child = undefined;
    this.port = undefined;
    this.starting = undefined;
    if (child) {
      const exited = new Promise<void>((resolve) => {
        const force = setTimeout(() => this.hardKill(child), 1500);
        const hard = setTimeout(resolve, 2000);
        child.once("exit", () => {
          clearTimeout(force);
          clearTimeout(hard);
          resolve();
        });
      });
      try {
        port?.postMessage({ id: "shutdown", method: "shutdown" });
      } catch {}
      this.drop("UNKNOWN_OUTCOME");
      await exited;
      port?.close();
    } else this.drop("UNKNOWN_OUTCOME");
  }
  restart() {
    if (this.restartPromise) return this.restartPromise;
    this.restartPromise = (async () => {
      await this.stop();
      if (!this.desired) throw new Error("SERVICE_STOPPING");
      this.attempts = [];
      this.unavailable = false;
      await this.ensure();
    })().finally(() => {
      this.restartPromise = undefined;
    });
    return this.restartPromise;
  }
  async close() {
    this.desired = false;
    await this.stop();
  }
}
