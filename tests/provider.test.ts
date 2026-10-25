// @vitest-environment node
import { createServer, type Server, type RequestListener } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../main/providers/OpenAIProvider';

vi.mock('../main/service/LogService', () => ({ default: { logApiRequest: vi.fn(), logApiResponse: vi.fn(), error: vi.fn() } }));
let server: Server | undefined;
afterEach(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
});
async function endpoint(handler: RequestListener) {
  server = createServer(handler);
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test endpoint');
  return `http://127.0.0.1:${address.port}/v1`;
}

it('uses the correct endpoint and completes a length-limited SSE response', async () => {
  let requestPath = '';
  const url = await endpoint((req, res) => {
    requestPath = req.url ?? '';
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"hello"},"finish_reason":null}]}\n\n');
    res.write('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n');
    res.end('data: [DONE]\n\n');
  });
  const provider = new OpenAIProvider('test-only', `${url}/chat/completions`);
  const chunks = [];
  for await (const chunk of await provider.chat([{ role: 'user', content: 'test' }], 'test-model')) chunks.push(chunk);
  expect(requestPath).toBe('/v1/chat/completions');
  expect(chunks).toMatchObject([{ result: 'hello', isEnd: false }, { result: '', isEnd: true, finishReason: 'length' }]);
});

it('aborts an in-flight HTTP request when generation is stopped', async () => {
  let onRequest!: () => void;
  const requested = new Promise<void>(resolve => { onRequest = resolve; });
  const url = await endpoint(() => onRequest());
  const controller = new AbortController();
  const request = new OpenAIProvider('test-only', url).chat([{ role: 'user', content: 'test' }], 'test-model', controller.signal);
  const rejected = expect(request).rejects.toThrow(/abort/i);
  await requested;
  controller.abort();
  await rejected;
});

it('keeps reasoning separate from text and sends DeepSeek options only for an opted-in endpoint', async () => {
  let body: Record<string, unknown> = {};
  const url = await endpoint(async (req, res) => {
    const bytes = []; for await (const chunk of req) bytes.push(chunk);
    body = JSON.parse(Buffer.concat(bytes).toString());
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': keep-alive\n\n');
    res.write('data: {"choices":[{"delta":{"reasoning_content":"reason","content":null},"finish_reason":null}]}\n\n');
    res.write('data: {"choices":[],"usage":{"total_tokens":12}}\n\n');
    res.write('data: {"choices":[{"delta":{"content":"answer"},"finish_reason":"stop"}]}\n\n');
    res.end('data: [DONE]\n\n');
  });
  const provider = new OpenAIProvider('test-only', url, { adapter: 'deepseek', thinking: 'enabled', reasoningEffort: 'max' });
  const chunks = []; for await (const chunk of await provider.chat([{ role: 'user', content: 'test' }], 'deepseek-flash')) chunks.push(chunk);
  expect(body).toMatchObject({ thinking: { type: 'enabled' }, reasoning_effort: 'max' });
  expect(chunks).toMatchObject([{ result: '', reasoning: 'reason', isEnd: false }, { result: 'answer', isEnd: true, finishReason: 'stop' }]);
  const generic = new OpenAIProvider('test-only', url, { thinking: 'enabled', reasoningEffort: 'max' });
  for await (const _ of await generic.chat([{ role: 'user', content: 'test' }], 'deepseek-flash')) { /* drain */ }
  expect(body).not.toHaveProperty('thinking'); expect(body).not.toHaveProperty('reasoning_effort');
});

it.each([
  ['{"delta":{"content":"partial"},"finish_reason":"insufficient_system_resource"}', '中断了生成'],
  ['{"delta":{"content":"partial"},"finish_reason":"aborted"}', '中断了生成'],
  ['{"delta":{},"finish_reason":"content_filter"}', '内容过滤'],
  ['{"delta":{},"finish_reason":"stop"}', '未返回正文'],
  ['{"delta":{"reasoning_content":"reason"},"finish_reason":null}', '提前结束'],
])('does not silently report an empty, filtered, or incomplete stream as success: %s', async (choice, hint) => {
  const url = await endpoint((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(`data: {"choices":[${choice}]}\n\ndata: [DONE]\n\n`);
  });
  const chunks = []; for await (const chunk of await new OpenAIProvider('test-only', url).chat([], 'test')) chunks.push(chunk);
  expect(chunks[chunks.length - 1]).toMatchObject({ isEnd: true, error: expect.stringContaining(hint) });
});

it('discovers models through the normalized endpoint without inventing or replacing IDs', async () => {
  let path = '';
  const url = await endpoint((req, res) => {
    path = req.url ?? ''; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'new-model' }, { id: 'new-model' }, { id: 'model:version' }] }));
  });
  expect(await new OpenAIProvider('test-only', `${url}/chat/completions/`).listModels()).toEqual(['model:version', 'new-model']);
  expect(path).toBe('/v1/models');
});

it('surfaces stream errors and does not expose the credential', async () => {
  const url = await endpoint((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: {"error":{"message":"bad test-secret-key","type":"api_error"}}\n\n');
  });
  const consume = async () => { for await (const _ of await new OpenAIProvider('test-secret-key', url).chat([], 'test')) { /* drain */ } };
  await expect(consume()).rejects.toThrow('bad [redacted]');
});
