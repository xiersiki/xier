import { freezeSnapshot, terminal, validRequest, validResult } from './protocol';
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { AgentPort, RewriteRequest, RunSnapshot } from '../../common/content/contracts';
export interface GatewayOptions {
  /** Connect only to a host-owned restricted OpenCode service. */
  baseUrl: string;
  directory: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  model: { providerID: string; modelID: string };
  timeoutMs?: number;
}
interface Run {
  request: RewriteRequest;
  snapshot: RunSnapshot;
  sessionId?: string;
  abortAccepted?: boolean;
  ready?: Promise<RunSnapshot>;
}
/** One instance per trusted workspace. Unknown is nonterminal and retains its reservation. */
export class OpenCodeGateway implements AgentPort {
  private client;
  private runs = new Map<string, Run>();
  private listeners = new Map<string, Set<(snapshot: RunSnapshot) => void>>();
  constructor(private options: GatewayOptions) { this.client = createOpencodeClient(options); }
  observe(id: string, listener: (snapshot: RunSnapshot) => void) {
    const set = this.listeners.get(id) ?? new Set(); this.listeners.set(id, set); set.add(listener);
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(id); };
  }
  private publish(run: Run) {
    run.snapshot = freezeSnapshot(run.snapshot);
    this.listeners.get(run.request.requestId)?.forEach(fn => { try { fn(run.snapshot); } catch { /* Observers do not own execution. */ } });
  }
  async start(request: RewriteRequest): Promise<RunSnapshot> {
    if (!validRequest(request)) throw new Error('INVALID_REQUEST');
    const existing = this.runs.get(request.requestId);
    if (existing) {
      if (Object.keys(existing.request).some(k => existing.request[k as keyof RewriteRequest] !== request[k as keyof RewriteRequest])) throw new Error('REQUEST_CONFLICT');
      return existing.snapshot;
    }
    if ([...this.runs.values()].some(r => !terminal(r.snapshot.status))) throw new Error('WORKSPACE_BUSY');
    const run: Run = { request: { ...request }, snapshot: freezeSnapshot({ requestId: request.requestId, sequence: 1, status: 'running' }) };
    this.runs.set(request.requestId, run);
    run.ready = this.initialize(run).catch(error => this.externalFailure(run, error));
    return run.ready;
  }
  private async initialize(run: Run): Promise<RunSnapshot> {
    const request = run.request;
    const health = (await this.client.global.health(this.requestOptions())).data;
    if (health.version !== '1.19.4') {
      run.snapshot = { requestId: request.requestId, sequence: 2, status: 'failed', error: { code: 'INCOMPATIBLE_SERVICE', message: '需要 OpenCode 1.19.4' } };
      this.publish(run); return run.snapshot;
    }
    const session = (await this.client.session.create({ title: 'Content rewrite' }, this.requestOptions())).data;
    run.sessionId = session.id;
    void this.client.session.prompt({ sessionID: session.id, agent: 'content', model: this.options.model,
      system: 'Rewrite only the supplied text according to the requirement. Return structured output. Do not use tools other than StructuredOutput.',
      format: { type: 'json_schema', schema: { type: 'object', properties: { replacement: { type: 'string' }, explanation: { type: 'string' } }, required: ['replacement'], additionalProperties: false } },
      parts: [{ type: 'text', text: JSON.stringify({ selectedText: request.selectedText, requirement: request.requirement }) }],
    }, this.requestOptions(120000)).then(response => {
      this.finish(run, response.data);
    }).catch(error => this.externalFailure(run, error));
    this.publish(run); return run.snapshot;
  }
  private requestOptions(defaultTimeout = 10000) {
    return { throwOnError: true as const, signal: AbortSignal.timeout(this.options.timeoutMs ?? defaultTimeout) };
  }
  private externalFailure(run: Run, error: unknown) {
    const status = (error as { cause?: { status?: number } } | undefined)?.cause?.status;
    return this.change(run, status && status >= 400 && status < 500
      ? { status: 'failed', error: { code: 'SERVICE_REJECTED', message: '服务拒绝请求，请检查连接配置' } }
      : { status: 'unknown', error: { code: 'CONNECTION_LOST', message: '连接中断，请核实任务状态' } });
  }
  private change(run: Run, next: Omit<RunSnapshot, 'requestId' | 'sequence'>) {
    const old = run.snapshot;
    if (terminal(old.status)) return old;
    if (old.status === next.status && JSON.stringify(old.result) === JSON.stringify(next.result) && JSON.stringify(old.error) === JSON.stringify(next.error)) return old;
    run.snapshot = { requestId: run.request.requestId, sequence: old.sequence + 1, ...next };
    this.publish(run); return run.snapshot;
  }
  private finish(run: Run, message: { info: { sessionID: string; role: string; time: { created: number; completed?: number }; structured?: unknown; error?: { name: string } } }, verifiedIdle = false) {
    if (message.info.sessionID !== run.sessionId || message.info.role !== 'assistant') return this.change(run, { status: 'unknown' });
    if (message.info.error?.name === 'MessageAbortedError') return this.change(run, { status: verifiedIdle && run.abortAccepted ? 'cancelled' : 'unknown' });
    if (message.info.error) return this.change(run, { status: 'failed', error: { code: 'MODEL_FAILED', message: '模型未完成改写，请检查服务配置' } });
    if (!message.info.time.completed) return this.change(run, { status: 'unknown' });
    const result = message.info.structured;
    return this.change(run, validResult(result) ? { status: 'completed', result } : { status: 'failed', error: { code: 'INVALID_RESULT', message: '服务未返回有效改写结果' } });
  }
  async get(requestId: string): Promise<RunSnapshot> {
    const run = this.runs.get(requestId);
    if (!run) return { requestId, sequence: 0, status: 'unknown' };
    if (terminal(run.snapshot.status) || !run.sessionId) return run.snapshot;
    const sequence = run.snapshot.sequence;
    try {
      // Read the result AFTER the idle observation so a just-finished run wins cancellation.
      const states = (await this.client.session.status({}, this.requestOptions())).data;
      const messages = (await this.client.session.messages({ sessionID: run.sessionId, limit: 1 }, this.requestOptions())).data;
      if (run.snapshot.sequence !== sequence) return run.snapshot;
      if (states[run.sessionId] && states[run.sessionId].type !== 'idle') return this.change(run, { status: 'running' });
      const message = messages[0];
      if (message?.info.role === 'assistant' && (message.info.time.completed || message.info.error)) return this.finish(run, message, true);
      // An abort acknowledgement plus an empty/user-only history is not completion proof.
      return this.change(run, { status: 'unknown' });
    } catch {
      if (run.snapshot.sequence !== sequence) return run.snapshot;
      return this.change(run, { status: 'unknown', error: { code: 'CONNECTION_LOST', message: '连接中断，请核实任务状态' } });
    }
  }
  async cancel(requestId: string): Promise<RunSnapshot> {
    const run = this.runs.get(requestId);
    if (!run) return this.get(requestId);
    await run.ready;
    if (terminal(run.snapshot.status) || !run.sessionId) return this.get(requestId);
    try {
      run.abortAccepted = (await this.client.session.abort({ sessionID: run.sessionId }, this.requestOptions())).data === true;
      return this.get(requestId);
    } catch {
      return this.change(run, { status: 'unknown', error: { code: 'CONNECTION_LOST', message: '连接中断，请核实任务状态' } });
    }
  }
}
