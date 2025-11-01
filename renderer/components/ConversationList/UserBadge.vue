<script setup lang="ts">
import { computed, ref } from 'vue';
import { NDropdown, type DropdownOption } from 'naive-ui';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@renderer/stores/auth';

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
  <div class="px-2 py-3">
    <div v-if="!authStore.isAuthenticated" @click="handleLoginClick"
      class="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] px-3 py-2 rounded-md cursor-pointer">
      <div class="flex items-center gap-2">
        <div
          class="w-8 h-8 rounded-full bg-[var(--primary-color)]/20 text-[var(--primary-color)] flex items-center justify-center font-medium">
          <span>未</span>
        </div>
        <div class="flex flex-col">
          <span class="text-sm text-tx-primary">未登录</span>
        </div>
      </div>
      <button class="px-3 py-1 text-xs rounded-md bg-[var(--primary-color)] text-white hover:opacity-90 transition"
        type="button" @click="handleLoginClick">
        登录
      </button>
    </div>

    <n-dropdown v-else trigger="click" placement="top-start" :options="menuOptions" :show-arrow="false"
      v-model:show="dropdownVisible" @select="handleSelect">
      <button type="button"
        class="w-full flex items-center justify-between gap-3 bg-[var(--bg-secondary)] px-3 py-2 rounded-md hover:bg-[var(--bg-mute)] transition">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-full bg-[var(--primary-color)]/20 text-[var(--primary-color)] flex items-center justify-center font-medium">
            <span>{{ badgeInitials }}</span>
          </div>
          <div class="flex flex-col text-left">
            <span class="text-sm text-tx-primary">{{ displayName }}</span>
            <span class="text-xs text-tx-secondary">点击查看账户选项</span>
          </div>
        </div>
        <svg class="w-4 h-4 text-tx-secondary" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clip-rule="evenodd" />
        </svg>
      </button>
    </n-dropdown>
  </div>
</template>
