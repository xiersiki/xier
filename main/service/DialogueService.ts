import { ipcMain } from 'electron';
import { IPC_EVENTS } from '@common/constants';
import { createProvider } from '../providers';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import type { OpenAISetting } from '@common/types';

let registered = false;
export function registerDialogueHandlers() {
  if (registered) return;
  registered = true;
  ipcMain.handle(IPC_EVENTS.LIST_PROVIDER_MODELS, async (_event, setting: OpenAISetting) => {
    if (!setting?.apiKey || !setting?.baseURL) throw new Error('请先填写 API Key 和接口地址');
    return new OpenAIProvider(setting.apiKey, setting.baseURL, setting).listModels();
  });
  const requests = new Map<string, AbortController>();
  ipcMain.on(IPC_EVENTS.STOP_A_DIALOGUE, (event, messageId: string) => {
    requests.get(`${event.sender.id}:${messageId}`)?.abort();
  });
  ipcMain.on(IPC_EVENTS.START_A_DIALOGUE, async (event, props: CreateDialogueProps) => {
    const { messageId, providerName, messages, selectedModel } = props;
    const sender = event.sender;
    const key = `${sender.id}:${messageId}`;
    if (requests.has(key)) return;
    const controller = new AbortController();
    requests.set(key, controller);
    const abort = () => controller.abort();
    sender.once('destroyed', abort);
    const send = (data: DialogueBackStream['data']) => {
      if (!sender.isDestroyed() && !controller.signal.aborted)
        sender.send(IPC_EVENTS.DIALOGUE_BACK + messageId, { messageId, data });
    };
    try {
      const provider = createProvider(providerName);
      if (!provider) throw new Error('未找到模型服务商，请检查设置');
      const chunks = await provider.chat(messages, selectedModel, controller.signal);
      let ended = false;
      for await (const data of chunks) {
        if (controller.signal.aborted) break;
        send(data);
        if (data.isEnd) { ended = true; break; }
      }
      // Some compatible APIs end the stream without a finish_reason chunk.
      if (!ended) send({ result: '', isEnd: true, error: '模型连接提前结束，回答可能不完整' });
    } catch (error) {
      send({ isEnd: true, isError: true, result: '', error: error instanceof Error ? error.message : String(error) });
    } finally {
      requests.delete(key);
      sender.removeListener('destroyed', abort);
    }
  });
}
