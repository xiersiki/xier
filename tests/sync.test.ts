import { beforeEach, expect, it, vi } from 'vitest';
import { dataBase, initProviders, selectAccountDatabase } from '../renderer/dataBase';
import { syncDatabase } from '../renderer/services/sync';
import * as providersRepo from '../renderer/services/providerRepo';
import * as conversationsRepo from '../renderer/services/conversationRepo';
import * as messagesRepo from '../renderer/services/messageRepo';
import type { Conversation } from '../common/types';

vi.mock('../renderer/services/providerRepo', () => ({ fetchProviders: vi.fn(), upsertProviders: vi.fn() }));
vi.mock('../renderer/services/conversationRepo', () => ({ fetchConversations: vi.fn(), upsertConversations: vi.fn(), deleteConversation: vi.fn() }));
vi.mock('../renderer/services/messageRepo', () => ({ fetchMessages: vi.fn(), upsertMessages: vi.fn(), deleteRemoteMessage: vi.fn() }));
const row = (id = 'conversation'): Conversation => ({ id, title: 'offline edit', providerId: 'provider', selectedModel: 'model',
  pinned: false, createdAt: 1, updatedAt: 2, version: 2, idempotentKey: 'key', dirty: true });

beforeEach(async () => {
  vi.resetAllMocks();
  selectAccountDatabase(crypto.randomUUID());
  await initProviders();
  await dataBase.providers.toCollection().modify({ dirty: false });
  vi.mocked(providersRepo.fetchProviders).mockResolvedValue(await dataBase.providers.toArray());
  vi.mocked(conversationsRepo.fetchConversations).mockResolvedValue([]);
  vi.mocked(messagesRepo.fetchMessages).mockResolvedValue([]);
  vi.mocked(conversationsRepo.upsertConversations).mockImplementation(async (_user, rows) => ({ success: true, data: rows as Conversation[] }));
});

it('keeps edits made while an upload is in flight for the next sync', async () => {
  await dataBase.conversations.put(row());
  vi.mocked(conversationsRepo.upsertConversations).mockImplementation(async () => {
    await dataBase.conversations.update('conversation', { title: 'newer local edit', version: 3 });
    return { success: true, data: [row()] };
  });
  vi.mocked(conversationsRepo.fetchConversations).mockResolvedValue([{ ...row(), dirty: false }]);
  await syncDatabase(dataBase, 'user');
  expect(await dataBase.conversations.get('conversation')).toMatchObject({ title: 'newer local edit', dirty: true, version: 3 });
});

it('does not resurrect a conversation deleted during a cloud pull', async () => {
  await dataBase.conversations.put({ ...row(), dirty: false });
  vi.mocked(conversationsRepo.fetchConversations).mockImplementation(async () => {
    await dataBase.conversations.delete('conversation');
    await dataBase.deletions.put({ id: 'conversation', table: 'conversations' });
    return [{ ...row(), dirty: false }];
  });
  await syncDatabase(dataBase, 'user');
  expect(await dataBase.conversations.get('conversation')).toBeUndefined();
  expect(await dataBase.deletions.get('conversation')).toBeDefined();
});

it('replays offline deletion before downloading cloud data', async () => {
  await dataBase.deletions.put({ id: 'conversation', table: 'conversations' });
  await syncDatabase(dataBase, 'user');
  expect(conversationsRepo.deleteConversation).toHaveBeenCalledWith('conversation', 'user');
  expect(await dataBase.deletions.count()).toBe(0);
});

it('retains deletion intent when the network fails', async () => {
  await dataBase.deletions.put({ id: 'conversation', table: 'conversations' });
  vi.mocked(conversationsRepo.deleteConversation).mockRejectedValue(new Error('offline'));
  await expect(syncDatabase(dataBase, 'user')).rejects.toThrow('offline');
  expect(await dataBase.deletions.get('conversation')).toBeDefined();
});

it('isolates different accounts and restores their own local cache', async () => {
  const first = dataBase;
  await first.conversations.put(row());
  selectAccountDatabase('another-user');
  expect(await dataBase.conversations.get('conversation')).toBeUndefined();
  expect(await first.conversations.get('conversation')).toBeDefined();
});
