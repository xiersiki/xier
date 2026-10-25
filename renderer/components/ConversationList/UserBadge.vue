<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, UserRound } from 'lucide-vue-next';
import { NDropdown, type DropdownOption } from 'naive-ui';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@renderer/stores/auth';
import { notify } from '@renderer/utils/notify';

const emit = defineEmits<{
  login: [];
  profile: [];
  settings: [];
}>();

const authStore = useAuthStore();
const router = useRouter();
const dropdownVisible = ref(false);

const displayName = computed(() => {
  const email = authStore.user?.email;
  if (email) return email;
  const phone = authStore.user?.phone;
  if (phone) return phone;
  return '未知用户';
});

const menuOptions = computed<DropdownOption[]>(() => ([
  { label: '个人资料', key: 'profile' },
  { label: '设置', key: 'settings' },
  { label: authStore.syncing ? '正在同步…' : '立即同步', key: 'sync', disabled: authStore.syncing },
  { label: '退出登录', key: 'logout' },
]));

const badgeInitials = computed(() => {
  const name = displayName.value;
  if (!name) return '?';
  const matched = name.trim().charAt(0).toUpperCase();
  return matched || '?';
});

function handleLoginClick() {
  emit('login');
}

async function handleSelect(key: string | number) {
  if (key === 'sync') {
    dropdownVisible.value = false;
    if (await authStore.syncUserData()) notify.success('同步完成');
    return;
  }
  if (key === 'logout') {
    await authStore.signOut();
    dropdownVisible.value = false;
    router.push('/conversation');
    return;
  }
  if (key === 'profile') {
    emit('profile');
    dropdownVisible.value = false;
    return;
  }
  if (key === 'settings') {
    emit('settings');
    dropdownVisible.value = false;
    return;
  }
}
</script>

<template>
  <div class="account-area">
    <button v-if="!authStore.isAuthenticated" class="account-button" @click="handleLoginClick">
      <span class="account-avatar"><UserRound :size="17" /></span><span class="account-copy"><span>本地访客</span><small>登录以同步对话</small></span><ChevronDown :size="14" />
    </button>
    <n-dropdown v-else trigger="click" placement="top-start" :options="menuOptions" :show-arrow="false"
      v-model:show="dropdownVisible" @select="handleSelect">
      <button type="button" class="account-button" :title="displayName">
        <span class="account-avatar">{{ badgeInitials }}</span>
        <span class="account-copy"><span>{{ displayName }}</span><small>{{ authStore.syncing ? '正在同步…' : '账户与同步' }}</small></span>
        <ChevronDown :size="14" />
      </button>
    </n-dropdown>
  </div>
</template>
<style scoped>
.account-area { padding: 12px 0 10px; }
.account-button { display: flex; align-items: center; gap: 9px; padding: 8px 6px; width: 100%; background: transparent; border: 0; border-radius: 8px; text-align: left; color: var(--text-secondary); }
.account-button:hover { background: var(--input-bg); }
.account-avatar { width: 32px; height: 32px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); display: flex; align-items: center; justify-content: center; color: var(--accent-ink); font-size: 13px; flex-shrink: 0; }
.account-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; font-size: 12px; color: var(--text-primary); }
.account-copy > span { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.account-copy small { font-size: 10px; color: var(--text-secondary); margin-top: 1px; }
</style>
