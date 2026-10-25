<script setup lang="ts">
import type { Conversation } from '@common/types';
import { MENU_IDS, CONVERSATION_ITEM_MENU_IDS } from '@common/constants';
import { CTX_KEY } from './constants';
import { useDialog } from '@renderer/hooks/useDialog';
import { createContextMenu } from '@renderer/utils/contextMenu';
import { useConversationsStore } from '@renderer/stores/conversations';
import { useFilter } from './useFilter';
import { useContextMenu } from './useContextMenu';

import ListItem from './ListItem.vue';
import { SquarePen, Ellipsis } from 'lucide-vue-next';
import XierMark from '../XierMark.vue';
import SearchBar from './SearchBar.vue';
import OperationsBar from './OperationsBar.vue';
import UserBadge from './UserBadge.vue';
import AuthDialog from '@renderer/components/Auth/AuthDialog.vue';
import { openWindow } from '@renderer/utils/system';
import { WINDOW_NAMES } from '@common/constants';

defineOptions({ name: 'ConversationList' });

const props = defineProps<{ width: number }>();
const editId = ref<string | void>();
const checkedIds = ref<string[]>([]);

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const conversationsStore = useConversationsStore();
const showAuthDialog = ref(false);

const { createDialog } = useDialog();
const { conversations } = useFilter();

const { handle: handleListContexMenu, isBatchOperate } = useContextMenu();

const currentId = computed(() => String(route.params.id));

const conversationActionPolicy = new Map([
  [CONVERSATION_ITEM_MENU_IDS.DEL, async (_item: Conversation) => {

    const res = await createDialog({
      title: 'main.conversation.dialog.title',
      content: 'main.conversation.dialog.content',
    })
    if (res === 'confirm') {
      conversationsStore.delConversation(_item.id);
      _item.id === currentId.value && router.push('/conversation');
    }
  }
  ],
  [CONVERSATION_ITEM_MENU_IDS.RENAME, async (_item: Conversation) => {
    // 重命名对话
    editId.value = _item.id;
  }],
  [CONVERSATION_ITEM_MENU_IDS.PIN, async (_item: Conversation) => {
    // 切换置顶状态
    if (_item.pinned) {
      await conversationsStore.unpinConversation(_item.id);
    } else {
      await conversationsStore.pinConversation(_item.id);
    }
  }]
])

const batchActionPolicy = new Map([
  [CONVERSATION_ITEM_MENU_IDS.DEL, async () => {
    const res = await createDialog({
      title: 'main.conversation.dialog.title',
      content: 'main.conversation.dialog.content_1',
    })
    if (res !== 'confirm') return

    if (checkedIds.value.includes(currentId.value)) {
      router.push('/conversation');
    }
    checkedIds.value.forEach(id => conversationsStore.delConversation(id));
    isBatchOperate.value = false;
  }],
  [CONVERSATION_ITEM_MENU_IDS.PIN, () => {
    checkedIds.value.forEach(id => {
      if (conversationsStore.allConversations.find(item => item.id === id)?.pinned) {
        conversationsStore.unpinConversation(id);
        return
      }
      conversationsStore.pinConversation(id);
    });
    isBatchOperate.value = false;
  }]
])

function handleBatchOperate(OpId: CONVERSATION_ITEM_MENU_IDS) {
  const action = batchActionPolicy.get(OpId);
  action && action();
}

async function handleContextMenu(_item: Conversation) {
  const clickItem = await createContextMenu(
    MENU_IDS.CONVERSATION_ITEM,
    void 0,
    _item.pinned ? [{ label: 'menu.conversation.unpinConversation', id: CONVERSATION_ITEM_MENU_IDS.PIN }] : void 0) as CONVERSATION_ITEM_MENU_IDS;
  const action = conversationActionPolicy.get(clickItem);
  action && await action(_item);
}

function handleItemClick(item: Conversation) {
  if (item.id !== currentId.value)
    return router.push(`/conversation/${item.id}`);
}

function handleClickOutItem() {
  router.push('/conversation')
}

function updateTitle(id: string, title: string) {
  const target = conversationsStore.conversations.find(item => item.id === id);
  if (!target) return
  conversationsStore.updateConversation({
    ...target,
    title,
  });
  editId.value = void 0;
}
// ------------用户badge事件处理------------
function handleAllSelectChange(checked: boolean) {
  checkedIds.value = checked ? conversations.value.filter(item => item.type !== 'divider').map(item => item.id) : [];
}

