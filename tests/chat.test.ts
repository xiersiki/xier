import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia, disposePinia } from 'pinia';
import { reactive } from 'vue';
import { dataBase, initProviders, selectAccountDatabase } from '../renderer/dataBase';
import { stringifyOpenAISetting } from '../common/utils';
import { useConversationsStore } from '../renderer/stores/conversations';
import { useMessagesStore, stopMethods } from '../renderer/stores/messages';
import { useProvidersStore } from '../renderer/stores/providers';
import { useConfig } from '../renderer/hooks/useConfig';

const authState = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('../renderer/stores/auth', () => ({ useAuthStore: () => authState }));
vi.mock('../renderer/services/sync', () => ({ requestSync: vi.fn() }));
vi.mock('../renderer/services/messageRepo', () => ({ deleteRemoteMessage: vi.fn() }));
vi.mock('../renderer/hooks/useConfig', () => {
  const config = reactive({ provider: '', defaultModel: null });
  return { useConfig: () => config, configReady: Promise.resolve() };
});

let pinia: ReturnType<typeof createPinia>;
beforeEach(async () => {
  authState.userId = null;
  selectAccountDatabase(null);
  pinia = createPinia(); setActivePinia(pinia);
  await Promise.all([dataBase.providers.clear(), dataBase.conversations.clear(), dataBase.messages.clear()]);
  vi.clearAllMocks();
});
afterEach(() => { disposePinia(pinia); selectAccountDatabase(null); });

async function conversation() {
  await initProviders();
  const providers = useProvidersStore(); await providers.initialize();
  const store = useConversationsStore();
  const id = await store.addConversation({ title: '测试', providerId: providers.providers[0].id,
    selectedModel: 'test-model', createdAt: Date.now(), updatedAt: Date.now(), pinned: false,
    dirty: false, version: 1, idempotentKey: crypto.randomUUID() });
  return { store, id };
}

it('publishes local providers to the main process on first startup', async () => {
  await initProviders(); await useProvidersStore().initialize();
  expect(useConfig().provider).toBeTruthy();
});

it('marks pin/rename changes for cloud synchronization', async () => {
  const { store, id } = await conversation();
  await dataBase.conversations.update(id, { dirty: false });
  await store.pinConversation(id);
  expect(await dataBase.conversations.get(id)).toMatchObject({ pinned: true, dirty: true, version: 2 });
});

it('persists complete streamed answers while offline and removes listeners', async () => {
  const { id } = await conversation();
  let callback!: (data: DialogueBackStream) => void;
  const unsubscribe = vi.fn();
  vi.mocked(window.api.onDialogueBack).mockImplementation(cb => { callback = cb; return unsubscribe; });
  const store = useMessagesStore();
  const answerId = await store.sendMessage({ content: '你好', type: 'question', conversationId: id });
  callback({ messageId: answerId, data: { result: 'Hello', isEnd: false } });
  callback({ messageId: answerId, data: { result: ' world', isEnd: false } });
  callback({ messageId: answerId, data: { result: '', isEnd: true } });
  await vi.waitFor(async () => {
    expect(await dataBase.messages.get(answerId)).toMatchObject({ content: 'Hello world', status: 'success', dirty: true });
  });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(stopMethods.has(answerId)).toBe(false);
});

it('stopping generation aborts the main-process request and keeps the partial answer', async () => {
  const { id } = await conversation();
  const store = useMessagesStore();
  const answerId = await store.sendMessage({ content: '你好', type: 'question', conversationId: id });
  await store.stopMessage(answerId);
  expect(window.api.stopADialogue).toHaveBeenCalledWith(answerId);
  expect(await dataBase.messages.get(answerId)).toMatchObject({ status: 'success', dirty: true });
});

it('opening another view does not mark an active response as interrupted', async () => {
  const { id } = await conversation();
  await dataBase.messages.put({ id: 'active-in-main', conversationId: id, type: 'answer', content: 'partial', createdAt: 1, status: 'streaming', dirty: true });
  await useMessagesStore().initialize();
  expect(await dataBase.messages.get('active-in-main')).toMatchObject({ status: 'streaming' });
  await useMessagesStore().initialize(undefined, true);
  expect(await dataBase.messages.get('active-in-main')).toMatchObject({ status: 'error', dirty: true });
});

it('imports guest model configuration only on explicit request and preserves the account provider ID', async () => {
  await initProviders();
  const guest = await dataBase.providers.where('name').equals('deepseek').first();
  const settings = stringifyOpenAISetting({ apiKey: 'test-key', baseURL: 'https://example.com/v1' });
  await dataBase.providers.update(guest!.id, { openAISetting: settings, visible: true });
  selectAccountDatabase(crypto.randomUUID());
  authState.userId = 'target-account';
  const store = useProvidersStore(); await store.initialize();
  const accountProvider = await dataBase.providers.where('name').equals('deepseek').first();
  expect(accountProvider!.openAISetting).not.toBe(settings);
  expect(await store.importGuestProviders()).toBe(1);
  expect(await dataBase.providers.get(accountProvider!.id)).toMatchObject({ openAISetting: settings, visible: true, dirty: true });
});

it('persists reasoning and partial output separately from a stream error', async () => {
  const { id } = await conversation();
  let callback!: (data: DialogueBackStream) => void;
  vi.mocked(window.api.onDialogueBack).mockImplementation(cb => { callback = cb; return vi.fn(); });
  const store = useMessagesStore();
  const answerId = await store.sendMessage({ content: 'test reasoning', type: 'question', conversationId: id });
  callback({ messageId: answerId, data: { result: '', reasoning: 'think ', isEnd: false } });
  callback({ messageId: answerId, data: { result: 'partial answer', reasoning: 'more', isEnd: false } });
  callback({ messageId: answerId, data: { result: '', error: 'connection interrupted', isEnd: true } });
  await vi.waitFor(async () => expect(await dataBase.messages.get(answerId)).toMatchObject({
    content: 'partial answer', reasoningContent: 'think more', error: 'connection interrupted', status: 'error', dirty: true,
  }));
});

it('does not replay reasoning or stopped output as normal assistant context', async () => {
  const { id } = await conversation();
  const store = useMessagesStore();
  await store.addMessage({ conversationId: id, type: 'answer', content: 'final', reasoningContent: 'private reasoning', status: 'success', dirty: false });
  await store.addMessage({ conversationId: id, type: 'answer', content: 'partial', finishReason: 'cancelled', status: 'success', dirty: false });
  const answerId = await store.sendMessage({ content: 'next', type: 'question', conversationId: id });
  const request = vi.mocked(window.api.startADialogue).mock.calls[0][0];
  expect(request.messages).toEqual([{ role: 'assistant', content: 'final' }, { role: 'user', content: 'next' }]);
  await store.stopMessage(answerId);
  expect(await dataBase.messages.get(answerId)).toMatchObject({ content: '', finishReason: 'cancelled' });
});
