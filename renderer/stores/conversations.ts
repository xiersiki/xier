import type { Conversation } from '@common/types';
import { defineStore } from 'pinia';
import { ref, computed, watch, onScopeDispose } from 'vue';
import { liveQuery } from 'dexie';
import { cloneDeep } from '@common/utils';
import { dataBase } from '../dataBase';
import { useAuthStore } from './auth';
import { requestSync } from '../services/sync';

type SortBy = 'updatedAt' | 'createAt' | 'name' | 'model';
type SortOrder = 'asc' | 'desc';
export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>([]);
  const sortBy = ref<SortBy>((localStorage.getItem('conversation:sortBy') as SortBy) || 'createAt');
  const sortOrder = ref<SortOrder>((localStorage.getItem('conversation:sortOrder') as SortOrder) || 'desc');
  const messagesInputValue = ref(new Map<string, string>());
  let subscription: { unsubscribe(): void } | undefined;
  const allConversations = computed(() => conversations.value);
  const sortMode = computed(() => ({ sortBy: sortBy.value, sortOrder: sortOrder.value }));
  const messageInputValueById = computed(() => (id: string) => messagesInputValue.value.get(id) ?? '');
  function setMessageInputValue(id: string, value: string) { messagesInputValue.value.set(id, value); }
  function setSortMode(by: SortBy, order: SortOrder) { sortBy.value = by; sortOrder.value = order; }
  async function initialize() {
    const db = dataBase;
    subscription?.unsubscribe();
    const rows = await db.conversations.toArray();
    if (db !== dataBase) return;
    conversations.value = rows;
    subscription = liveQuery(() => db.conversations.toArray()).subscribe(rows => {
      if (db === dataBase) conversations.value = rows;
    });
  }
  function getConversationById(id: string) { return conversations.value.find(c => c.id === id); }
  async function addConversation(conversation: Omit<Conversation, 'id'>) {
    const db = dataBase;
    const row = { ...cloneDeep(conversation), id: crypto.randomUUID(), pinned: conversation.pinned ?? false, dirty: true };
    await db.conversations.add(row);
    if (db === dataBase) conversations.value.push(row);
    requestSync(db, useAuthStore().userId);
    return row.id;
  }
  async function updateConversation(conversation: Conversation, updateTime = true) {
    const db = dataBase;
    await db.transaction('rw', db.conversations, async () => {
      const current = await db.conversations.get(conversation.id);
      if (!current) return;
      const row = { ...cloneDeep(conversation), dirty: true, version: current.version + 1,
        idempotentKey: crypto.randomUUID(), updatedAt: updateTime ? Date.now() : current.updatedAt };
      await db.conversations.put(row);
      if (db === dataBase) conversations.value = conversations.value.map(c => c.id === row.id ? row : c);
    });
    requestSync(db, useAuthStore().userId);
  }
  async function delConversation(id: string) {
    const db = dataBase;
    const { useMessagesStore } = await import('./messages');
    await useMessagesStore().stopConversation(id);
    await db.transaction('rw', db.conversations, db.messages, db.deletions, async () => {
      const messages = await db.messages.where('conversationId').equals(id).primaryKeys();
      await db.deletions.bulkDelete(messages);
      await db.messages.where('conversationId').equals(id).delete();
      await db.conversations.delete(id);
      await db.deletions.put({ id, table: 'conversations' });
    });
    conversations.value = conversations.value.filter(c => c.id !== id);
    messagesInputValue.value.delete(id);
    requestSync(db, useAuthStore().userId);
  }
  async function pinConversation(id: string) {
    const row = getConversationById(id); if (row) await updateConversation({ ...row, pinned: true }, false);
  }
  async function unpinConversation(id: string) {
    const row = getConversationById(id); if (row) await updateConversation({ ...row, pinned: false }, false);
  }
  function clear() { subscription?.unsubscribe(); conversations.value = []; messagesInputValue.value.clear(); }
  onScopeDispose(clear);
  watch([sortBy, sortOrder], () => {
    localStorage.setItem('conversation:sortBy', sortBy.value);
    localStorage.setItem('conversation:sortOrder', sortOrder.value);
  });
  return { conversations, sortBy, sortOrder, allConversations, messageInputValueById, sortMode,
    initialize, setMessageInputValue, getConversationById, addConversation, delConversation,
    updateConversation, pinConversation, unpinConversation, setSortMode, clear };
});
