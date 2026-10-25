import type { OpenAISetting } from './types';

export function normalizeModelURL(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('API 地址须为 HTTP(S) 根地址，不能包含账号、查询参数或片段');
  }
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  return url.toString().replace(/\/$/, '');
}

export function resolveModelAdapter(setting: OpenAISetting): 'openai-chat' | 'deepseek' {
  if (setting.adapter === 'deepseek' || setting.adapter === 'openai-chat') return setting.adapter;
  try { return new URL(setting.baseURL ?? '').hostname === 'api.deepseek.com' ? 'deepseek' : 'openai-chat'; }
  catch { return 'openai-chat'; }
}

// A model name alone does not identify the serving endpoint's parameter dialect.
export function modelRequestOptions(setting: OpenAISetting) {
  if (resolveModelAdapter(setting) !== 'deepseek') return {};
  return {
    ...(['enabled', 'disabled'].includes(setting.thinking ?? '') ? { thinking: { type: setting.thinking } } : {}),
    ...(setting.thinking !== 'disabled' && ['low', 'high', 'max'].includes(setting.reasoningEffort ?? '')
      ? { reasoning_effort: setting.reasoningEffort } : {}),
  };
}
