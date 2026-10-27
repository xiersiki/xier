import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Session } from '@supabase/supabase-js';
import * as repo from '../services/authRepo';
import { cloudEnabled } from '../services/client';
import { dataBase, selectAccountDatabase } from '../dataBase';
import { syncDatabase } from '../services/sync';
import { notify } from '../utils/notify';

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null);
  const user = computed(() => session.value?.user ?? null);
  const userId = computed(() => user.value?.id ?? null);
  const isAuthenticated = computed(() => !!userId.value);
  const loading = ref(false);
  const syncing = ref(false);
  const errorMessage = ref<string | null>(null);
  let initialized: Promise<void> | undefined;
  let unsubscribe: (() => void) | undefined;
  let transitions = Promise.resolve();
  let activeUser: string | null | undefined;
  let recoverMessages = true;
  function clearError() { errorMessage.value = null; }

  async function loadStores() {
    const [{ useProvidersStore }, { useConversationsStore }, { useMessagesStore }] = await Promise.all([
      import('./providers'), import('./conversations'), import('./messages'),
    ]);
    await useProvidersStore().initialize();
    await useConversationsStore().initialize();
    await useMessagesStore().initialize(undefined, recoverMessages);
  }
  async function syncUserData() {
    const db = dataBase;
    const id = userId.value;
    if (!id) return false;
    syncing.value = true;
    try {
      await syncDatabase(db, id);
      return true;
    } catch (error) {
      console.error('同步失败', error);
      notify.warning('云端暂时不可用', '当前账号的数据已保存在本机，联网后可重试');
      return false;
    } finally { syncing.value = false; }
  }
  function applySession(next: Session | null) {
    transitions = transitions.catch(() => {}).then(async () => {
      const nextId = next?.user.id ?? null;
      if (activeUser === nextId) { session.value = next; return; }
      await window.api.materials?.bindAuth(nextId).catch(() => { notify.warning('资料库暂时不可用', '可稍后在资料库重启服务'); });
      const [{ useProvidersStore }, { useConversationsStore }, { useMessagesStore }] = await Promise.all([
        import('./providers'), import('./conversations'), import('./messages'),
      ]);
      await useMessagesStore().clear();
      useProvidersStore().clear(); useConversationsStore().clear();
      selectAccountDatabase(nextId);
      session.value = next; activeUser = nextId;
      await loadStores();
      void syncUserData();
    });
    return transitions;
  }
  function initialize(options: { recoverMessages?: boolean } = {}) {
    if (initialized) return initialized;
    recoverMessages = options.recoverMessages ?? true;
    initialized = (async () => {
      loading.value = true;
      try {
        const current = await repo.getCurrentSession();
        await applySession(current.session);
      } catch (error) {
        await applySession(null);
        console.error('恢复登录失败', error);
        notify.warning('暂未连接到云端', '可以继续使用本地模式');
      } finally { loading.value = false; }
      unsubscribe = repo.onAuthStateChange((_event, next) => { void applySession(next); });
      window.addEventListener('online', syncUserData);
    })();
    return initialized;
  }
  async function authAction<T>(action: () => Promise<T>) {
    loading.value = true; clearError();
    try { return await action(); }
    catch (error) { errorMessage.value = error instanceof Error ? error.message : String(error); throw error; }
    finally { loading.value = false; }
  }
  const signInWithPassword = (email: string, password: string) => authAction(async () => {
    const result = await repo.signInWithPassword(email, password);
    await applySession(result.session); return result;
  });
  const signUpWithPassword = (email: string, password: string) => authAction(async () => {
    const result = await repo.signUpWithPassword(email, password);
    if (result.session) await applySession(result.session); return result;
  });
  const signOut = () => authAction(async () => { await repo.signOut(); await applySession(null); });
  const signInWithOtp = (email: string) => authAction(() => repo.signInWithOtp(email));
  const signInWithOAuth = (provider: 'google' | 'github') => authAction(async () => {
    const result = await repo.signInWithOAuth(provider);
    await applySession(result.session);
    return result;
  });
  function dispose() { unsubscribe?.(); window.removeEventListener('online', syncUserData); }
  return { user, session, userId, loading, syncing, errorMessage, isAuthenticated, cloudEnabled,
    initialize, signInWithPassword, signUpWithPassword, signOut, signInWithOtp, signInWithOAuth,
    syncUserData, clearError, dispose };
});