function handleBadgeLogin() {
  showAuthDialog.value = true;
}

function handleBadgeProfile() {
  openWindow(WINDOW_NAMES.SETTING);
}

function handleBadgeSettings() {
  openWindow(WINDOW_NAMES.SETTING);
}

function handleAuthSuccess() {
  showAuthDialog.value = false;
}

provide(CTX_KEY, {
  width: computed(() => props.width),
  editId: computed(() => editId.value),
  checkedIds,
})
</script>

<template>
  <div class="conversation-list" @contextmenu.prevent.stop="handleListContexMenu">
    <div class="brand drag-region"><XierMark /><span>xier<span class="brand-dot">.</span></span></div>
    <button class="new-conversation" @click="handleClickOutItem"><SquarePen :size="17" :stroke-width="1.7" />{{ t('main.conversation.newConversation') }}</button>
    <SearchBar />
    <div class="list-heading"><span>{{ t('main.sidebar.conversations') }}</span><button class="icon-button" :aria-label="t('ui.conversationOptions')" :title="t('ui.conversationOptions')" @click="handleListContexMenu"><Ellipsis :size="17" /></button></div>
    <ul class="conversation-items">
      <template v-for="item in conversations" :key="item.id">
        <li v-if="item.type !== 'divider'" class="conversation-item" :class="{ selected: item.id === currentId, 'pinned-conversation': item.pinned }"
          @contextmenu.prevent.stop="handleContextMenu(item)">
          <div class="conversation-target" role="button" tabindex="0" :aria-current="item.id === currentId ? 'page' : undefined"
            @click.stop="handleItemClick(item)" @keydown.enter.self="handleItemClick(item)" @keydown.space.self.prevent="handleItemClick(item)">
            <ListItem v-bind="item" @update-title="updateTitle" />
          </div>
          <button class="icon-button item-menu" :aria-label="t('ui.conversationOptions')" @click.stop="handleContextMenu(item)"><Ellipsis :size="16" /></button>
        </li>
        <li v-else class="list-divider" />
      </template>
      <li v-if="!conversations.length" class="empty-list">{{ t('ui.emptyConversations') }}</li>
    </ul>
    <OperationsBar v-show="isBatchOperate" @select-all="handleAllSelectChange" @cancel="isBatchOperate = false" @op="handleBatchOperate" />
    <UserBadge @login="handleBadgeLogin" @profile="handleBadgeProfile" @settings="handleBadgeSettings" />
    <AuthDialog v-model:show="showAuthDialog" @success="handleAuthSuccess" />
  </div>
</template>
<style scoped>
.conversation-list { flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; padding: 0 14px; }
.brand { display: flex; align-items: center; gap: 8px; height: 65px; padding: 0 6px 8px; color: var(--accent-ink); }
.brand > span { font-family: var(--font-display); font-size: 27px; font-weight: 600; letter-spacing: -1.2px; color: var(--text-primary); }
.brand-dot { color: var(--accent-ink); }
.new-conversation { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; color: var(--text-primary); background: var(--surface); font-size: 13px; font-weight: 500; box-shadow: 0 1px 2px #20182f03; }
.new-conversation:hover { border-color: var(--text-tertiary); }
.new-conversation svg { color: var(--accent-ink); }
.list-heading { display: flex; justify-content: space-between; align-items: center; padding: 12px 7px 5px 10px; font-size: 11px; color: var(--text-secondary); }
.conversation-items { flex: 1; min-height: 0; overflow: auto; margin: 0 -3px; padding: 0 3px; list-style: none; }
.conversation-item { display: flex; position: relative; border-radius: 8px; margin-bottom: 4px; border: 1px solid transparent; }
.conversation-item:hover { background: color-mix(in srgb, var(--surface) 55%, transparent); }
.conversation-item.selected { background: var(--surface); border-color: var(--line); }
.conversation-target { flex: 1; min-width: 0; padding: 10px 28px 10px 11px; cursor: pointer; border-radius: 8px; }
.item-menu { position: absolute; right: 3px; top: 7px; opacity: 0; width: 24px; height: 24px; }
.conversation-item:hover .item-menu, .conversation-item:focus-within .item-menu { opacity: 1; }
.list-divider { height: 1px; background: var(--line); margin: 10px; }
.empty-list { padding: 24px 10px; color: var(--text-secondary); font-size: 12px; }
</style>
