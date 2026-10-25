import { parseOpenAISetting } from '@common/utils';
import { notify } from '../utils/notify';
import type { Table } from 'dexie';
import type { XierDatabase } from '../dataBase';
import { initProviders } from '../dataBase';
import { fetchProviders, upsertProviders } from './providerRepo';
import { fetchConversations, upsertConversations, deleteConversation } from './conversationRepo';
import { fetchMessages, upsertMessages, deleteRemoteMessage } from './messageRepo';

const running = new Map<string, Promise<void>>();

// A response must never clear edits made while its request was in flight.
async function acknowledge<T extends { id: string; dirty?: boolean }>(table: Table<T, string>, sent: T[]) {
  await table.db.transaction('rw', table, async () => {
    for (const snapshot of sent) {
      const current = await table.get(snapshot.id);
      if (JSON.stringify(current) === JSON.stringify(snapshot))
        await table.put({ ...current!, dirty: false });
    }
  });
}

async function merge<T extends { id: string; dirty?: boolean }>(db: XierDatabase, table: Table<T, string>, remote: T[]) {
  await db.transaction('rw', table, db.deletions, async () => {
    const deleted = new Set((await db.deletions.toArray()).map(d => d.id));
    for (const row of remote) {
      if (deleted.has(row.id)) continue;
      const local = await table.get(row.id);
      if (!local?.dirty) await table.put({ ...row, dirty: false });
    }
    const remoteIds = new Set(remote.map(row => row.id));
    for (const local of await table.toArray()) {
      if (!local.dirty && !remoteIds.has(local.id)) await table.delete(local.id);
    }
  });
}

async function synchronize(db: XierDatabase, userId: string) {
  // Match providers by name before upload: old releases used fixed default IDs.
  const remoteProviders = await fetchProviders(userId);
  await db.transaction('rw', db.providers, db.conversations, async () => {
    for (const remote of remoteProviders) {
      const sameName = await db.providers.where('name').equals(remote.name).first();
      if (sameName && sameName.id !== remote.id) {
        await db.conversations.where('providerId').equals(sameName.id).modify(c => {
          c.providerId = remote.id; c.dirty = true;
        });
        await db.providers.delete(sameName.id);
        // Empty default presets must not replace restored credentials.
        const hasLocalConfiguration = !!parseOpenAISetting(sameName.openAISetting ?? '').apiKey;
        await db.providers.put(sameName.dirty && hasLocalConfiguration
          ? { ...sameName, id: remote.id, version: Math.max(sameName.version, remote.version) + 1, idempotentKey: crypto.randomUUID() }
          : remote);
      } else {
        const local = await db.providers.get(remote.id);
        if (!local?.dirty) await db.providers.put(remote);
      }
    }
  });
  await initProviders(db);
  const pending = await db.deletions.toArray();
  for (const deletion of pending) {
    if (deletion.table === 'messages') await deleteRemoteMessage(deletion.id, userId);
    else await deleteConversation(deletion.id, userId);
    await db.deletions.delete(deletion.id);
  }
  const providers = await db.providers.filter(p => !!p.dirty).toArray();
  if (providers.length) {
    const saved = await upsertProviders(userId, providers);
    if (saved.length !== providers.length) throw new Error('模型配置未完整同步');
    await acknowledge(db.providers, providers);
  }
  const conversations = await db.conversations.filter(c => c.dirty).toArray();
  if (conversations.length) {
    const result = await upsertConversations(userId, conversations);
    if (!result.success || result.data.length !== conversations.length) throw new Error('会话未完整同步');
    await acknowledge(db.conversations, conversations);
  }
  const messages = await db.messages.filter(m => m.dirty && m.status !== 'loading' && m.status !== 'streaming').toArray();
  if (messages.length) {
    const result = await upsertMessages(userId, messages);
    if (!result.success || result.data.length !== messages.length) throw new Error('消息未完整同步');
    await acknowledge(db.messages, messages);
  }
  await merge(db, db.conversations, await fetchConversations(userId));
  await merge(db, db.messages, await fetchMessages(userId));
  // A conversation deleted on another device must not leave orphan messages.
  await db.transaction('rw', db.conversations, db.messages, async () => {
    const ids = new Set(await db.conversations.toCollection().primaryKeys());
    await db.messages.filter(m => !ids.has(m.conversationId)).delete();
  });
}

export function syncDatabase(db: XierDatabase, userId: string): Promise<void> {
  // Serialize callers and run another pass for edits queued during the previous pass.
  const previous = running.get(db.name) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => synchronize(db, userId));
  running.set(db.name, next);
  void next.finally(() => { if (running.get(db.name) === next) running.delete(db.name); }).catch(() => {});
  return next;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
export function requestSync(db: XierDatabase, userId: string | null) {
  if (!userId) return;
  clearTimeout(timers.get(db.name));
  timers.set(db.name, setTimeout(() => {
    timers.delete(db.name);
    void syncDatabase(db, userId).catch(() => notify.warning('云端同步失败', '数据已保存在本机，联网后会重试'));
  }, 500));
}
