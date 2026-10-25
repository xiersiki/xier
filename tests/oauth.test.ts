import { expect, it } from 'vitest';
import { OAUTH_REDIRECT_URL, validateOAuthUrl } from '../common/oauth';

it('accepts only this project OAuth endpoint and the exact local callback', () => {
  const origin = 'https://project.supabase.co';
  const valid = `${origin}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(OAUTH_REDIRECT_URL)}`;
  expect(validateOAuthUrl(valid, origin)).toBe(valid);
  for (const invalid of [valid.replace(origin, 'https://evil.example'), valid.replace('authorize?', 'other?'),
    valid.replace(encodeURIComponent(OAUTH_REDIRECT_URL), 'https://evil.example'), 'file:///tmp/test']) {
    expect(() => validateOAuthUrl(invalid, origin)).toThrow();
  }
});
