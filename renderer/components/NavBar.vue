<script setup lang="ts">
import { Settings2 } from 'lucide-vue-next';
import { WINDOW_NAMES } from '@common/constants';
import { openWindow } from '@renderer/utils/system';
import ThemeSwitcher from './ThemeSwitcher.vue';
const { t } = useI18n();
</script>
<template>
  <nav class="sidebar-tools">
    <button class="settings-link" @click="openWindow(WINDOW_NAMES.SETTING)"><Settings2 :size="16" :stroke-width="1.6" />{{ t('main.sidebar.settings') }}</button>
    <ThemeSwitcher />
  </nav>
</template>
<style scoped>
.sidebar-tools { display: flex; align-items: center; justify-content: space-between; margin: 0 18px; padding: 10px 0 14px; border-top: 1px solid var(--line); }
.settings-link { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 12px; border: 0; background: transparent; border-radius: 6px; padding: 5px 3px; }
.settings-link:hover { color: var(--text-primary); }
</style>
