<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import type { OpenAISetting, Provider } from '@common/types';
import ProviderModelControls from '@renderer/components/ProviderModelControls.vue';
import { NCollapse, NCollapseItem, NSwitch, NInput, NInputGroup, NInputGroupLabel, NDynamicTags, NSelect, NButton, NModal, NForm, NFormItem, NSpace } from 'naive-ui';
import { stringifyOpenAISetting } from '@common/utils';
import { useProvidersStore } from '@renderer/stores/providers';
import { useConfig } from '@renderer/hooks/useConfig';
import { v4 as uuid } from 'uuid';
import { useAuthStore } from '@renderer/stores/auth';
import { notify } from '@renderer/utils/notify';

const providersStore = useProvidersStore();
const authStore = useAuthStore();
const importing = ref(false);
const config = useConfig();
const { t } = useI18n();

// 添加 Provider 对话框
const showAddProviderModal = ref(false);
const newProviderForm = ref({
  name: '',
  title: '',
  apiKey: '',
  baseURL: '',
  models: [] as string[],
});

const defaultModel = computed({
  get() {
    const vals: string[] = [];
    providersStore.allProviders.forEach(provider => {
      if (!provider.visible) return;
      provider.models.forEach(model => {
        vals.push(`${provider.id}:${model}`)
      })
    })
    if (!vals.includes(config.defaultModel ?? '')) return null
    return config.defaultModel || null;
  },
  set(v) { config.defaultModel = v }
});
const providerOptions = computed(() => providersStore.allProviders.map(item => ({
  label: item.title || item.name,
  type: 'group',
  key: item.id,
  children: item.models.map(model => ({
    label: model,
    value: `${item.id}:${model}`,
    disabled: !item.visible,
  }))
})));

function handleApiKeyUpdate(id: string, apiKey: string) {
  updateSetting(id, { apiKey });
}

function handleBaseURLUpdate(id: string, baseURL: string) {
  updateSetting(id, { baseURL });
}

function updateSetting(id: string, changes: Partial<OpenAISetting>) {
  const current = providersStore.allProviders.find(item => item.id === id)?.openAISetting ?? {};
  const setting = { ...current, ...changes };
  const update: Partial<Provider> = { openAISetting: stringifyOpenAISetting(setting) };
  if (!setting.baseURL || !setting.apiKey) update.visible = false;
  void providersStore.updateProvider(id, update);
}

function openAddProviderModal() {
  showAddProviderModal.value = true;
  // 重置表单
  newProviderForm.value = { name: '', title: '', apiKey: '', baseURL: '', models: [] };
}

async function handleAddProvider() {
  if (!newProviderForm.value.name || !newProviderForm.value.baseURL) {
    return;
  }

  const newProvider: Omit<Provider, 'id'> = {
    name: newProviderForm.value.name,
    title: newProviderForm.value.title || newProviderForm.value.name,
    openAISetting: stringifyOpenAISetting({
      apiKey: newProviderForm.value.apiKey,
      baseURL: newProviderForm.value.baseURL,
    }),
    models: [...newProviderForm.value.models], // ✅ 转换为普通数组
    visible: !!(newProviderForm.value.apiKey && newProviderForm.value.baseURL),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    idempotentKey: uuid(),
    dirty: true,
  };

  await providersStore.addProvider(newProvider);
  showAddProviderModal.value = false;
}

async function importLocalConfiguration() {
  importing.value = true;
  try {
    const count = await providersStore.importGuestProviders();
    if (!count) notify.info('未找到可导入的本机模型配置');
    else if (await authStore.syncUserData()) notify.success(`已导入并同步 ${count} 个模型服务商`);
  } catch (error) { notify.error(error instanceof Error ? error.message : '导入失败'); }
  finally { importing.value = false; }
}

</script>

