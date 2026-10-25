// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OpenCodeGateway } from '../services/content-gateway/gateway';
import type { RunSnapshot } from '../common/content/contracts';
import { assistant, deferred, openCodeService, request } from './content-opencode-helpers';
const setup = () => {
  const server = openCodeService();
  const gateway = new OpenCodeGateway({ baseUrl: 'http://opencode.invalid', directory: '/isolated/work', model: { providerID: 'xier-content', modelID: 'deepseek-flash' }, fetch: server.fetch });
  return { server, gateway };
};
describe('OpenCode gateway through AgentPort and SDK HTTP', () => {
  it('acknowledges a fresh session and observes a structured rewrite without sending editor state', async () => {
    const { server, gateway } = setup();
    const observed: RunSnapshot[] = [];
    gateway.observe(request.requestId, s => observed.push(s));
    expect(await gateway.start(request)).toMatchObject({ status: 'running', sequence: 1 });
    server.prompt.resolve(Response.json(assistant()));
    await expect.poll(() => observed[observed.length - 1]?.status).toBe('completed');
    expect(observed[observed.length - 1]).toMatchObject({ requestId: 'req-1', sequence: 2, result: { replacement: '测试文字。' } });
    const sent = server.calls.find(c => c.method === 'POST' && c.path.startsWith('/session/ses-1/message'))!.body;
    expect(sent).toMatchObject({ agent: 'content', model: { providerID: 'xier-content', modelID: 'deepseek-flash' }, format: { type: 'json_schema' } });
    expect(JSON.parse(sent.parts[0].text)).toEqual({ selectedText: request.selectedText, requirement: '精简' });
    expect(JSON.stringify(sent)).not.toContain('draft-a');
  });
  it.each([undefined, {}, { replacement: '' }, { replacement: '  ' }, { replacement: 'ok', explanation: 3 }, { replacement: 'x'.repeat(20001) }])('rejects malformed structured results #%#', async value => {
    const { server, gateway } = setup();
    await gateway.start(request);
    server.prompt.resolve(Response.json(assistant(value === undefined ? null : value)));
    await expect.poll(async () => (await gateway.get('req-1')).status).toBe('failed');
    expect(await gateway.get('req-1')).toMatchObject({ error: { code: 'INVALID_RESULT' } });
    expect((await gateway.get('req-1')).result).toBeUndefined();
  });

  it('registers before awaiting: identical IDs are idempotent, conflicting inputs and other scopes are rejected', async () => {
    const { server, gateway } = setup();
    const [first, duplicate] = await Promise.all([gateway.start(request), gateway.start({ ...request })]);
    expect(duplicate).toEqual(first);
    expect(server.calls.filter(c => c.method === 'POST' && c.path === '/session')).toHaveLength(1);
    await expect.poll(() => server.calls.filter(c => c.method === 'POST' && c.path.includes('/message')).length).toBe(1);
    await expect(gateway.start({ ...request, requirement: '扩写' })).rejects.toThrow('REQUEST_CONFLICT');
    await expect(gateway.start({ ...request, requestId: 'req-2', scopeId: 'scope-b' })).rejects.toThrow('WORKSPACE_BUSY');
    server.prompt.resolve(Response.json(assistant()));
    await expect.poll(async () => (await gateway.get('req-1')).status).toBe('completed');
    expect(await gateway.start(request)).toEqual(await gateway.get('req-1'));
  });

  it('rejects an incompatible service before creating a session', async () => {
    const { server, gateway } = setup(); server.version = '9.9.9';
    expect(await gateway.start(request)).toMatchObject({ status: 'failed', error: { code: 'INCOMPATIBLE_SERVICE' } });
    expect(server.calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('validates request fields before any external request', async () => {
    const { server, gateway } = setup();
    for (const invalid of [{ ...request, selectedText: '' }, { ...request, selectedText: '字'.repeat(4001) }, { ...request, requestId: '../secret' }, { ...request, requirement: 'x'.repeat(4001) }, { ...request, model: 'attacker' }]) {
      await expect(gateway.start(invalid)).rejects.toThrow('INVALID_REQUEST');
    }
    expect(server.calls).toHaveLength(0);
  });

  it('keeps an uncertain run reserved after transport loss and never exposes the raw error', async () => {
    const { server, gateway } = setup(); const seen: RunSnapshot[] = [];
    gateway.observe('req-1', s => seen.push(s)); await gateway.start(request);
    server.prompt.reject(new Error('secret-provider-key internal-url'));
    await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
    expect(JSON.stringify(await gateway.get('req-1'))).not.toContain('secret');
    await expect(gateway.start({ ...request, requestId: 'req-2' })).rejects.toThrow('WORKSPACE_BUSY');
    expect(await gateway.start(request)).toMatchObject({ status: 'unknown' });
  });

  it('recovers the original run via bounded reads without regenerating, including missing mappings', async () => {
    const { server, gateway } = setup(); const seen: RunSnapshot[] = [];
    gateway.observe('req-1', s => seen.push(s)); await gateway.start(request);
    server.prompt.reject(new TypeError('offline'));
    await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
    server.status = { 'ses-1': { type: 'busy' } };
    expect(await gateway.get('req-1')).toMatchObject({ status: 'running', sequence: 3 });
    expect(await gateway.get('req-1')).toMatchObject({ status: 'running', sequence: 3 });
    server.status = {}; server.latest = [assistant()];
    expect(await gateway.get('req-1')).toMatchObject({ status: 'completed', sequence: 4, result: { replacement: '测试文字。' } });
    expect(server.calls.filter(c => c.method === 'POST' && c.path.includes('/message'))).toHaveLength(1);
    expect(server.calls.filter(c => c.method === 'GET' && c.path.includes('/message')).every(c => c.path.includes('limit=1'))).toBe(true);
    const count = server.calls.length;
    expect(await gateway.get('missing')).toMatchObject({ status: 'unknown' });
    expect(await gateway.cancel('missing')).toMatchObject({ status: 'unknown' });
    expect(server.calls).toHaveLength(count);
  });

  it('confirms service abort and ignores completion arriving after confirmed cancellation', async () => {
    const { server, gateway } = setup(); await gateway.start(request);
    const stopped = await gateway.cancel('req-1');
    expect(stopped.status).toBe('cancelled');
    expect(server.calls.some(c => c.path === '/session/ses-1/abort')).toBe(true);
    server.prompt.resolve(Response.json(assistant()));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(await gateway.get('req-1')).toEqual(stopped);
  });

  it('honors cancellation while session creation is still being acknowledged', async () => {
    const { server, gateway } = setup();
    const start = gateway.start(request); const cancel = gateway.cancel('req-1');
    await start;
    expect((await cancel).status).toBe('cancelled');
    expect(server.calls.filter(c => c.path === '/session/ses-1/abort')).toHaveLength(1);
  });

  it('does not let a stale query erase a newer connection-loss observation', async () => {
    const { server, gateway } = setup(); const seen: RunSnapshot[] = [];
    gateway.observe('req-1', s => seen.push(s)); await gateway.start(request);
    const blocked = deferred<void>(); const entered = deferred<void>();
    server.queryHook = async () => { entered.resolve(); await blocked.promise; };
    server.status = { 'ses-1': { type: 'busy' } };
    const query = gateway.get('req-1'); await entered.promise;
    server.prompt.reject(new Error('offline'));
    await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
    blocked.resolve(); expect((await query).status).toBe('unknown');
  });

  it('keeps abort-message races uncertain until server confirmation, and does not infer acceptance from empty history', async () => {
    const { server, gateway } = setup(); const seen: RunSnapshot[] = [];
    gateway.observe('req-1', s => seen.push(s)); await gateway.start(request);
    server.abortHook = async () => {
      server.prompt.resolve(Response.json({ info: { ...assistant().info, structured: undefined, error: { name: 'MessageAbortedError', data: { message: 'private' } } }, parts: [] }));
      await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
    };
    expect((await gateway.cancel('req-1')).status).toBe('cancelled');
    const other = setup(); other.server.recordAbort = false;
    await other.gateway.start(request);
    expect((await other.gateway.cancel('req-1')).status).toBe('unknown');
  });

  it('sanitizes definite HTTP and model failures, including setup failures', async () => {
    const denied = new OpenCodeGateway({ baseUrl: 'http://private.invalid', directory: '/isolated', model: { providerID: 'x', modelID: 'x' }, fetch: (async () => Response.json({ key: 'private-key' }, { status: 401 })) as typeof fetch });
    expect(await denied.start(request)).toMatchObject({ status: 'failed', error: { code: 'SERVICE_REJECTED' } });
    expect(JSON.stringify(await denied.get('req-1'))).not.toContain('private');
    const { server, gateway } = setup(); await gateway.start(request);
    server.prompt.resolve(Response.json({ info: { ...assistant().info, error: { name: 'ProviderAuthError', data: { message: 'private-key' } } }, parts: [] }));
    await expect.poll(async () => (await gateway.get('req-1')).status).toBe('failed');
    expect(await gateway.get('req-1')).toMatchObject({ error: { code: 'MODEL_FAILED' } });
  });

  it('returns completed when completion wins abort, and stays active when abort is unconfirmed', async () => {
    const { server, gateway } = setup(); await gateway.start(request);
    server.abortHook = async () => { server.latest = [assistant()]; };
    expect(await gateway.cancel('req-1')).toMatchObject({ status: 'completed', result: { replacement: '测试文字。' } });
    const other = setup(); await other.gateway.start(request);
    other.server.abortAcknowledged = false; other.server.status = { 'ses-1': { type: 'busy' } };
    expect((await other.gateway.cancel('req-1')).status).toBe('running');
    other.server.abortHook = async () => { throw new Error('network loss'); };
    expect((await other.gateway.cancel('req-1')).status).toBe('unknown');
  });
  it('does not complete a run using a message belonging to another session', async () => {
    const { server, gateway } = setup(); await gateway.start(request);
    server.prompt.resolve(Response.json({ ...assistant(), info: { ...assistant().info, sessionID: 'another-session' } }));
    const seen: RunSnapshot[] = []; gateway.observe('req-1', s => seen.push(s));
    await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  });

});
it('isolates failing observers and prevents snapshot mutation from corrupting future queries', async () => {
  const { server, gateway } = setup(); const seen: RunSnapshot[] = [];
  gateway.observe('req-1', () => { throw new Error('broken UI'); });
  gateway.observe('req-1', s => seen.push(s));
  const initial = await gateway.start(request);
  expect(initial.status).toBe('running');
  expect(Object.isFrozen(initial)).toBe(true);
  server.prompt.resolve(Response.json(assistant()));
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('completed');
  const result = await gateway.get('req-1'); expect(Object.isFrozen(result.result)).toBe(true);
});
it('can verify an abort error without requiring a success completion timestamp', async () => {
  const { server, gateway } = setup(); await gateway.start(request);
  server.latest = [{ info: { sessionID: 'ses-1', role: 'assistant', time: { created: 1 }, error: { name: 'MessageAbortedError' } }, parts: [] }];
  expect((await gateway.cancel('req-1')).status).toBe('cancelled');
});
it('reads the final result after the idle observation when completion races with verification', async () => {
  const { server, gateway } = setup(); await gateway.start(request);
  server.latest = [{ info: { role: 'user', sessionID: 'ses-1', time: { created: 1 } }, parts: [] }];
  server.statusHook = async () => { server.latest = [assistant()]; };
  expect(await gateway.cancel('req-1')).toMatchObject({ status: 'completed', result: { replacement: '测试文字。' } });
});
