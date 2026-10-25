import OpenAI from 'openai';
import type { OpenAISetting } from '@common/types';
import { modelRequestOptions, normalizeModelURL, resolveModelAdapter } from '@common/modelAdapter';
import { BaseProvider } from './BaseProvider';
import logManager from '../service/LogService';

type CompatibleDelta = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string | null;
  reasoning?: string | null;
};

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;
  private setting: OpenAISetting;

  constructor(private apiKey: string, baseURL: string, options: OpenAISetting = {}) {
    super();
    this.setting = { ...options, baseURL: normalizeModelURL(baseURL) };
    this.client = new OpenAI({ apiKey, baseURL: this.setting.baseURL,
      timeout: resolveModelAdapter(this.setting) === 'deepseek' ? 600000 : 60000, maxRetries: 0 });
  }

  private readableError(error: unknown): Error {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    const hint: Record<number, string> = {
      400: '请求参数或上下文不被模型接受', 401: 'API Key 无效，请更新模型设置',
      402: '模型账户余额不足', 403: '当前账号没有访问权限', 404: '接口或模型不存在，请获取最新模型列表',
      429: '请求过于频繁或额度不足', 500: '模型服务暂时出错', 503: '模型服务繁忙，请稍后重试',
    };
    const detail = (error instanceof Error ? error.message : String(error))
      .split(this.apiKey).join('[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
    return new Error(status && hint[status] ? `${hint[status]}（HTTP ${status}）` : detail);
  }

  async listModels(): Promise<string[]> {
    try {
      // One bounded /models request; custom model IDs remain usable without discovery.
      const page = await this.client.models.list({ timeout: 20000 });
      if (!Array.isArray(page.data)) throw new Error('服务商返回的模型列表格式无效');
      return [...new Set(page.data.map(model => model.id).filter(id => typeof id === 'string' && id.trim()))].sort();
    } catch (error) { throw this.readableError(error); }
  }

  async chat(messages: DialogueMessageProps[], model: string, signal?: AbortSignal): Promise<AsyncIterable<UniversalChunk>> {
    logManager.logApiRequest('chat.completions.create', { model, messageCount: messages.length }, 'POST');
    try {
      const request = {
        model, messages: messages.map(({ role, content }) => ({ role, content })), stream: true as const,
        ...modelRequestOptions(this.setting),
      };
      const chunks = await this.client.chat.completions.create(
        // DeepSeek accepts max and thinking beyond the OpenAI SDK parameter vocabulary.
        request as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, { signal });
      const readableError = (error: unknown) => this.readableError(error);
      return {
        async *[Symbol.asyncIterator]() {
          let hasAnswer = false;
          let ended = false;
          try {
            for await (const chunk of chunks) {
              const choice = chunk.choices?.[0];
              if (!choice) continue;
              const delta = choice.delta as CompatibleDelta | undefined;
              const result = delta?.content ?? delta?.refusal ?? '';
              const reasoning = delta?.reasoning_content ?? delta?.reasoning ?? '';
              hasAnswer ||= !!result.trim();
              if (delta?.tool_calls?.length || delta?.function_call || ['tool_calls', 'function_call'].includes(choice.finish_reason ?? '')) {
                throw new Error('模型返回了工具调用；当前对话仅支持文本，请使用文本对话模型');
              }
              if (choice.finish_reason === 'content_filter') {
                yield { result, reasoning, isEnd: true, finishReason: 'content_filter', error: '服务商的内容过滤中断了本次回答' };
                ended = true; break;
              }
              if (choice.finish_reason != null) {
                const failure = !['stop', 'length'].includes(choice.finish_reason)
                  ? '模型服务中断了生成，请重试' : !hasAnswer && choice.finish_reason !== 'length' ? '模型未返回正文，请重试或检查模型设置' : undefined;
                yield { result, reasoning, isEnd: true, finishReason: choice.finish_reason,
                  ...(failure ? { error: failure } : {}) };
                ended = true; break;
              }
              if (result || reasoning) yield { result, reasoning, isEnd: false };
            }
            // A premature EOF is not a successful answer. Preserve partial output for review.
            if (!ended) yield { result: '', isEnd: true, finishReason: 'incomplete', error: '模型连接提前结束，回答可能不完整，请重试' };
          } catch (error) { throw readableError(error); }
        },
      };
    } catch (error) {
      logManager.error('Model request failed', { model, status: error instanceof OpenAI.APIError ? error.status : undefined });
      throw this.readableError(error);
    }
  }
}
