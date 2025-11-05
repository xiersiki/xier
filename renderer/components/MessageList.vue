<script setup lang="ts">
import type { Message } from '@common/types';
import { MESSAGE_ITEM_MENU_IDS, MENU_IDS } from '@common/constants';
import { useMessage } from 'naive-ui';
import { createContextMenu } from '@renderer/utils/contextMenu';
import { useDialog } from '@renderer/hooks/useDialog'
import { useMessagesStore } from '@renderer/stores/messages'
import { useBatchTimeAgo } from '@renderer/hooks/useTimeAgo';
import { NCheckbox, NButton } from 'naive-ui';
import MessageRender from '@renderer/components/MessageRender.vue';
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
  () => props.messages[props.messages.length - 1]?.content,
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
  <div class="flex flex-col h-full">
    <!-- ✅ 使用 DynamicScroller 实现虚拟列表 -->
    <DynamicScroller ref="scrollerRef" :items="messages" :min-item-size="80" class="message-list px-5 pt-6"
      key-field="id">
      <template #default="{ item: message, index, active }">
        <DynamicScrollerItem :item="message" :active="active" :data-index="index" :size-dependencies="[message.content]"
          class="message-list-item mt-3 pb-5">
          <div class="flex items-center">
            <div class="pr-5" v-show="isBatchMode">
              <n-checkbox :checked="itemChecked(message.id)"
                @update:checked="(val) => handleCheckItem(message.id, val)" />
            </div>

            <div class="flex flex-auto" :class="{
              'justify-end': message.type === 'question',
              'justify-start': message.type === 'answer'
            }">
              <span>
                <div class="text-sm text-gray-500 mb-2"
                  :style="{ textAlign: message.type === 'question' ? 'end' : 'start' }">
                  {{ formatTimeAgo(message.createdAt) }}
                </div>

                <!-- 问题消息 -->
                <div v-if="message.type === 'question'" class="msg-shadow p-2 rounded-md bg-bubble-self text-white"
                  @contextmenu="handleContextMenu(message.id)">
                  <message-render :msg-id="message.id" :content="message.content"
                    :is-streaming="message.status === 'streaming'" />
                </div>

                <!-- 回答消息 -->
                <div v-else class="msg-shadow p-2 px-6 rounded-md" :class="{
                  'bg-bubble-others text-tx-primary': message.status !== 'error',
                  'text-red-300 font-bold': message.status === 'error'
                }" @contextmenu="handleContextMenu(message.id)">
                  <template v-if="message.status === 'loading'">
                    ...
                  </template>
                  <template v-else>
                    <message-render :msg-id="message.id" :content="message.content"
                      :is-streaming="message.status === 'streaming'" is-answer />
                  </template>
                </div>
              </span>
            </div>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <!-- 批量操作栏 -->
    <div v-show="isBatchMode" class="flex justify-between p-2 border-t-3 border-input">
      <n-button type="error" size="tiny" @click="handleBatchDelete">
        {{ t('main.message.batchActions.deleteSelected') }}
      </n-button>
      <n-button type="primary" size="tiny" quaternary @click="quitBatchMode">
        {{ t('dialog.cancel') }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.msg-shadow {
  box-shadow: 0 0 10px var(--input-bg);
}

/* ✅ 虚拟滚动器样式 */
.message-list {
  height: 100%;
  overflow-y: auto;
}

/* 自定义滚动条样式 */
.message-list::-webkit-scrollbar {
  width: 6px;
}

.message-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.message-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

.message-list::-webkit-scrollbar-track {
  background: transparent;
}
</style>
