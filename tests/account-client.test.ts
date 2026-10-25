import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ session: { user: { id: 'account-a' }, access_token: 'token-a' } }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((_url, _key, options) => options.accessToken
    ? { readToken: options.accessToken }
    : { auth: { getSession: async () => ({ data: { session: state.session }, error: null }) } }),
}));
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-public-key');
  state.session = { user: { id: 'account-a' }, access_token: 'token-a' };
});

it('keeps the original token when the active account changes during a request', async () => {
  const { getUserClient } = await import('../renderer/services/client');
  const client = await getUserClient('account-a') as unknown as { readToken: () => Promise<string> };
  state.session = { user: { id: 'account-b' }, access_token: 'token-b' };
  expect(await client.readToken()).toBe('token-a');
});

it('refuses to start a queued sync under a different account', async () => {
  const { getUserClient } = await import('../renderer/services/client');
  await expect(getUserClient('account-b')).rejects.toThrow('登录账号已改变');
});
