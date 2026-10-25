<script setup lang="ts">
import { RouterView } from 'vue-router'
import { NConfigProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'

import { useNaiveTheme } from '@renderer/hooks/useNaiveTheme';
import { useNaiveLocale } from '@renderer/hooks/useNaiveLocale';
import { useFontSize } from '@renderer/hooks/useFontSize';

import { isMac as isMacOs } from './utils/system';

import ConversationList from '@renderer/components/ConversationList/index.vue';
import NavBar from '@renderer/components/NavBar.vue';
import ResizeDivider from '@renderer/components/ResizeDivider.vue';

const isMac = isMacOs();
const sidebarWidth = ref(268); // 初始宽度
const { theme, themeOverrides } = useNaiveTheme();
const { locale, dateLocale } = useNaiveLocale();
import AppInitializer from './AppInitializer.vue';


useFontSize();

</script>
<template>
  <NNotificationProvider>
    <n-config-provider class="h-full w-[100vw] flex" :theme="theme" :theme-overrides="themeOverrides" :locale="locale"
      :date-locale="dateLocale">
      <n-message-provider>
        <AppInitializer>
          <aside class="sidebar" :style="{ width: sidebarWidth + 'px' }">
            <!-- Mac ̵Ԥ -->
            <div v-if="isMac" class="sidebar-titlebar drag-region"></div>
            <div class="sidebar-content">
              <conversation-list :width="sidebarWidth" @click.stop @mouseleave.stop />
              <nav-bar />
            </div>
          </aside>
          <resize-divider direction="vertical" v-model:size="sidebarWidth" :max-size="360" :min-size="240" />
          <div class="workspace">
            <router-view />
          </div>
        </AppInitializer>

      </n-message-provider>
    </n-config-provider>
  </NNotificationProvider>
</template>

<style scoped>
.sidebar { height: 100%; flex-shrink: 0; display: flex; flex-direction: column; background: var(--bg-color); border-right: 1px solid var(--line); }
.sidebar-titlebar { height: 36px; flex-shrink: 0; }
.sidebar-content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.workspace { flex: 1; min-width: 0; height: 100%; }
:deep(.vertical) { width: 4px; margin-left: -4px; }
</style>
