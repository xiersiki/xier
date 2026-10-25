import { expect, it } from 'vitest';
import { modelRequestOptions, normalizeModelURL, resolveModelAdapter } from '../common/modelAdapter';

it('detects the actual endpoint rather than a provider/model nickname', () => {
  expect(resolveModelAdapter({ baseURL: 'https://api.deepseek.com/v1' })).toBe('deepseek');
  expect(resolveModelAdapter({ baseURL: 'https://api.deepseek.com.fake.example/v1' })).toBe('openai-chat');
  expect(resolveModelAdapter({ baseURL: 'https://api.deepseek.com', adapter: 'openai-chat' })).toBe('openai-chat');
  expect(modelRequestOptions({ adapter: 'deepseek', thinking: 'disabled', reasoningEffort: 'max' })).toEqual({ thinking: { type: 'disabled' } });
  expect(modelRequestOptions({ adapter: 'deepseek' })).toEqual({});
});

it('preserves provider-specific base paths and rejects ambiguous URL credentials', () => {
  expect(normalizeModelURL(' https://example.com/api/v3/chat/completions/ ')).toBe('https://example.com/api/v3');
  expect(() => normalizeModelURL('https://user:key@example.com')).toThrow();
  expect(() => normalizeModelURL('https://example.com?api_key=secret')).toThrow();
});
