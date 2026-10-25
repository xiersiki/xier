import { afterEach, expect, it, vi } from 'vitest';
import { FixtureAgentPort } from '../renderer/platform/content/fixture-agent';
import type { RewriteRequest, RunSnapshot } from '../common/content/contracts';
const request: RewriteRequest = { requestId: 'one', draftId: 'draft', scopeId: 'guest', selectedText: '原始内容', requirement: '精简' };
afterEach(() => vi.useRealTimers());
it('acknowledges once, emits a fixed result and retains a queryable terminal snapshot', async () => {
  vi.useFakeTimers();
  const port = new FixtureAgentPort(); const events: RunSnapshot[] = [];
  port.observe('one', event => events.push(event));
  expect((await port.start(request)).status).toBe('running');
  expect((await port.start(request)).sequence).toBe(1);
  await vi.runAllTimersAsync();
  expect(events.map(event => event.status)).toEqual(['running', 'completed']);
  expect((await port.get('one')).result?.replacement).toBe('让表达更清晰，让协作更顺畅。');
  expect((await port.cancel('one')).status).toBe('completed');
});
it('detachment does not cancel, cancellation prevents late completion, and request IDs are immutable', async () => {
  vi.useFakeTimers(); const port = new FixtureAgentPort(); const events: RunSnapshot[] = [];
  const detach = port.observe('one', event => events.push(event));
  await port.start(request); detach();
  expect((await port.get('one')).status).toBe('running');
  await expect(port.start({ ...request, selectedText: '不同输入' })).rejects.toThrow('requestId');
  await expect(port.start({ ...request, requestId: 'two' })).rejects.toThrow('正在运行');
  expect((await port.cancel('one')).status).toBe('cancelled');
  await vi.runAllTimersAsync();
  expect((await port.get('one')).status).toBe('cancelled');
  expect(events.map(event => event.status)).toEqual(['running']);
  expect((await port.get('missing')).status).toBe('unknown');
});
