export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const request = { requestId: 'req-1', scopeId: 'scope-a', draftId: 'draft-a', selectedText: '这是一段测试文字。', requirement: '精简' };
export const assistant = (structured: unknown = { replacement: '测试文字。', explanation: '精简表达' }) => ({ info: { id: 'msg-a', sessionID: 'ses-1', role: 'assistant', time: { created: 1, completed: 2 }, structured }, parts: [] });
/** Fake external HTTP service; real SDK serializes/deserializes every call. No application modules mocked. */
export function openCodeService() {
  const prompt = deferred<Response>();
  const calls: { path: string; method: string; body?: any }[] = [];
  const service = {
    prompt, calls, version: '1.19.4', latest: [] as unknown[], status: {} as Record<string, { type: string }>, abortAcknowledged: true, recordAbort: true,
    statusHook: undefined as undefined | (() => Promise<void>),
    abortHook: undefined as undefined | (() => Promise<void>), queryHook: undefined as undefined | (() => Promise<void>),
    fetch: (async (input: RequestInfo | URL) => {
      const req = input as Request;
      const url = new URL(req.url);
      calls.push({ path: url.pathname + url.search, method: req.method, body: req.method === 'POST' ? await req.json().catch(() => undefined) : undefined });
      const json = (v: unknown) => Response.json(v);
      if (url.pathname === '/global/health') return json({ healthy: true, version: service.version });
      if (url.pathname === '/session' && req.method === 'POST') return json({ id: 'ses-1' });
      if (url.pathname === '/session/ses-1/message' && req.method === 'POST') return prompt.promise;
      if (url.pathname === '/session/ses-1/message' && req.method === 'GET') { await service.queryHook?.(); return json(service.latest); }
      if (url.pathname === '/session/status') { await service.statusHook?.(); return json(service.status); }
      if (url.pathname === '/session/ses-1/abort') { await service.abortHook?.(); if (service.abortAcknowledged && service.recordAbort && !service.latest.length) service.latest = [{ info: { ...assistant().info, structured: undefined, error: { name: 'MessageAbortedError' } }, parts: [] }]; return json(service.abortAcknowledged); }
      throw new Error('Unexpected fake OpenCode HTTP request: ' + req.method + ' ' + url.pathname);
    }) as typeof fetch,
  };
  return service;
}