<template>

  <div class="default-model-row">
    <div class="default-model-label">
      {{ t('settings.providers.defaultModel') }}
    </div>
    <n-select v-model:value="defaultModel" :options="providerOptions" clearable />
  </div>


  <!-- 添加 Provider 按钮 -->
  <div class="provider-actions">
    <n-button type="primary" @click="openAddProviderModal">
      <Plus :size="15" class="mr-2" />{{ t('settings.providers.addProvider') || '添加 Provider' }}
    </n-button>
    <n-button v-if="authStore.isAuthenticated" :loading="importing" :disabled="importing" @click="importLocalConfiguration">
      导入未登录时的模型配置
    </n-button>
  </div>

  <n-collapse class="provider-list">
    <n-collapse-item v-for="(provider, index) in providersStore.allProviders" :key="provider.name"
      :name="provider.id" :class="{ 'provider-enabled': provider.visible }">
      <template #header><div class="provider-heading"><span class="provider-avatar">{{ (provider.title || provider.name).slice(0, 1).toUpperCase() }}</span><span><strong>{{ provider.title || provider.name }}</strong><small>{{ t('ui.modelCount', { count: provider.models.length }) }}</small></span></div></template>
      <template #header-extra>
        <n-switch size="small" :aria-label="`${provider.title || provider.name} ${t('ui.enableService')}`" :value="providersStore.allProviders[index].visible"
          :disabled="!providersStore.allProviders[index].openAISetting.apiKey || !providersStore.allProviders[index].openAISetting.baseURL"
          @update:value="(v) => providersStore.updateProvider(provider.id, { visible: v })" @click.stop />
      </template>
      <n-input-group class="my-2">
        <n-input-group-label>{{ t('settings.providers.apiKey') }}</n-input-group-label>
        <n-input type="password" :value="providersStore.allProviders[index].openAISetting?.apiKey ?? ''"
          @update:value="(v) => handleApiKeyUpdate(provider.id, v)" />
      </n-input-group>
      <n-input-group class="my-2">
        <n-input-group-label>{{ t('settings.providers.apiUrl') }}</n-input-group-label>
        <n-input :value="providersStore.allProviders[index].openAISetting?.baseURL ?? ''"
          @update:value="(v) => handleBaseURLUpdate(provider.id, v)" />
      </n-input-group>
      <div class="model-list-label">{{ t('ui.models') }}</div>
      <n-dynamic-tags :value="providersStore.allProviders[index].models ?? []"
        @update:value="(v: any) => providersStore.updateProvider(provider.id, { models: v })" />
      <ProviderModelControls :setting="provider.openAISetting" :models="provider.models"
        @update-setting="changes => updateSetting(provider.id, changes)"
        @update-models="models => providersStore.updateProvider(provider.id, { models })" />
    </n-collapse-item>
  </n-collapse>

  <!-- 添加 Provider 对话框 -->
  <n-modal v-model:show="showAddProviderModal" preset="dialog" title="添加 Provider">
    <n-form>
      <n-form-item label="供应商名称" required>
        <n-input v-model:value="newProviderForm.name" placeholder="例如：openai" />
      </n-form-item>
      <n-form-item label="显示名称">
        <n-input v-model:value="newProviderForm.title" placeholder="例如：OpenAI" />
      </n-form-item>
      <n-form-item label="API Key">
        <n-input v-model:value="newProviderForm.apiKey" type="password" placeholder="sk-..." />
      </n-form-item>
      <n-form-item label="API URL" required>
        <n-input v-model:value="newProviderForm.baseURL" placeholder="https://api.openai.com/v1" />
      </n-form-item>
      <n-form-item label="支持的模型">
        <n-dynamic-tags v-model:value="newProviderForm.models" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space>
        <n-button @click="showAddProviderModal = false">取消</n-button>
        <n-button type="primary" @click="handleAddProvider">确定</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.default-model-row { display: flex; align-items: center; gap: 20px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.default-model-label { font-size: 12px; flex-shrink: 0; }
.default-model-row .n-select { flex: 1; min-width: 0; }
.provider-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 16px; }
.provider-actions :deep(.n-button) { font-size: 12px; }
.provider-list :deep(.n-collapse-item) { margin: 10px 0 0; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); padding: 0 16px; }
.provider-list :deep(.n-collapse-item .n-collapse-item__header), .provider-list :deep(.n-collapse-item:first-child .n-collapse-item__header) { padding: 14px 0; }
.provider-list :deep(.n-collapse-item__content-inner) { padding: 0 0 8px; }
.provider-heading { display: flex; align-items: center; gap: 11px; }
.provider-avatar { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--bg-color); border: 1px solid var(--line); border-radius: 9px; color: var(--text-secondary); font: 500 15px var(--font-display); }
.provider-enabled .provider-avatar { color: var(--accent-ink); background: var(--accent-soft); }
.provider-heading strong { display: block; font-size: 13px; font-weight: 500; }
.provider-heading small { display: block; font-size: 10px; color: var(--text-secondary); }
.model-list-label { font-size: 12px; color: var(--text-secondary); padding: 14px 0 8px; }
:deep(.n-input-group-label) { font-size: 12px; color: var(--text-secondary); background: var(--bg-secondary); }
</style>
