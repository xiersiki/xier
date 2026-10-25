import { freezeSnapshot, parseSnapshot, safeError, terminal, validRequest, validResult } from '../../../services/content-gateway/protocol';
import { HttpAgent } from '@ag-ui/client';
import type { AgentPort, RewriteRequest, RunSnapshot } from '../../../common/content/contracts';
export interface OpenCodeAgentOptions { url: string; headers?: Record<string, string>; fetch?: typeof fetch; timeoutMs?: number; pollIntervalMs?: number }
export class OpenCodeAgentPort implements AgentPort {
  private unmapped = new Set<string>();
  private streams = new Set<string>();
  private polls = new Map<string, ReturnType<typeof setTimeout>>();
  private requests = new Map<string, RewriteRequest>();
  private starts = new Map<string, Promise<RunSnapshot>>();
  // Server revisions and local connection-state revisions are deliberately independent.
  private serverSequences = new Map<string, number>();
  private snapshots = new Map<string, RunSnapshot>();
  private listeners = new Map<string, Set<(snapshot: RunSnapshot) => void>>();
  constructor(private options: OpenCodeAgentOptions) {}
  observe(id: string, listener: (snapshot: RunSnapshot) => void) {
    const set = this.listeners.get(id) ?? new Set(); this.listeners.set(id, set); set.add(listener);
    this.resumeObservation(id);
    return () => { set.delete(listener); if (!set.size) { this.listeners.delete(id); clearTimeout(this.polls.get(id)); this.polls.delete(id); } };
  }
  private resumeObservation(id: string) {
    if (this.streams.has(id) || this.polls.has(id) || !this.listeners.get(id)?.size || this.snapshots.get(id)?.status !== 'running') return;
    const timer = setTimeout(() => { this.polls.delete(id); void this.control(id, 'get'); }, Math.max(10, this.options.pollIntervalMs ?? 1000));
    this.polls.set(id, timer);
  }
  private publish(snapshot: RunSnapshot) {
    const previous = this.snapshots.get(snapshot.requestId);
    if (previous && terminal(previous.status)) return previous;
    if (previous && previous.status === snapshot.status && JSON.stringify(previous.result) === JSON.stringify(snapshot.result) && JSON.stringify(previous.error) === JSON.stringify(snapshot.error)) return previous;
    if (snapshot.status !== 'running') { clearTimeout(this.polls.get(snapshot.requestId)); this.polls.delete(snapshot.requestId); }
    const local = freezeSnapshot({ ...snapshot, sequence: (previous?.sequence ?? 0) + 1 });
    this.snapshots.set(snapshot.requestId, local); this.listeners.get(snapshot.requestId)?.forEach(fn => { try { fn(local); } catch { /* Isolate consumers. */ } });
    return local;
  }
  async start(request: RewriteRequest): Promise<RunSnapshot> {
    if (!validRequest(request)) throw new Error('INVALID_REQUEST');
    const old = this.requests.get(request.requestId);
    if (old) {
      if (Object.keys(old).some(k => old[k as keyof RewriteRequest] !== request[k as keyof RewriteRequest])) throw new Error('REQUEST_CONFLICT');
      return this.snapshots.get(request.requestId) ?? this.starts.get(request.requestId)!;
    }
    request = { ...request }; this.requests.set(request.requestId, request);
    this.unmapped.delete(request.requestId); this.streams.add(request.requestId);
    const agent = new HttpAgent({ url: this.options.url, headers: this.options.headers, threadId: request.scopeId,
      fetch: (url, init) => (this.options.fetch ?? fetch)(url, { ...init, signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(this.options.timeoutMs ?? 120000)]) }),
    });
    const pending = new Promise<RunSnapshot>(resolve => {
      // A structured state alone is not a successfully finished AG-UI run.
      let candidate: RunSnapshot | undefined; let started = false; let invalid = false;
      void agent.runAgent({ runId: request.requestId, forwardedProps: { request } }, {
        onRunStartedEvent: ({ event }) => { started = event.runId === request.requestId && event.threadId === request.scopeId; },
        onRunErrorEvent: ({ event }) => { if (started && !this.unmapped.has(request.requestId)) resolve(this.publish({ requestId: request.requestId, sequence: 0, status: 'failed', error: safeError(event.code) })); },
        onStateSnapshotEvent: ({ event }) => {
          if (!started || invalid || this.unmapped.has(request.requestId)) return;
          const snapshot = parseSnapshot(event.snapshot, request.requestId);
          if (!snapshot) { candidate = undefined; invalid = true; return; }
          if (snapshot.sequence <= (this.serverSequences.get(request.requestId) ?? -1)) return;
          this.serverSequences.set(request.requestId, snapshot.sequence); candidate = undefined;
          if (snapshot.status === 'completed') { candidate = validResult(snapshot.result) ? snapshot : undefined; return; }
          resolve(this.publish(snapshot));
        },
        onRunFinishedEvent: ({ event, outcome }) => {
          if (outcome === 'success' && !this.unmapped.has(request.requestId) && !invalid && started && event.runId === request.requestId && event.threadId === request.scopeId && candidate) { resolve(this.publish(candidate)); }
        },
      }).catch((error: unknown) => {
        const failure = error as { status?: number; payload?: { code?: unknown } };
        if (failure.status && failure.status >= 400 && failure.status < 500) {
          const code = failure.status === 409 ? failure.payload?.code : 'SERVICE_REJECTED';
          resolve(this.publish({ requestId: request.requestId, sequence: 0, status: 'failed', error: safeError(code) }));
        }
      }).finally(() => {
        this.streams.delete(request.requestId);
        const last = this.snapshots.get(request.requestId);
        if (last && terminal(last.status)) { resolve(last); return; }
        const unknown: RunSnapshot = { requestId: request.requestId, sequence: (last?.sequence ?? 0) + 1, status: 'unknown' };
        resolve(this.publish(unknown));
      });
    });
    this.starts.set(request.requestId, pending); return pending;
  }
  private async control(requestId: string, action: 'get' | 'cancel'): Promise<RunSnapshot> {
    await this.starts.get(requestId);
    const sequence = this.snapshots.get(requestId)?.sequence ?? 0;
    try {
      const response = await (this.options.fetch ?? fetch)(`${this.options.url}/${encodeURIComponent(requestId)}${action === 'cancel' ? '/cancel' : ''}`, { method: action === 'cancel' ? 'POST' : 'GET', headers: this.options.headers, signal: AbortSignal.timeout(this.options.timeoutMs ?? 10000) });
      if (!response.ok) throw new Error('QUERY_FAILED');
      const snapshot = parseSnapshot(await response.json(), requestId);
      if ((this.snapshots.get(requestId)?.sequence ?? 0) !== sequence) return this.snapshots.get(requestId)!;
      if (!snapshot) throw new Error('INVALID_SNAPSHOT');
      if (snapshot.status === 'unknown' && snapshot.sequence === 0) {
        this.unmapped.add(requestId); return this.publish(snapshot);
      }
      if (snapshot.sequence < (this.serverSequences.get(requestId) ?? -1)) return this.snapshots.get(requestId)!;
      this.serverSequences.set(requestId, snapshot.sequence);
      const local = this.publish(snapshot); this.resumeObservation(requestId); return local;
    } catch {
      if ((this.snapshots.get(requestId)?.sequence ?? 0) !== sequence) return this.snapshots.get(requestId)!;
      return this.publish({ requestId, sequence: 0, status: 'unknown' });
    }
  }
  get(requestId: string) { return this.control(requestId, 'get'); }
  cancel(requestId: string) { return this.control(requestId, 'cancel'); }
}
