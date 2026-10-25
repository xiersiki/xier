<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NScrollbar, NSelect, NColorPicker, NSwitch, NNotificationProvider } from 'naive-ui';
import { useNaiveTheme } from '@renderer/hooks/useNaiveTheme';
import { useNaiveLocale } from '@renderer/hooks/useNaiveLocale';
import { useFontSize } from '@renderer/hooks/useFontSize';
import { useConfig } from '@renderer/hooks/useConfig';

import { SlidersHorizontal, Boxes } from 'lucide-vue-next';
import XierMark from '@renderer/components/XierMark.vue';
import SettingInitializer from './SettingInitializer.vue';
import ProvidersConfig from './providers.vue';

useFontSize();
const { theme, themeOverrides } = useNaiveTheme();
const { locale, dateLocale } = useNaiveLocale();
const { t } = useI18n();
const activeTab = ref('basic');
const showColorPicker = ref(false);

const formModel = useConfig();


const languageOptions = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
];
const themeModeOptions = computed(() => [
  { label: t('settings.theme.dark'), value: 'dark' },
  { label: t('settings.theme.light'), value: 'light' },
  { label: t('settings.theme.system'), value: 'system' },
]);
const fontSizeOptions = computed(() => [
  { label: t('settings.appearance.fontSizeOptions.10'), value: 10 },
  { label: t('settings.appearance.fontSizeOptions.12'), value: 12 },
  { label: t('settings.appearance.fontSizeOptions.14'), value: 14 },
  { label: t('settings.appearance.fontSizeOptions.16'), value: 16 },
  { label: t('settings.appearance.fontSizeOptions.18'), value: 18 },
  { label: t('settings.appearance.fontSizeOptions.20'), value: 20 },
  { label: t('settings.appearance.fontSizeOptions.24'), value: 24 },
]);

function onWindowClose() {
  setTimeout(() => activeTab.value = 'basic', 300);
}
</script>

<template>
  <NNotificationProvider>
    <NConfigProvider class="settings-shell" :locale="locale" :date-locale="dateLocale" :theme="theme" :theme-overrides="themeOverrides">
      <NMessageProvider><SettingInitializer>
        <TitleBar class="settings-titlebar" :is-maximizable="false" @close="onWindowClose"><DragRegion class="settings-drag">{{ t('settings.title') }}</DragRegion></TitleBar>
        <div class="settings-layout">
          <nav class="settings-nav">
            <div class="settings-brand"><XierMark /><span>xier.</span></div>
            <button :class="{ active: activeTab === 'basic' }" @click="activeTab = 'basic'"><SlidersHorizontal :size="17" :stroke-width="1.6" />{{ t('ui.appearance') }}</button>
            <button :class="{ active: activeTab === 'provider' }" @click="activeTab = 'provider'"><Boxes :size="17" :stroke-width="1.6" />{{ t('ui.modelServices') }}</button>
          </nav>
          <NScrollbar class="settings-scroll">
            <div class="settings-content">
              <header class="settings-heading"><h1>{{ t(activeTab === 'basic' ? 'ui.preferencesTitle' : 'ui.modelServices') }}</h1><p>{{ t(activeTab === 'basic' ? 'ui.preferencesDescription' : 'ui.servicesDescription') }}</p></header>
              <template v-if="activeTab === 'basic'">
                <h2 class="section-label">{{ t('ui.appearance') }}</h2>
                <section class="settings-card">
                  <div class="setting-row"><label>{{ t('settings.theme.label') }}</label><NSelect v-model:value="formModel.themeMode" :options="themeModeOptions" :aria-label="t('settings.theme.label')" /></div>
                  <div class="setting-row"><label>{{ t('settings.theme.primaryColor') }}</label><div class="color-setting"><span>{{ formModel.primaryColor }}</span><NColorPicker v-model:value="formModel.primaryColor" v-model:show="showColorPicker" :show-alpha="false" :modes="['hex']" :render-label="() => ''" :swatches="['#78658F', '#5D7790', '#54796B', '#AD765F', '#6C6D76', '#BB5BE7']" role="button" tabindex="0" :aria-label="t('settings.theme.primaryColor')" @keydown.enter="showColorPicker = true" @keydown.space.prevent="showColorPicker = true" /></div></div>
                  <div class="setting-row"><label>{{ t('settings.appearance.fontSize') }}</label><NSelect v-model:value="formModel.fontSize" :options="fontSizeOptions" :aria-label="t('settings.appearance.fontSize')" /></div>
                </section>
                <h2 class="section-label">{{ t('ui.general') }}</h2>
                <section class="settings-card">
                  <div class="setting-row"><label>{{ t('settings.language.label') }}</label><NSelect v-model:value="formModel.language" :options="languageOptions" :aria-label="t('settings.language.label')" /></div>
                  <div class="setting-row behavior-row"><label>{{ t('settings.behavior.minimizeToTray') }}</label><NSwitch v-model:value="formModel.minimizeToTray" :aria-label="t('settings.behavior.minimizeToTray')" /></div>
                </section>
                <p class="save-hint">{{ t('ui.autoSave') }}</p>
              </template>
              <ProvidersConfig v-else />
            </div>
          </NScrollbar>
        </div>
      </SettingInitializer></NMessageProvider>
    </NConfigProvider>
  </NNotificationProvider>
