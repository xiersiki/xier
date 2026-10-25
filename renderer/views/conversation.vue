<script setup lang="ts">
import type { SelectValue } from '@renderer/types';
import { useMessagesStore } from '@renderer/stores/messages';
import { useConversationsStore } from '@renderer/stores/conversations';
import { useProvidersStore } from '@renderer/stores/providers';
import { useConfig } from '@renderer/hooks/useConfig';

import XierMark from '@renderer/components/XierMark.vue';
import MessageList from '@renderer/components/MessageList.vue';
import MessageInput from '@renderer/components/MessageInput.vue';
import CreateConversation from '@renderer/components/CreateConversation.vue';

const isStoping = ref(false);
const message = ref('');
const provider = ref<SelectValue>();
const msgInputRef = useTemplateRef<{ selectedProvider: SelectValue }>('msgInputRef');

const route = useRoute();
const router = useRouter();

const config = useConfig();
const conversationTitle = computed(() => conversationsStore.getConversationById(conversationId.value ?? '')?.title ?? '');

const { t } = useI18n();

const messagesStore = useMessagesStore();
const conversationsStore = useConversationsStore();
const providersStore = useProvidersStore();

const providerId = computed(() => ((provider.value as string)?.split(':')[0]) ?? '');
const selectedModel = computed(() => ((provider.value as string)?.split(':').slice(1).join(':')) ?? '');
const conversationId = computed(() => route.params.id ? String(route.params.id) : undefined);
const defaultModel = computed(() => {
  const vals: string[] = [];
  providersStore.allProviders.forEach(provider => {
    if (!provider.visible) return;
    provider.models.forEach(model => {
      vals.push(`${provider.id}:${model}`)
    })
  })
  if (!vals.includes(config.defaultModel ?? '')) return null
  return config.defaultModel || null;
});

const messageInputStatus = computed(() => {
  if (isStoping.value) return 'loading';
  const messages = messagesStore.messagesByConversationId(conversationId.value ?? '-1');
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.status === 'streaming' && lastMessage?.content?.length === 0) return 'loading';
  if (lastMessage?.status === 'loading' || lastMessage?.status === 'streaming') return lastMessage.status
  return 'normal';
})


async function handleCreateConversation(create: (title: string) => Promise<string | void>, _message: string) {
  const id = await create(_message);
  if (!id) return;
  afterCreateConversation(id, _message);
}
function afterCreateConversation(id: string | void, firstMsg: string) {
  if (!id) return;
  router.push(`/conversation/${id}`);
  messagesStore.sendMessage({
    type: 'question',
    content: firstMsg,
    conversationId: id,
  });
  message.value = '';
  conversationsStore.setMessageInputValue(id, '');
}

const canUpdateConversationTime = ref(true);
function handleProviderSelect() {
  const current = conversationsStore.getConversationById(conversationId.value as string)
  if (!conversationId.value || !current) return;
  conversationsStore.updateConversation({
    ...current,
    providerId: String(providerId.value),
    selectedModel: selectedModel.value,
  }, canUpdateConversationTime.value)
}


async function handleSendMessage() {
  if (!conversationId.value) return;
  const _conversationId = conversationId.value;
  const content = conversationsStore.messageInputValueById(_conversationId);
  if (!content?.trim()?.length) return;

  await messagesStore.sendMessage({
    conversationId: _conversationId,
    type: 'question',
    content,
  });
  conversationsStore.setMessageInputValue(_conversationId, '');
}

async function handleStopMessage() {
  isStoping.value = true;
  const msgIds = messagesStore.loadingMsgIdsByConversationId(conversationId.value ?? '-1');
  for (const id of msgIds) {
    await messagesStore.stopMessage(id);
  }
  isStoping.value = false;
}

onBeforeRouteUpdate(async (to, from, next) => {
  if (to.params.id === from.params.id) return next();
  await messagesStore.initialize(String(to.params.id));
  next();
})

watch(() => defaultModel.value, (val) => {
  if (val !== provider.value && !conversationId.value) provider.value = val
}, { immediate: true });

