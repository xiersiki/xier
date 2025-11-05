<script setup lang="ts">
import { useConversationsStore } from '@renderer/stores/conversations';
import { logger } from '@renderer/utils/logger';
import { v4 as uuid } from 'uuid';
defineOptions({ name: 'CreateConversation' });
const props = defineProps<{
  providerId: string;
  selectedModel: string;
}>();

const { t } = useI18n();
const conversationsStore = useConversationsStore();

async function createConversation(title?: string) {
  logger.info('创建新对话', { providerId: props.providerId, selectedModel: props.selectedModel });
  if (!props.providerId || !props.selectedModel) return;
  const conversationId = await conversationsStore.addConversation({
    title: title ?? t('main.conversation.newConversation'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    providerId: String(props.providerId),
    selectedModel: props.selectedModel,
    pinned: false,
    version: 1, // 新创建默认版本为1
    dirty: true, // 没有和云端同步
    idempotentKey: uuid(), // 生成最开始的 idempotent key
  });
  return conversationId;
}
</script>

<template>
  <slot :create="createConversation">
    <!-- renderless -->
  </slot>
</template>
