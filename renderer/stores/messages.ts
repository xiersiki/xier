import type { Message } from '@common/types';
import { ref, computed, onScopeDispose } from 'vue';
import { defineStore } from 'pinia';
import { liveQuery } from 'dexie';
import { dataBase, type XierDatabase } from '../dataBase';
import { listenDialogueBack } from '../utils/dialogue';
import { useConversationsStore } from './conversations';
import { useProvidersStore } from './providers';
import { useAuthStore } from './auth';
import { requestSync } from '../services/sync';

export const stopMethods = new Map<string, () => void>();
interface StreamState {
  db: XierDatabase; userId: string | null; content: string; reasoning: string; queue: Promise<unknown>; stopped: boolean;
}
export const useMessagesStore = defineStore('messages', () => {
  const conversationsStore = useConversationsStore();
  const providersStore = useProvidersStore();
  const messages = ref<Message[]>([]);
  const streams = new Map<string, StreamState>();
  let subscription: { unsubscribe(): void } | undefined;
  const allMessages = computed(() => messages.value);
  const messagesByConversationId = computed(() => (id: string) => messages.value
    .filter(m => m.conversationId === id).sort((a, b) => a.createdAt - b.createdAt));
  const loadingMsgIdsByConversationId = computed(() => (id: string) => messagesByConversationId.value(id)
    .filter(m => m.status === 'loading' || m.status === 'streaming').map(m => m.id));

  async function initialize(_conversationId?: string, recoverInterrupted = false) {
    const db = dataBase;
    subscription?.unsubscribe();
    // Interrupted requests cannot be resumed after a restart.
    if (recoverInterrupted) {
      await db.messages.filter(m => (m.status === 'loading' || m.status === 'streaming') && !streams.has(m.id))
        .modify(m => { m.status = 'error'; m.dirty = true; m.error = '生成已中断，请重新发送'; });
    }
    if (db !== dataBase) return;
    messages.value = await db.messages.toArray();
    subscription = liveQuery(() => db.messages.toArray()).subscribe(rows => {
      if (db === dataBase) messages.value = rows;
    });
  }
  function setMessage(row: Message) {
    const index = messages.value.findIndex(m => m.id === row.id);
    if (index < 0) messages.value.push(row);
    else messages.value[index] = row;
  }
  async function addMessage(message: Omit<Message, 'id' | 'createdAt'>) {
    const db = dataBase;
    const row: Message = { ...message, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() };
    await db.messages.add(row);
    if (db === dataBase) setMessage(row);
    return row.id;
  }
  async function sendMessage(message: Omit<Message, 'id' | 'createdAt' | 'dirty'>) {
    const db = dataBase;
    const userId = useAuthStore().userId;
    const conversation = conversationsStore.getConversationById(message.conversationId);
    const provider = providersStore.allProviders.find(p => p.id === conversation?.providerId);
    if (!conversation || !provider) throw new Error('请先选择有效的模型服务商');
    if (!message.content.trim()) throw new Error('消息不能为空');
    if (loadingMsgIdsByConversationId.value(message.conversationId).length) throw new Error('请等待当前回答完成');
    await addMessage({ ...message, dirty: true, status: 'success' });
    const answerId = await addMessage({ conversationId: message.conversationId, type: 'answer', content: '', status: 'loading', dirty: true });
    await conversationsStore.updateConversation(conversation);
    const state: StreamState = { db, userId, content: '', reasoning: '', queue: Promise.resolve(), stopped: false };
    streams.set(answerId, state);
    const dispose = listenDialogueBack(({ data }) => {
      if (state.stopped) return;
      if (!data.isError) state.content += data.result;
      state.reasoning += data.reasoning ?? '';
      const error = data.error || (data.isError ? data.result || '请求失败' : undefined);
      const updates: Partial<Message> = { content: state.content, reasoningContent: state.reasoning,
        ...(data.finishReason ? { finishReason: data.finishReason } : {}), ...(error ? { error } : {}),
        status: error ? 'error' : data.isEnd ? 'success' : 'streaming', dirty: true, updatedAt: Date.now() };
      // Serialize writes: a slow intermediate chunk must not overwrite the terminal chunk.
      state.queue = state.queue.then(async () => {
        await db.messages.update(answerId, updates);
        const row = await db.messages.get(answerId);
        if (row && db === dataBase) setMessage(row);
        if (data.isEnd) requestSync(db, userId);
      }).catch(error => console.error('保存回答失败', error));
      if (data.isEnd) {
        stopMethods.delete(answerId);
        void state.queue.finally(() => streams.delete(answerId));
      }
    }, answerId);
    stopMethods.set(answerId, dispose);
    const history = messagesByConversationId.value(message.conversationId)
      .filter(m => m.id !== answerId && m.content.trim() && m.finishReason !== 'cancelled' && m.status !== 'error' && m.status !== 'loading' && m.status !== 'streaming')
      .map(m => ({ role: (m.type === 'question' ? 'user' : 'assistant') as DialogueMessageRole, content: m.content }));
    try {
      window.api.startADialogue({ messageId: answerId, providerName: provider.name,
        selectedModel: conversation.selectedModel, conversationId: conversation.id, messages: history });
    } catch (error) {
      await stopMessage(answerId, false);
      await db.messages.update(answerId, { status: 'error', error: error instanceof Error ? error.message : String(error), dirty: true });
    }
    requestSync(db, userId);
    return answerId;
  }
  async function stopMessage(id: string, update = true) {
    const state = streams.get(id);
    if (state) state.stopped = true;
    stopMethods.get(id)?.(); stopMethods.delete(id);
    window.api.stopADialogue(id);
    await state?.queue;
    if (update) {
      const db = state?.db ?? dataBase;
      const row = await db.messages.get(id);
      if (row) {
        const next: Message = { ...row, content: state?.content ?? row.content,
          reasoningContent: state?.reasoning ?? row.reasoningContent, finishReason: 'cancelled',
          status: 'success', dirty: true, updatedAt: Date.now() };
        await db.messages.put(next);
        if (db === dataBase) setMessage(next);
        requestSync(db, state?.userId ?? useAuthStore().userId);
      }
    }
    streams.delete(id);
  }
  async function stopConversation(id: string) {
    for (const message of messages.value.filter(m => m.conversationId === id)) {
      if (streams.has(message.id)) await stopMessage(message.id, false);
    }
    messages.value = messages.value.filter(m => m.conversationId !== id);
  }
  async function deleteMessage(id: string) {
    const db = dataBase;
    await stopMessage(id, false);
    await db.transaction('rw', db.messages, db.deletions, async () => {
      await db.messages.delete(id);
      await db.deletions.put({ id, table: 'messages' });
    });
    messages.value = messages.value.filter(m => m.id !== id);
    requestSync(db, useAuthStore().userId);
  }
  async function clear() {
    subscription?.unsubscribe();
    await Promise.all([...streams.keys()].map(id => stopMessage(id)));
    messages.value = [];
  }
  onScopeDispose(() => { void clear(); });
  return { messages, allMessages, messagesByConversationId, loadingMsgIdsByConversationId,
    initialize, addMessage, deleteMessage, sendMessage, stopMessage, stopConversation, clear };
});
