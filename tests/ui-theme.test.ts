import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, expect, it, vi } from 'vitest';
import { NConfigProvider, NDropdown, NInput, NSelect, NSwitch } from 'naive-ui';
import { useNaiveTheme } from '../renderer/hooks/useNaiveTheme';

const mode = vi.hoisted(() => ({ dark: false }));
vi.mock('../renderer/hooks/useThemeMode', () => ({
  useThemeMode: () => ({ isDark: ref(mode.dark), onThemeChange: vi.fn() }),
}));
vi.mock('../renderer/hooks/usePrimaryColor', () => ({
  usePrimaryColor: () => ({ primaryColors: ref({ DEFAULT: '#BB5BE7' }) }),
}));
beforeEach(() => {
  window.api.isDarkTheme = vi.fn(async () => mode.dark);
});

it.each([false, true])('renders real Naive UI controls with the %s dark theme without color parsing failures', async dark => {
  mode.dark = dark;
  const errors: unknown[] = [];
  const wrapper = mount(defineComponent({
    setup() {
      const { theme, themeOverrides } = useNaiveTheme();
      return () => h(NConfigProvider, { theme: theme.value, themeOverrides: themeOverrides.value }, {
        default: () => [h(NInput), h(NSelect, { options: [{ label: 'DeepSeek', value: 'model' }] }),
          h(NSwitch), h(NDropdown, { options: [] }, { default: () => h('button', 'Account') })],
      });
    },
  }), { global: { config: { errorHandler: error => { errors.push(error); } } } });
  await flushPromises();
  expect(errors).toEqual([]);
  expect(wrapper.find('input').exists()).toBe(true);
  expect(wrapper.find('[role="switch"]').exists()).toBe(true);
  expect(wrapper.text()).toContain('Account');
  wrapper.unmount();
});
