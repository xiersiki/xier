import { expect, it, vi } from 'vitest';

it('can load the application without Supabase configuration', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  const client = await import('../renderer/services/client');
  expect(client.default).toBeNull();
});
