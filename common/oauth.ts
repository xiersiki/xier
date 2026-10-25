export const OAUTH_REDIRECT_URL = 'http://127.0.0.1:54323/auth/callback';

export function validateOAuthUrl(value: string, supabaseUrl: string) {
  const url = new URL(value);
  const expected = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || url.origin !== expected.origin ||
      url.pathname !== '/auth/v1/authorize' || url.username || url.password ||
      url.searchParams.get('redirect_to') !== OAUTH_REDIRECT_URL ||
      !['github', 'google'].includes(url.searchParams.get('provider') ?? '')) {
    throw new Error('无效的授权地址');
  }
  return url.href;
}
