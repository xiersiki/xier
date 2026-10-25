<script setup lang="ts">
import type { Message } from '@common/types';
import { MESSAGE_ITEM_MENU_IDS, MENU_IDS } from '@common/constants';
import { useMessage } from 'naive-ui';
import { createContextMenu } from '@renderer/utils/contextMenu';
import { useDialog } from '@renderer/hooks/useDialog'
import { useMessagesStore } from '@renderer/stores/messages'
import { useBatchTimeAgo } from '@renderer/hooks/useTimeAgo';
import { NCheckbox, NButton } from 'naive-ui';
import XierMark from './XierMark.vue';
import MessageRender from '@renderer/components/MessageRender.vue';
import AnswerContent from '@renderer/components/AnswerContent.vue';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

defineOptions({ name: 'MessageList' })

const props = defineProps<{
  messages: Message[];
}>();

const isBatchMode = ref(false);
const checkedIds = ref<string[]>([]);

const itemChecked = computed(() => (id: string) => checkedIds.value.includes(id));

const route = useRoute();
const message = useMessage();
const { createDialog } = useDialog();
const { deleteMessage } = useMessagesStore();
const { t } = useI18n();

// ✅ 虚拟滚动器引用
const scrollerRef = ref<InstanceType<typeof DynamicScroller>>();

const messageActionPolicy = new Map<MESSAGE_ITEM_MENU_IDS, (msgId: string) => Promise<void>>([
  [MESSAGE_ITEM_MENU_IDS.COPY, async (msgId: string) => {
    const msg = props.messages.find((msg) => msg.id === msgId);
    if (!msg) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      message.success(t('main.message.dialog.copySuccess'));
    });
  }],
  [MESSAGE_ITEM_MENU_IDS.DELETE, async (msgId: string) => {
    const res = await createDialog({
      title: 'main.message.dialog.title',
      content: 'main.message.dialog.messageDelete',
    })
    if (res === 'confirm') deleteMessage(msgId);
  }],
  [MESSAGE_ITEM_MENU_IDS.SELECT, async (msgId: string) => {
    checkedIds.value = [...checkedIds.value, msgId]
    isBatchMode.value = true;
  }],
]);

/**
 * 使用批量时间格式化工具，提高列表性能
 */
const { formatTimeAgo } = useBatchTimeAgo();

async function handleContextMenu(msgId: string) {
  const clickItem = await createContextMenu(MENU_IDS.MSSAGE_ITEM);
  const action = messageActionPolicy.get(clickItem as MESSAGE_ITEM_MENU_IDS);
  action && await action(msgId);
}

function handleCheckItem(id: string, val: boolean) {
  if (val && !checkedIds.value.includes(id)) {
    checkedIds.value = [...checkedIds.value, id]
  } else {
    checkedIds.value = checkedIds.value.filter((_id) => _id !== id)
  }
}

async function handleBatchDelete() {
  const res = await createDialog({
    title: 'main.message.dialog.title',
    content: 'main.message.dialog.batchDelete',
  })
  if (res === 'confirm') {
    checkedIds.value.forEach((id) => deleteMessage(id));
    quitBatchMode();
  }
}

function quitBatchMode() {
  checkedIds.value = [];
  isBatchMode.value = false;
}

// ✅ 标记是否是初始加载
const isInitialLoad = ref(true);

// ✅ 滚动到底部 - 适配虚拟滚动器
async function scrollToBottom() {
  await nextTick();
  if (scrollerRef.value) {
    scrollerRef.value.scrollToBottom();
  }
}

// ✅ 监听路由变化 - 切换对话时重置为初始加载状态
watch(() => route.params.id, () => {
  isInitialLoad.value = true;
});

// ✅ 监听消息数量变化 - 只在新增消息时滚动
watch(() => props.messages.length, (newLength, oldLength) => {
  // 只在非初始加载且消息增加时才滚动
  if (!isInitialLoad.value && newLength > oldLength) {
    nextTick(() => {
      scrollToBottom();
    });
  }
});

// ✅ 监听最后一条消息内容变化（流式输出时）
watch(
  () => [props.messages[props.messages.length - 1]?.content, props.messages[props.messages.length - 1]?.reasoningContent, props.messages[props.messages.length - 1]?.status],
  () => {
    if (!isInitialLoad.value) {
      nextTick(() => {
        scrollToBottom();
      });
    }
  },
  { flush: 'post' }
);

onMounted(() => {
  // ✅ 初始加载时滚动到底部
  nextTick(() => {
    scrollToBottom();
    // 标记初始加载完成
    setTimeout(() => {
      isInitialLoad.value = false;
    }, 500);
  });

})
</script>

<template>
  <div class="messages-container">
    <DynamicScroller ref="scrollerRef" :items="messages" :min-item-size="80" class="message-list" key-field="id">
      <template #default="{ item: message, index, active }">
        <DynamicScrollerItem :item="message" :active="active" :data-index="index"
          :size-dependencies="[message.content, message.reasoningContent, message.status, message.error]" class="message-list-item">
          <div class="message-row" :class="message.type">
            <div v-show="isBatchMode" class="message-check"><NCheckbox :checked="itemChecked(message.id)" @update:checked="(val) => handleCheckItem(message.id, val)" /></div>
            <div class="message-body">
              <div class="message-meta">
                <template v-if="message.type === 'answer'"><XierMark /><span class="author">Xier</span></template>
                <span v-else class="author">{{ t('ui.you') }}</span>
                <time :datetime="new Date(message.createdAt).toISOString()">{{ formatTimeAgo(message.createdAt) }}</time>
              </div>
              <div v-if="message.type === 'question'" class="question-content" @contextmenu="handleContextMenu(message.id)">
                <MessageRender :msg-id="message.id" :content="message.content" :is-streaming="message.status === 'streaming'" />
              </div>
              <div v-else class="answer-content" @contextmenu="handleContextMenu(message.id)"><AnswerContent :message="message" /></div>
            </div>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
    <div v-show="isBatchMode" class="batch-toolbar">
      <NButton type="error" size="tiny" @click="handleBatchDelete">{{ t('main.message.batchActions.deleteSelected') }}</NButton>
      <NButton size="tiny" quaternary @click="quitBatchMode">{{ t('dialog.cancel') }}</NButton>
    </div>
  </div>
</template>
<style scoped>
.messages-container { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.message-list { height: 100%; overflow-y: auto; overflow-x: hidden; padding: 28px 32px 12px; }
.message-list-item { padding-bottom: 30px; }
.message-row { display: flex; gap: 12px; max-width: 780px; margin: 0 auto; min-width: 0; }
.message-body { font-size: var(--message-font-size, 14px); min-width: 0; width: 100%; }
.message-meta { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; font-size: 11px; color: var(--text-tertiary); }
.message-meta .author { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.message-meta :deep(.xier-mark) { width: 21px; height: 21px; color: var(--accent-ink); margin-left: -3px; }
.message-meta time { font-size: 10px; }
.question { justify-content: flex-end; }
.question .message-body { width: fit-content; max-width: 85%; }
.question .message-meta { justify-content: flex-end; }
.question-content { background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent-ink) 8%, var(--line)); padding: 11px 16px; border-radius: 14px 14px 4px 14px; color: var(--text-primary); }
.answer-content { padding: 0; color: var(--text-primary); }
.message-check { padding-top: 3px; }
.batch-toolbar { display: flex; justify-content: space-between; padding: 10px 32px; border-top: 1px solid var(--line); }
@media (max-width: 850px) { .message-list { padding-inline: 20px; } }
</style>
