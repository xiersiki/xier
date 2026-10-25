<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NSelect } from 'naive-ui';
import type { OpenAISetting } from '@common/types';
import { resolveModelAdapter } from '@common/modelAdapter';

const props = defineProps<{ setting: OpenAISetting; models: string[] }>();
const emit = defineEmits<{
  updateSetting: [setting: Partial<OpenAISetting>];
  updateModels: [models: string[]];
}>();
const loading = ref(false);
const available = ref<string[]>([]);
const selected = ref<string[]>([]);
const error = ref('');
const fetched = ref(false);
let generation = 0;
const isDeepSeek = computed(() => resolveModelAdapter(props.setting) === 'deepseek');
watch(() => [props.setting.apiKey, props.setting.baseURL], () => {
  generation++; loading.value = false; available.value = []; selected.value = []; error.value = ''; fetched.value = false;
});
async function discover() {
  const current = ++generation;
  loading.value = true; error.value = '';
  try {
    const models = await window.api.listProviderModels({ ...props.setting });
    if (current !== generation) return;
    available.value = models; fetched.value = true;
  } catch (e) { if (current === generation) error.value = e instanceof Error ? e.message : '获取模型失败'; }
  finally { if (current === generation) loading.value = false; }
}
function addSelected() {
  emit('updateModels', [...new Set([...props.models, ...selected.value])]); selected.value = [];
}
</script>

<template>
  <div class="model-controls">
    <label>接口适配
      <NSelect :value="setting.adapter ?? 'auto'" :options="[
        { label: '自动识别', value: 'auto' }, { label: 'OpenAI 兼容对话', value: 'openai-chat' }, { label: 'DeepSeek', value: 'deepseek' }
      ]" @update:value="value => emit('updateSetting', { adapter: value })" />
    </label>
    <template v-if="isDeepSeek">
      <label>思考模式
        <NSelect :value="setting.thinking ?? 'auto'" :options="[
          { label: '跟随模型默认', value: 'auto' }, { label: '开启', value: 'enabled' }, { label: '关闭', value: 'disabled' }
        ]" @update:value="value => emit('updateSetting', { thinking: value })" />
      </label>
      <label v-if="setting.thinking !== 'disabled'">思考强度
        <NSelect :value="setting.reasoningEffort ?? null" clearable placeholder="跟随模型默认" :options="[
          { label: '低', value: 'low' }, { label: '高', value: 'high' }, { label: '最高', value: 'max' }
        ]" @update:value="value => emit('updateSetting', { reasoningEffort: value ?? undefined })" />
      </label>
    </template>
    <NButton :loading="loading" :disabled="loading || !setting.apiKey || !setting.baseURL" @click="discover">获取模型列表</NButton>
    <p v-if="error" role="alert">{{ error }}。也可继续手动填写模型 ID。</p>
    <template v-if="fetched">
      <p>接口返回 {{ available.length }} 个模型；选择后添加，已有模型会保留。</p>
      <NSelect v-model:value="selected" multiple filterable placeholder="选择要添加的模型"
        :options="available.map(id => ({ label: id, value: id }))" />
      <NButton :disabled="!selected.length" @click="addSelected">添加所选模型</NButton>
    </template>
  </div>
</template>

<style scoped>
.model-controls { display: grid; gap: 0.75rem; margin: 20px 0 8px; padding-top: 16px; border-top: 1px solid var(--line); }
label { font-size: 12px; color: var(--text-secondary); display: grid; grid-template-columns: 6rem 1fr; align-items: center; gap: 0.5rem; }
p { font-size: 0.85em; opacity: 0.8; margin: 0; }
</style>