watch([() => conversationId.value, () => msgInputRef.value], async ([id, msgInput]) => {
  if (!msgInput || !id) {
    provider.value = defaultModel.value;
    return;
  };
  const current = conversationsStore.getConversationById(id);
  if (!current) return;
  canUpdateConversationTime.value = false;

  msgInput.selectedProvider = `${current.providerId}:${current.selectedModel}`;
  await nextTick();
  canUpdateConversationTime.value = true;
  message.value = ''
});

</script>
<template>
  <section v-if="!conversationId" class="welcome-view">
    <div class="welcome-content">
      <div class="welcome-symbol"><XierMark /></div>
      <p class="welcome-eyebrow">XIER</p>
      <h1>{{ t('ui.welcomeTitle') }}</h1>
      <p class="welcome-description">{{ t('ui.welcomeDescription') }}</p>
      <CreateConversation :provider-id="providerId" :selected-model="selectedModel" v-slot="{ create }">
        <MessageInput v-model:message="message" v-model:provider="provider" :placeholder="t('main.conversation.placeholder')" @send="handleCreateConversation(create, message)" />
      </CreateConversation>
    </div>
  </section>
  <section v-else class="conversation-view">
    <header class="conversation-header drag-region">
      <h1 :title="conversationTitle">{{ conversationTitle }}</h1>
      <span>{{ t('main.sidebar.conversations') }}</span>
    </header>
    <div class="reading-area"><MessageList :messages="messagesStore.messagesByConversationId(conversationId)" /></div>
    <div class="composer-area">
      <MessageInput ref="msgInputRef" :message="conversationsStore.messageInputValueById(conversationId ?? '-1')"
        v-model:provider="provider" :placeholder="t('main.conversation.placeholder')" :status="messageInputStatus"
        @update:message="(val) => conversationsStore.setMessageInputValue(conversationId ?? '-1', val)"
        @send="handleSendMessage" @stop="handleStopMessage" @select="handleProviderSelect" />
    </div>
  </section>
</template>
<style scoped>
.conversation-view { height: 100%; display: flex; flex-direction: column; min-width: 0; }
.conversation-header { display: flex; align-items: center; gap: 20px; justify-content: space-between; height: 47px; flex-shrink: 0; padding: 0 32px 12px; border-bottom: 1px solid var(--line); }
.conversation-header h1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
.conversation-header > span { flex-shrink: 0; color: var(--text-tertiary); font-size: 11px; }
.reading-area { flex: 1; min-height: 0; }
.composer-area { width: 100%; max-width: 844px; margin: 0 auto; padding: 12px 32px 20px; }
.welcome-view { height: 100%; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 30px 36px 80px; }
.welcome-content { width: 100%; max-width: 670px; }
.welcome-symbol { display: flex; align-items: center; justify-content: center; width: 58px; height: 58px; border: 1px solid var(--line); background: var(--surface); border-radius: 19px; color: var(--accent-ink); margin-bottom: 24px; box-shadow: 0 4px 12px #22212c04; }
.welcome-symbol :deep(svg) { width: 34px; height: 34px; }
.welcome-eyebrow { font-family: var(--font-display); font-size: 11px; letter-spacing: 3px; color: var(--text-secondary); margin: 0 0 9px; }
h1 { margin: 0; }
.welcome-content h1 { font-family: "Songti SC", "STSong", Georgia, serif; font-size: clamp(26px, 3vw, 36px); font-weight: 500; letter-spacing: .02em; line-height: 1.5; }
.welcome-description { color: var(--text-secondary); font-size: 13px; margin: 12px 0 32px; line-height: 1.8; }
@media (max-width: 850px) { .composer-area { padding-inline: 20px; } .conversation-header { padding-inline: 20px; } .welcome-view { padding-inline: 24px; } }
@media (max-height: 640px) { .welcome-view { padding-block: 24px; } .welcome-symbol { margin-bottom: 16px; } }
</style>
