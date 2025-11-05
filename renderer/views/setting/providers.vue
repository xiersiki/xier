<script setup lang="ts">
import type { Provider } from '@common/types';
import { NCollapse, NCollapseItem, NSwitch, NInput, NInputGroup, NInputGroupLabel, NDynamicTags, NDivider, NSelect, NButton, NModal, NForm, NFormItem, NSpace } from 'naive-ui';
import { stringifyOpenAISetting } from '@common/utils';
import { useProvidersStore } from '@renderer/stores/providers';
import { useConfig } from '@renderer/hooks/useConfig';
import { v4 as uuid } from 'uuid';
import { stringifyModels } from '@common/dataHelpers';

const providersStore = useProvidersStore();
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
  const baseURL = providersStore.allProviders.find(item => item.id === id)?.openAISetting?.baseURL ?? '';
  const update: Partial<Provider> = { openAISetting: stringifyOpenAISetting({ apiKey, baseURL }) };
  if (!baseURL || !apiKey) update.visible = false;
  providersStore.updateProvider(id, { ...update });
}

function handleBaseURLUpdate(id: string, baseURL: string) {
  const apiKey = providersStore.allProviders.find(item => item.id === id)?.openAISetting?.apiKey ?? '';
  const update: Partial<Provider> = { openAISetting: stringifyOpenAISetting({ apiKey, baseURL }) };
  if (!baseURL || !apiKey) update.visible = false;
  providersStore.updateProvider(id, { ...update });
}

function openAddProviderModal() {
  showAddProviderModal.value = true;
  // 重置表单
  newProviderForm.value = {
    name: '火山引擎',
    title: '豆包',
    apiKey: '0f6333a4-477d-43c0-b918-7d694fb2ad94',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: ['doubao-seed-1-6-lite-251015'],
  };
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

onMounted(() => providersStore.initialize());
</script>

<template>

  <div class="flex items-center py-4">
    <div class="w-[100px]">
      {{ t('settings.providers.defaultModel') }}：
    </div>
    <n-select v-model:value="defaultModel" :options="providerOptions" clearable />
  </div>
  <n-divider />

  <!-- 添加 Provider 按钮 -->
  <div class="mb-4">
    <n-button type="primary" @click="openAddProviderModal">
      ➕ {{ t('settings.providers.addProvider') || '添加 Provider' }}
    </n-button>
  </div>

  <n-collapse>
    <n-collapse-item v-for="(provider, index) in providersStore.allProviders" :key="provider.name"
      :title="provider.title ?? provider.name">
      <template #header-extra>
        <n-switch :value="providersStore.allProviders[index].visible"
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
      <n-dynamic-tags :value="providersStore.allProviders[index].models ?? []"
        @update:value="(v: any) => providersStore.updateProvider(provider.id, { models: v })" />
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
