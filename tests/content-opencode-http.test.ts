// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { OpenCodeGateway } from '../services/content-gateway/gateway';
import { createContentGatewayHandler } from '../services/content-gateway/http';
import { OpenCodeAgentPort } from '../renderer/platform/content/opencode-agent';
import type { RunSnapshot } from '../common/content/contracts';
import { assistant, openCodeService, request } from './content-opencode-helpers';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function setup() {
  const upstream = openCodeService();
  const gateway = new OpenCodeGateway({ baseUrl: 'http://fake.invalid', directory: '/isolated', model: { providerID: 'xier-content', modelID: 'deepseek-flash' }, fetch: upstream.fetch });
  const server = createServer(createContentGatewayHandler(gateway, req => req.headers.authorization === 'Bearer test-host-token'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/runs`;
  return { upstream, gateway, url, port: new OpenCodeAgentPort({ url, headers: { authorization: 'Bearer test-host-token' } }) };
}
it('uses real AG-UI HTTP to acknowledge, observe and query a structured suggestion', async () => {
  const { port, upstream } = await setup(); const seen: RunSnapshot[] = [];
  port.observe('req-1', s => seen.push(s));
  expect((await port.start(request)).status).toBe('running');
  upstream.prompt.resolve(Response.json(assistant()));
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('completed');
  expect(await port.get('req-1')).toMatchObject({ status: 'completed', result: { replacement: '测试文字。' } });
});
it('queries the same run after a lost upstream connection without repeating generation', async () => {
  const { port, upstream } = await setup(); const seen: RunSnapshot[] = [];
  port.observe('req-1', s => seen.push(s)); await port.start(request);
  upstream.prompt.reject(new Error('lost upstream'));
  await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
  upstream.latest = [assistant()];
  const recovered = await port.get('req-1');
  expect(recovered).toMatchObject({ status: 'completed', result: { replacement: '测试文字。' } });
  expect(recovered.sequence).toBeGreaterThan(seen.find(s => s.status === 'unknown')!.sequence);
  expect(upstream.calls.filter(c => c.method === 'POST' && c.path.includes('/message'))).toHaveLength(1);
});
it('unsubscribe only detaches while cancel reaches OpenCode and returns its confirmed state', async () => {
  const { port, upstream } = await setup(); const seen: RunSnapshot[] = [];
  const off = port.observe('req-1', s => seen.push(s)); await port.start(request);
  off(); const before = seen.length;
  expect(upstream.calls.some(c => c.path.includes('/abort'))).toBe(false);
  expect((await port.cancel('req-1')).status).toBe('cancelled');
  expect(upstream.calls.filter(c => c.path === '/session/ses-1/abort')).toHaveLength(1);
  expect(seen).toHaveLength(before);
});
it('requires host authorization on every route and rejects extra generation context', async () => {
  const { url, upstream } = await setup();
  const input = { runId: 'req-1', threadId: 'scope-a', state: {}, messages: [], tools: [], context: [], forwardedProps: { request } };
  for (const [endpoint, method, body] of [[url, 'POST', JSON.stringify(input)], [url + '/req-1', 'GET', undefined], [url + '/req-1/cancel', 'POST', undefined]] as const) {
    const response = await fetch(endpoint, { method, body, headers: { 'content-type': 'application/json' } });
    expect(response.status).toBe(403); await response.text();
  }
  for (const bad of [{ ...input, messages: [{ id: 'm', role: 'user', content: 'unrelated history' }] }, { ...input, runId: 'wrong-id' }, { ...input, forwardedProps: { request, model: 'other-model' } }]) {
    const response = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer test-host-token', 'content-type': 'application/json' }, body: JSON.stringify(bad) });
    expect(response.status).toBe(400); await response.text();
  }
  expect(upstream.calls).toHaveLength(0);
});
it('turns a stalled stream into unknown within the configured timeout', async () => {
  const server = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.flushHeaders(); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const port = new OpenCodeAgentPort({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/runs`, timeoutMs: 30 });
  const result = await Promise.race([port.start(request), new Promise(resolve => setTimeout(() => resolve('still waiting'), 200))]);
  expect(result).toMatchObject({ requestId: 'req-1', status: 'unknown' });
});
it('reports a definite workspace conflict from another client while preserving the active run', async () => {
  const { port, upstream, url } = await setup(); await port.start(request);
  const other = new OpenCodeAgentPort({ url, headers: { authorization: 'Bearer test-host-token' } });
  expect(await other.start({ ...request, requestId: 'req-2' })).toMatchObject({ status: 'failed', error: { code: 'WORKSPACE_BUSY' } });
  expect(upstream.calls.filter(c => c.method === 'POST' && c.path.includes('/message'))).toHaveLength(1);
  expect((await port.cancel('req-1')).status).toBe('cancelled');
});
it('resumes observation with read-only polling when explicit recovery finds an active run', async () => {
  const { url, upstream } = await setup();
  const port = new OpenCodeAgentPort({ url, headers: { authorization: 'Bearer test-host-token' }, pollIntervalMs: 10 });
  const seen: RunSnapshot[] = []; const off = port.observe('req-1', s => seen.push(s));
  try {
    await port.start(request); upstream.prompt.reject(new Error('offline'));
    await expect.poll(() => seen[seen.length - 1]?.status).toBe('unknown');
    upstream.status = { 'ses-1': { type: 'busy' } };
    expect((await port.get('req-1')).status).toBe('running');
    upstream.status = {}; upstream.latest = [assistant()];
    await expect.poll(() => seen[seen.length - 1]?.status).toBe('completed');
    expect(upstream.calls.filter(c => c.method === 'POST' && c.path.includes('/message'))).toHaveLength(1);
  } finally { off(); }
});