</template>
<style scoped>
.settings-shell { height: 100vh; display: flex; flex-direction: column; background: var(--bg-secondary); color: var(--text-primary); }
.settings-titlebar { height: 38px; flex-shrink: 0; background: var(--bg-color); }
.settings-drag { text-align: center; font-size: 11px; color: var(--text-secondary); padding-top: 10px; }
.settings-layout { flex: 1; min-height: 0; display: flex; }
.settings-nav { width: 166px; padding: 12px; flex-shrink: 0; background: var(--bg-color); border-right: 1px solid var(--line); }
.settings-brand { display: flex; gap: 7px; align-items: center; padding: 8px 10px 28px; color: var(--accent-ink); }
.settings-brand span { font: 600 23px var(--font-display); letter-spacing: -1px; color: var(--text-primary); }
.settings-brand :deep(svg) { width: 26px; height: 26px; }
.settings-nav button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; margin-bottom: 5px; border: 1px solid transparent; border-radius: 8px; background: transparent; font-size: 12px; color: var(--text-secondary); }
.settings-nav button:hover { color: var(--text-primary); }
.settings-nav button.active { background: var(--surface); border-color: var(--line); color: var(--text-primary); }
.settings-nav button.active svg { color: var(--accent-ink); }
.settings-scroll { flex: 1; min-width: 0; }
.settings-content { max-width: 760px; margin: auto; padding: 26px 30px 40px; }
.settings-heading { margin-bottom: 28px; }
.settings-heading h1 { margin: 0 0 6px; font-size: 23px; font-weight: 600; letter-spacing: -.5px; }
.settings-heading p, .save-hint { font-size: 12px; color: var(--text-secondary); line-height: 1.8; }
.section-label { font-size: 12px; font-weight: 500; color: var(--text-secondary); margin: 24px 2px 9px; }
.settings-card { border: 1px solid var(--line); border-radius: 11px; background: var(--surface); padding: 0 18px; }
.setting-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; min-height: 64px; border-bottom: 1px solid var(--line); }
.setting-row:last-child { border-bottom: 0; }
.setting-row label { font-size: 13px; flex: 1; }
.setting-row > :last-child { width: 175px; flex-shrink: 0; }
.setting-row.behavior-row > :last-child { width: auto; }
.color-setting { display: flex; justify-content: flex-end; align-items: center; gap: 12px; color: var(--text-secondary); font: 11px var(--font-mono); }
.color-setting :deep(.n-color-picker) { width: 32px; height: 32px; }
.save-hint { margin: 16px 2px; font-size: 11px; }
</style>
