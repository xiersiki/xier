// @vitest-environment node
// Explicit opt-in only: uses the existing native Xier config, never a key in source or logs.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../main/providers/OpenAIProvider';
import { parseOpenAISetting } from '../common/utils';
import type { Provider } from '../common/types';
vi.mock('../main/service/LogService', () => ({ default: { logApiRequest: vi.fn(), logApiResponse: vi.fn(), error: vi.fn() } }));

const configPath = process.env.XIER_LIVE_PROVIDER_CONFIG;
it.skipIf(!configPath)('queries live DeepSeek models and verifies non-thinking, thinking and multi-turn replies', async () => {
  const config = JSON.parse(readFileSync(configPath!, 'utf8'));
  const providers = JSON.parse(Buffer.from(config.provider, 'base64').toString('utf8')) as Provider[];
  const saved = providers.find(p => p.name === 'deepseek');
  if (!saved) throw new Error('DeepSeek is not configured');
  const setting = parseOpenAISetting(saved.openAISetting ?? '');
  if (!setting.apiKey || !setting.baseURL || new URL(setting.baseURL).hostname !== 'api.deepseek.com') throw new Error('Expected the configured official DeepSeek endpoint');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const normal = new OpenAIProvider(setting.apiKey, setting.baseURL, { adapter: 'deepseek', thinking: 'disabled' });
    const models = await normal.listModels();
    expect(models).toContain('deepseek-flash');
    const collect = async (provider: OpenAIProvider, history: DialogueMessageProps[]) => {
      let answer = '', reasoning = ''; let terminal: UniversalChunk | undefined;
      for await (const chunk of await provider.chat(history, 'deepseek-flash', controller.signal)) {
        answer += chunk.result; reasoning += chunk.reasoning ?? '';
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.isEnd) terminal = chunk;
      }
      expect(terminal?.finishReason).toBe('stop');
      return { answer, reasoning };
    };
    const first = await collect(normal, [{ role: 'user', content: '记住暗号 XIER-42，仅回复：已记住。' }]);
    expect(first.answer).toBeTruthy(); expect(first.reasoning).toBe('');
    const thinking = new OpenAIProvider(setting.apiKey, setting.baseURL, { adapter: 'deepseek', thinking: 'enabled', reasoningEffort: 'low' });
    const second = await collect(thinking, [{ role: 'user', content: '17乘以19是多少？只输出计算结果。' }]);
    expect(second.answer).toContain('323'); expect(second.reasoning.length).toBeGreaterThan(0);
    const third = await collect(thinking, [
      { role: 'user', content: '记住暗号 XIER-42，仅回复：已记住。' }, { role: 'assistant', content: first.answer },
      { role: 'user', content: '刚才的暗号是什么？只回复暗号。' },
    ]);
    expect(third.answer).toContain('XIER-42');
    console.info('LIVE_DEEPSEEK_OK', { models, ordinaryReply: true, reasoningCharacters: second.reasoning.length, multiTurn: true });
  } finally { clearTimeout(timer); }
}, 100000);
