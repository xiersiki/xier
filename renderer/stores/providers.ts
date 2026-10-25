import type { Provider } from '@common/types';
import { defineStore } from 'pinia';
import { ref, computed, onScopeDispose } from 'vue';
import { liveQuery } from 'dexie';
import { encode } from 'js-base64';
import { cloneDeep, parseOpenAISetting } from '@common/utils';
import { dataBase, getGuestDatabase, initProviders } from '../dataBase';
import { useConfig, configReady } from '../hooks/useConfig';
import { useAuthStore } from './auth';
import { requestSync } from '../services/sync';

export const useProvidersStore = defineStore('providers', () => {
  const providers = ref<Provider[]>([]);
  const config = useConfig();
  let subscription: { unsubscribe(): void } | undefined;
  const allProviders = computed(() => providers.value.map(item => ({
    ...item, openAISetting: parseOpenAISetting(item.openAISetting ?? ''),
  })));
  function publish(rows: Provider[]) {
    providers.value = rows;
    const encoded = encode(JSON.stringify(rows));
    if (config.provider !== encoded) {
      config.provider = encoded;
      window.api.setConfig('provider', encoded);
    }
  }
  async function initialize() {
    await configReady;
    const db = dataBase;
    subscription?.unsubscribe();
    await initProviders(db);
    if (db !== dataBase) return;
    publish(await db.providers.toArray());
    subscription = liveQuery(() => db.providers.toArray()).subscribe(rows => {
      if (db === dataBase) publish(rows);
    });
  }
  async function updateProvider(id: string, changes: Partial<Provider>) {
    const db = dataBase;
    await db.transaction('rw', db.providers, async () => {
      const previous = await db.providers.get(id);
      if (!previous) throw new Error('模型服务商不存在');
      await db.providers.put({ ...previous, ...cloneDeep(changes), id,
        version: previous.version + 1, updatedAt: Date.now(), idempotentKey: crypto.randomUUID(), dirty: true });
    });
    if (db === dataBase) publish(await db.providers.toArray());
    requestSync(db, useAuthStore().userId);
  }
  async function addProvider(provider: Omit<Provider, 'id'>) {
    const db = dataBase;
    const name = provider.name.trim();
    if (!name || await db.providers.where('name').equals(name).count()) throw new Error('服务商名称不能为空或重复');
    const row: Provider = { ...cloneDeep(provider), name, id: crypto.randomUUID(), dirty: true };
    await db.providers.add(row);
    if (db === dataBase) publish(await db.providers.toArray());
    requestSync(db, useAuthStore().userId);
    return row.id;
  }
  async function importGuestProviders() {
    const db = dataBase;
    const userId = useAuthStore().userId;
    if (!userId || db === getGuestDatabase()) throw new Error('请先登录目标账号');
    const configured = (await getGuestDatabase().providers.toArray()).filter(provider => {
      const settings = parseOpenAISetting(provider.openAISetting ?? '');
      return settings.apiKey && settings.baseURL;
    });
    await db.transaction('rw', db.providers, async () => {
      for (const guest of configured) {
        const existing = await db.providers.where('name').equals(guest.name).first();
        await db.providers.put({ ...guest, id: existing?.id ?? crypto.randomUUID(),
          createdAt: existing?.createdAt ?? guest.createdAt, updatedAt: Date.now(),
          version: (existing?.version ?? 0) + 1, idempotentKey: crypto.randomUUID(), dirty: true });
      }
    });
    if (db === dataBase) publish(await db.providers.toArray());
    requestSync(db, userId);
    return configured.length;
  }
  function clear() { subscription?.unsubscribe(); providers.value = []; }
  onScopeDispose(clear);
  return { providers, allProviders, initialize, updateProvider, addProvider, importGuestProviders, clear };
});
