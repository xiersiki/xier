<script setup lang="ts">
import { ref, computed } from 'vue';
import { useThemeMode } from '@renderer/hooks/useThemeMode';
import { Icon as IconifyIcon } from '@iconify/vue';
import NativeTooltip from './NativeTooltip.vue';

defineOptions({ name: 'ThemeSwitcher' });

const {
  themeTooltip,
  themeIcon,
  setThemeMode,
} = useThemeMode();
const isDarkMode = usePreferredDark();

// 动画时长（毫秒），可根据需要调整或改为 props 传入
const props = defineProps<{ duration?: number }>();
const duration = computed(() => props.duration ?? 400);

const buttonRef = ref<HTMLElement | null>(null);

async function toggleThemeMode() {
  const next = isDarkMode.value ? 'light' : 'dark';

  // 无 View Transition API 时，直接切换
  if (!(document as any).startViewTransition || !buttonRef.value) {
    setThemeMode(next);
    return;
  }

  const { top, left, width, height } = buttonRef.value.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const maxRadius = Math.hypot(
    Math.max(left, window.innerWidth - left),
    Math.max(top, window.innerHeight - top)
  );

  // 使用 View Transition API 包裹主题切换
  const transition = (document as any).startViewTransition(() => {
    setThemeMode(next);
  });

  await transition.ready;

  document.documentElement.animate(
    {
      clipPath: [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${maxRadius}px at ${x}px ${y}px)`
      ]
    },
    {
      duration: duration.value,
      easing: 'ease-in-out',
      // 仅对新视图应用揭示动画
      pseudoElement: '::view-transition-new(root)'
    }
  );
}
</script>

<template>
  <native-tooltip :content="themeTooltip">
    <div ref="buttonRef" class="cursor-pointer flex items-center justify-center" @click="toggleThemeMode">
      <iconify-icon :icon="themeIcon" width="24" height="24" />
    </div>
  </native-tooltip>

</template>

<style>
/* View Transition API 的全局样式（非 scoped） */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-old(root) {
  z-index: 1;
}

::view-transition-new(root) {
  z-index: 999;
}
</style>
