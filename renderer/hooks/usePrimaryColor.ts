import { ref, watch } from 'vue';
import { setPrimaryColor } from '@renderer/utils/theme';
import { useConfig } from './useConfig';

export function usePrimaryColor() {
  const config = useConfig();
  const primaryColors = ref<ReturnType<typeof setPrimaryColor>>();
  // Apply immediately and when another window changes the preference.
  watch(() => config.primaryColor, color => { primaryColors.value = setPrimaryColor(color); }, { immediate: true });
  return {
    setPrimaryColor: (color: string) => { config.primaryColor = color; },
    primaryColors,
  };
}
export default usePrimaryColor;
