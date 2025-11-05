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
const sidebarWidth = ref(320); // 初始宽度
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
          <aside class="sidebar h-full flex flex-shrink-0 flex-col" :style="{ width: sidebarWidth + 'px' }" v-ripple>
            <!-- Mac ̵Ԥ -->
            <div v-if="isMac" class="w-full h-[35px]"></div>
            <div class="flex-auto flex">
              <nav-bar />
              <conversation-list class="flex-auto" :width="sidebarWidth" @click.stop @mouseleave.stop />
            </div>
          </aside>
          <resize-divider direction="vertical" v-model:size="sidebarWidth" :max-size="500" :min-size="320" />
          <div class="flex-auto">
            <router-view />
          </div>
        </AppInitializer>

      </n-message-provider>
    </n-config-provider>
  </NNotificationProvider>
</template>

<style scoped>
.app-container {
  background-color: var(--bg-secondary);
}

.sidebar {
  background-color: var(--bg-color);
  box-shadow: -3px -2px 20px rgba(101, 101, 101, 0.2);
}
</style>
