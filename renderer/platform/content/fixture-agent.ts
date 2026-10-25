import type { AgentPort, RewriteRequest, RunSnapshot } from '../../../common/content/contracts';
interface Run { request: RewriteRequest; snapshot: RunSnapshot; timer?: ReturnType<typeof setTimeout> }
/** Explicit offline fixture; never calls a model. One instance belongs to one workspace. */
export class FixtureAgentPort implements AgentPort {
  private runs = new Map<string, Run>();
  private listeners = new Map<string, Set<(snapshot: RunSnapshot) => void>>();
  observe(id: string, listener: (snapshot: RunSnapshot) => void) {
    const set = this.listeners.get(id) ?? new Set();
    this.listeners.set(id, set); set.add(listener);
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(id); };
  }
  private publish(run: Run) { this.listeners.get(run.request.requestId)?.forEach(listener => listener(run.snapshot)); }
  async start(request: RewriteRequest): Promise<RunSnapshot> {
    const existing = this.runs.get(request.requestId);
    if (existing) {
      if (Object.keys(existing.request).some(key => existing.request[key as keyof RewriteRequest] !== request[key as keyof RewriteRequest])) throw new Error('requestId 不可复用于不同输入');
      return existing.snapshot;
    }
    if ([...this.runs.values()].some(run => run.snapshot.status === 'running')) throw new Error('已有任务正在运行');
    const run: Run = { request: { ...request }, snapshot: { requestId: request.requestId, sequence: 1, status: 'running' } };
    this.runs.set(request.requestId, run);
    run.timer = setTimeout(() => {
      run.snapshot = { requestId: request.requestId, sequence: 2, status: 'completed', result: { replacement: '让表达更清晰，让协作更顺畅。', explanation: '这是用于验证编辑流程的固定示例，不是模型生成结果。' } };
      this.publish(run);
    }, 650);
    this.publish(run); return run.snapshot;
  }
  async get(requestId: string): Promise<RunSnapshot> { return this.runs.get(requestId)?.snapshot ?? { requestId, sequence: 0, status: 'unknown' }; }
  async cancel(requestId: string): Promise<RunSnapshot> {
    const run = this.runs.get(requestId);
    if (run?.snapshot.status === 'running') {
      clearTimeout(run.timer);
      run.snapshot = { requestId, sequence: run.snapshot.sequence + 1, status: 'cancelled' };
      this.publish(run);
    }
    return this.get(requestId);
  }
}
