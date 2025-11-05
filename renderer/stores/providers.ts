import type { Provider } from "@common/types";
import { defineStore } from "pinia";
import { deepMerge, parseOpenAISetting } from "@common/utils";
import { encode } from "js-base64";
import { dataBase } from "../dataBase";
import { useConfig } from "@renderer/hooks/useConfig";
import { notify } from "@renderer/utils/notify";
import { useAuthStore } from "./auth";

/**
 * Providers Store - 管理 providers 数据的响应式状态（组合式API）
 */
export const useProvidersStore = defineStore("providers", () => {
  // 状态定义（替代选项式API的state）
  const providers = ref<Provider[]>([]);

  // 计算属性（替代选项式API的getters）
  const allProviders = computed(() =>
    providers.value.map((item) => ({
      ...item,
      openAISetting: parseOpenAISetting(item.openAISetting ?? ""),
    }))
  );

  const config = useConfig();

  // 云端同步函数（防抖处理）
  const syncToCloud = async (id: string) => {
    const authStore = useAuthStore();
    const userId = authStore.userId;

    if (!userId) {
      console.log("[providers] 未登录，跳过云端同步");
      return;
    }

    try {
      const { upsertProviders } = await import("../services/providerRepo");
      const updatedProvider = await dataBase.providers.get(id);

      if (updatedProvider && updatedProvider.dirty) {
        const { dirty, ...rest } = updatedProvider;
        await upsertProviders(userId, [rest]);

        // 同步成功，清除 dirty 标记
        await dataBase.providers.update(id, { dirty: false });
        notify.success("Provider 配置已同步到云端");
      }
    } catch (err) {
      console.error("[providers] 同步到云端失败:", err);
      notify.error("同步失败，数据已保存到本地");
    }
  };

  // 方法定义
  /**
   * 初始化 providers 数据
   * ✅ 包含云端同步逻辑
   */
  async function initialize() {
    const authStore = (await import("./auth")).useAuthStore();
    const userId = authStore.userId;

    // 1️⃣ 先加载本地数据
    providers.value = await dataBase.providers.toArray();

    // 2️⃣ 如果已登录，从云端拉取并合并
    if (userId) {
      try {
        const { fetchProviders } = await import("../services/providerRepo");
        const remoteProviders = await fetchProviders(userId);

        if (remoteProviders.length > 0) {
          // 3️⃣ 智能合并策略
          const merged = remoteProviders.map((remote) => {
            const local = toRaw(
              providers.value.find((p) => p.id === remote.id)
            );

            // 如果本地有脏数据，保留本地版本（优先级更高）
            if (local?.dirty && local.version >= remote.version) {
              console.log(`[providers] 保留本地脏数据: ${local.id}`);
              return local;
            }

            // 否则使用云端数据
            return remote;
          });

          // 4️⃣ 添加本地独有的 providers（可能是离线创建的）
          const localOnly = providers.value.filter(
            (local) => !remoteProviders.some((remote) => remote.id === local.id)
          );

          const finalProviders = [...merged, ...localOnly];

          // 5️⃣ 更新内存和数据库
          providers.value = finalProviders;
          await dataBase.providers.clear();
          await dataBase.providers.bulkPut(finalProviders);

          // 6️⃣ 更新配置文件（多窗口共享）
          config.provider = encode(JSON.stringify(finalProviders));

          console.log(
            `✅ [providers] 已从云端获取 ${remoteProviders.length} 条，本地独有 ${localOnly.length} 条`
          );
        } else {
          console.log("[providers] 云端无数据");
        }
      } catch (err) {
        console.error("[providers] 从云端拉取失败，使用本地数据:", err);
      }
    }

    // 7️⃣ 同步本地脏数据到云端
    if (userId) {
      await syncDirtyProviders();
    }
  }

  /**
   * ✅ 同步所有脏数据到云端
   */
  async function syncDirtyProviders() {
    const authStore = (await import("./auth")).useAuthStore();
    const userId = authStore.userId;

    if (!userId) return;

    try {
      const dirtyProviders = await dataBase.providers
        .filter((p) => p.dirty === true)
        .toArray();

      if (dirtyProviders.length === 0) return;

      console.log(`[providers] 正在同步 ${dirtyProviders.length} 条脏数据...`);

      const { upsertProviders } = await import("../services/providerRepo");
      const syncedProviders = await upsertProviders(userId, dirtyProviders);

      if (syncedProviders && syncedProviders.length > 0) {
        // 清除 dirty 标记
        await Promise.all(
          syncedProviders.map((p) =>
            dataBase.providers.update(p.id, { dirty: false })
          )
        );

        // 更新内存
        providers.value = providers.value.map((item) => {
          const synced = syncedProviders.find((p) => p.id === item.id);
          return synced ? { ...synced, dirty: false } : item;
        });

        console.log(
          `✅ [providers] 已同步 ${syncedProviders.length} 条数据到云端`
        );
      }
    } catch (err) {
      console.error("[providers] 同步脏数据失败:", err);
    }
  }

  /**
   * 更新 providers
   * @param provider - 要更新的 provider 对象
   */
  async function updateProvider(
    id: string,
    provider: Partial<Provider>
  ): Promise<void> {
    const { v4: uuid } = await import("uuid");

    // 1. 立即更新本地 Dexie 数据库（UI 立即响应）
    await dataBase.providers.update(id, {
      ...provider,
      version: ((await dataBase.providers.get(id))?.version ?? 0) + 1,
      idempotentKey: uuid(),
      dirty: true,
      updatedAt: new Date().getTime(),
    });

    // 2. 立即更新内存中的 Pinia state（UI 立即响应）
    providers.value = providers.value.map((item) =>
      item.id === id ? { ...(deepMerge(item, provider) as Provider) } : item
    );

    // 3. 立即同步到配置文件（多窗口共享）
    config.provider = encode(JSON.stringify(providers.value));

    // 4. 防抖同步到云端（不阻塞 UI）
    syncToCloud(id);
  }

  /**
   * 添加新的 Provider
   */
  async function addProvider(provider: Omit<Provider, "id">): Promise<string> {
    const { v4: uuid } = await import("uuid");

    const newProvider: Provider = {
      ...provider,
      id: uuid(),
    };

    // 1. 添加到本地数据库
    await dataBase.providers.add(newProvider);

    // 2. 更新内存状态
    providers.value.push(newProvider);

    // 3. 更新配置文件（多窗口共享）
    config.provider = encode(JSON.stringify(providers.value));

    // 4. 如果已登录，同步到云端
    const authStore = (await import("./auth")).useAuthStore();
    if (authStore.userId) {
      syncToCloud(newProvider.id);
    }

    notify.success("Provider 已添加");
    return newProvider.id;
  }

  watch(
    () => config.provider,
    () => initialize()
  );

  // 暴露给外部的属性和方法
  return {
    // 状态
    providers,

    // 计算属性
    allProviders,

    // 方法
    initialize,
    updateProvider,
    addProvider,
    syncDirtyProviders,
  };
});
