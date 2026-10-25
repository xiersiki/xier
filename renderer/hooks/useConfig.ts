import { reactive, watch } from 'vue';
import type { IConfig } from '@common/types';
import { CONFIG_KEYS } from '@common/constants';
import { debounce } from '@common/utils';
import { setLanguage, getLanguage } from '@renderer/i18n';

const config = reactive<IConfig>({ themeMode: 'system', primaryColor: '#78658F', language: 'zh',
  fontSize: 14, minimizeToTray: false, provider: '', defaultModel: null });
const keys = Object.values(CONFIG_KEYS) as (keyof IConfig)[];
const persisted: Partial<IConfig> = {};
let ready = false;
function apply(values: Partial<IConfig>) {
  for (const key of keys) {
    if (values[key] !== undefined) {
      if (ready && config[key] !== persisted[key] && values[key] !== config[key]) continue;
      (persisted as any)[key] = values[key];
      (config as any)[key] = values[key];
    }
  }
  if (getLanguage() !== config.language) void setLanguage(config.language);
}
export const configReady = Promise.all(keys.map(async key => [key, await window.api.getConfig(key)] as const))
  .then(entries => { apply(Object.fromEntries(entries)); ready = true; });
window.api.onConfigChange(apply);
const save = debounce(() => {
  if (!ready) return;
  const updates: Partial<IConfig> = {};
  for (const key of keys) {
    if (config[key] !== persisted[key]) {
      (updates as any)[key] = config[key];
      (persisted as any)[key] = config[key];
    }
  }
  if (Object.keys(updates).length) window.api.updateConfig(updates);
}, 150);
watch(config, save, { deep: true });
export function useConfig() { return config; }
export default useConfig;
