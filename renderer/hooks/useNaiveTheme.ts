import { computed, ref, type Ref, type ComputedRef } from 'vue';
import { darkTheme, lightTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui';
import { useThemeMode } from './useThemeMode';
import { usePrimaryColor } from './usePrimaryColor';

// Naive UI computes alpha variants in JavaScript, so its palette needs concrete colors.
function blend(hex: string, base: string, ratio: number) {
  return '#' + [1, 3, 5].map(index => Math.round(
    parseInt(hex.slice(index, index + 2), 16) * ratio + parseInt(base.slice(index, index + 2), 16) * (1 - ratio)
  ).toString(16).padStart(2, '0')).join('');
}

export function useNaiveTheme(): { theme: Ref<GlobalTheme | null>; themeOverrides: ComputedRef<GlobalThemeOverrides> } {
  const theme = ref<GlobalTheme | null>(null);
  const { onThemeChange, isDark } = useThemeMode();
  const { primaryColors } = usePrimaryColor();
  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    const dark = isDark.value;
    const accent = blend(primaryColors.value?.DEFAULT ?? '#78658f', dark ? '#ded5ef' : '#383344', dark ? .45 : .65);
    const surface = dark ? '#2d2d36' : '#ffffff';
    const text = dark ? '#e6e4ec' : '#292733';
    const secondary = dark ? '#aaa7b6' : '#777582';
    const line = dark ? '#3c3b46' : '#e3e2e9';
    return {
      common: {
        primaryColor: accent, primaryColorHover: accent, primaryColorPressed: accent, primaryColorSuppl: accent,
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontSizeMedium: '13px', fontSizeSmall: '12px', fontSizeTiny: '11px', borderRadius: '8px', borderColor: line,
        textColorBase: text, textColor1: text, textColor2: text, textColor3: secondary,
        bodyColor: dark ? '#26262e' : '#fafafc', cardColor: surface, modalColor: surface, popoverColor: surface,
      },
      Input: { color: surface, colorFocus: surface, borderHover: `1px solid ${secondary}`, boxShadowFocus: '0 0 0 3px var(--accent-soft)' },
      InternalSelection: { color: surface, colorActive: surface },
      Button: { fontWeight: '500', textColorPrimary: dark ? '#26262e' : '#ffffff', textColorHoverPrimary: dark ? '#26262e' : '#ffffff' },
      Switch: { railColorActive: accent },
    };
  });
  window.api.isDarkTheme().then(dark => { theme.value = dark ? darkTheme : lightTheme; });
  onThemeChange(() => { theme.value = isDark.value ? darkTheme : lightTheme; });
  return { theme, themeOverrides };
}
export default useNaiveTheme;
