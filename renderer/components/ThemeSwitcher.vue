<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next';
import { useThemeMode } from '@renderer/hooks/useThemeMode';
const { isDark, setThemeMode } = useThemeMode();
const { t } = useI18n();
</script>
<template>
  <button class="icon-button" :aria-label="t(isDark ? 'settings.theme.light' : 'settings.theme.dark')"
    :title="t(isDark ? 'settings.theme.light' : 'settings.theme.dark')" @click="setThemeMode(isDark ? 'light' : 'dark')">
    <Sun v-if="isDark" :size="17" :stroke-width="1.6" /><Moon v-else :size="17" :stroke-width="1.6" />
  </button>
</template>
