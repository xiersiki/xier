import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
const timedFetch: typeof fetch = (input, init) => fetch(input, {
  ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
});
let supabase: SupabaseClient | null = null;
if (url && key) {
  try {
    supabase = createClient(url, key, {
      auth: { flowType: 'pkce', detectSessionInUrl: false },
      global: { fetch: timedFetch },
    });
  } catch {
    console.warn('Supabase 配置无效，将使用本地模式');
  }
}
export const cloudEnabled = Boolean(supabase);
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('云端服务未配置，请配置 Supabase 后重启；本地对话仍可使用。');
  return supabase;
}
export async function getUserClient(userId: string): Promise<SupabaseClient> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  if (!data.session || data.session.user.id !== userId) throw new Error('登录账号已改变，已暂停旧账号同步');
  const accessToken = data.session.access_token;
  // A queued request must never inherit a different account's newly issued token.
  return createClient(url!, key!, { accessToken: async () => accessToken, global: { fetch: timedFetch } });
}
export default supabase;
