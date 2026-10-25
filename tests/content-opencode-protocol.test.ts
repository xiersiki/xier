// @vitest-environment node
import { expect, it } from 'vitest';
import { OpenCodeAgentPort } from '../renderer/platform/content/opencode-agent';
import type { RunSnapshot } from '../common/content/contracts';
import { deferred, request } from './content-opencode-helpers';
const start = { type: 'RUN_STARTED', threadId: 'scope-a', runId: 'req-1' };
const state = (snapshot: unknown) => ({ type: 'STATE_SNAPSHOT', snapshot });
const running = { requestId: 'req-1', sequence: 1, status: 'running' };
const completed = { requestId: 'req-1', sequence: 2, status: 'completed', result: { replacement: '正确结果' } };
const finish = { type: 'RUN_FINISHED', threadId: 'scope-a', runId: 'req-1' };
function stream(events: unknown[]) { return new Response(events.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join(''), { headers: { 'content-type': 'text/event-stream' } }); }
it('requires RUN_FINISHED after a complete valid state and treats EOF as unknown', async () => {
  const seen: RunSnapshot[] = [];
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => stream([start, state(running), state(completed)])) as typeof fetch });
  port.observe('req-1', s => seen.push(s));
  await port.start(request);
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  expect(seen.some(s => s.status === 'completed')).toBe(false);
});
it('validates query results and never exposes foreign IDs, invalid results or remote error text', async () => {
  for (const bad of [{ ...completed, requestId: 'foreign' }, { ...completed, result: { replacement: '' } }, { ...completed, sequence: -1 }, { ...completed, status: 'made-up' }]) {
    const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => Response.json(bad)) as typeof fetch });
    const snapshot = await port.get('req-1');
    expect(snapshot).toMatchObject({ requestId: 'req-1', status: 'unknown' });
    expect(snapshot.result).toBeUndefined();
  }
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => Response.json({ ...running, status: 'failed', error: { code: 'MODEL_FAILED', message: 'secret backend trace' } })) as typeof fetch });
  expect(JSON.stringify(await port.get('req-1'))).not.toContain('secret');
});
it('ignores old and duplicate service sequences while a later running state invalidates an unfinished result', async () => {
  const seen: RunSnapshot[] = [];
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async (_url, init) => init?.method === 'GET'
    ? Response.json({ ...running, sequence: 3 })
    : stream([start, state(running), state(completed), state({ ...running, sequence: 3 }), state(completed), finish])) as typeof fetch });
  const off = port.observe('req-1', s => seen.push(s)); await port.start(request);
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  expect(seen.some(s => s.status === 'completed')).toBe(false);
  const old = seen[seen.length - 1]!.sequence;
  expect(await port.get('req-1')).toMatchObject({ status: 'running', sequence: old + 1 }); off();
});
it('does not create another HTTP run for repeated IDs and rejects conflicting input locally', async () => {
  let posts = 0;
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => { posts++; return stream([start, state(running), state(completed), finish]); }) as typeof fetch });
  await Promise.all([port.start(request), port.start({ ...request })]);
  expect(posts).toBe(1);
  await expect(port.start({ ...request, selectedText: 'other' })).rejects.toThrow('REQUEST_CONFLICT');
});
it('checks lifecycle correlation and recognizes explicit sanitized RUN_ERROR', async () => {
  const seen: RunSnapshot[] = [];
  const wrong = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => stream([{ ...start, runId: 'foreign' }, state(running), state(completed), finish])) as typeof fetch });
  wrong.observe('req-1', s => seen.push(s)); await wrong.start(request);
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  expect(seen.some(s => s.status === 'completed')).toBe(false);
  const failed: RunSnapshot[] = [];
  const error = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => stream([start, state(running), { type: 'RUN_ERROR', message: 'private trace', code: 'MODEL_FAILED' }])) as typeof fetch });
  error.observe('req-1', s => failed.push(s)); await error.start(request);
  await expect.poll(() => failed[failed.length - 1]?.status).toBe('failed');
  expect(JSON.stringify(failed)).not.toContain('private');
});
it('does not finish an earlier candidate after a malformed newer state', async () => {
  const seen: RunSnapshot[] = [];
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => stream([start, state(running), state(completed), state({ ...completed, sequence: 3, result: { replacement: '' } }), finish])) as typeof fetch });
  port.observe('req-1', s => seen.push(s)); await port.start(request);
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  expect(seen.some(s => s.status === 'completed')).toBe(false);
});
it('accepts a missing mapping after host restart even though the new server sequence resets to zero', async () => {
  let reads = 0;
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => Response.json(++reads === 1 ? { ...running, sequence: 8 } : { requestId: 'req-1', sequence: 0, status: 'unknown' })) as typeof fetch });
  expect((await port.get('req-1')).status).toBe('running');
  expect((await port.get('req-1')).status).toBe('unknown');
});
it('ignores a query begun before a newer local connection-loss observation', async () => {
  const delayed = deferred<Response>(); const entered = deferred<void>(); let reads = 0;
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => {
    reads++; if (reads === 1) return Response.json(running);
    if (reads === 2) { entered.resolve(); return delayed.promise; }
    throw new TypeError('offline');
  }) as typeof fetch });
  await port.get('req-1'); const old = port.get('req-1'); await entered.promise;
  expect((await port.get('req-1')).status).toBe('unknown');
  delayed.resolve(Response.json(running)); expect((await old).status).toBe('unknown');
});
it('does not treat a cancelled RUN_FINISHED outcome as successful completion', async () => {
  const seen: RunSnapshot[] = [];
  const port = new OpenCodeAgentPort({ url: 'http://gateway.invalid/runs', fetch: (async () => stream([start, state(running), state(completed), { ...finish, outcome: { type: 'cancelled' } }])) as typeof fetch });
  port.observe('req-1', s => seen.push(s)); await port.start(request);
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  expect(seen.some(s => s.status === 'completed')).toBe(false);
});
