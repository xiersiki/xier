<script setup lang="ts">
import type { SelectValue } from '@renderer/types';
import { SHORTCUT_KEYS } from '@common/constants'
import { ArrowUp, Square } from 'lucide-vue-next';
import { isMac } from '@renderer/utils/system';
import { listenShortcut } from '../utils/shortcut';
import ProviderSelect from './ProviderSelect.vue';

interface Props {
  placeholder?: string;
  status?: 'loading' | 'streaming' | 'normal';
}
interface Emits {
  (e: 'send', message: string): void;
  (e: 'select', provider: SelectValue): void;
  (e: 'stop'): void;
}

defineOptions({ name: 'MessageInput' });

const props = withDefaults(defineProps<Props>(), { placeholder: '', status: 'normal' })
const emit = defineEmits<Emits>();
const focused = ref(false);
const inputRef = useTemplateRef<HTMLTextAreaElement>('inputRef');
const sendKey = isMac() ? '⌘ ↵' : 'Ctrl ↵';
const message = defineModel('message', {
  type: String,
  default: ''
});

const selectedProvider = defineModel<SelectValue>('provider');

// 使用i18n
const { t } = useI18n();

const isBtnDisabled = computed(() => {
  if (props.status === 'loading') return false;
  if (props.status === 'streaming') return false;

  if (!selectedProvider.value) return true;
  return message.value.trim().length === 0;
});

const btnTipContent = computed(() => {
  if (props.status === 'loading') return t('main.message.stopGeneration');
  if (props.status === 'streaming') return t('main.message.stopGeneration');
  return t('main.message.send');
});

function handleSend() {
  if (props.status !== 'normal') return emit('stop');

  if (isBtnDisabled.value) return;
  emit('send', message.value);
}

async function handlePasteClipboard(e: MouseEvent) {
  e.preventDefault();
  const content = await navigator.clipboard.readText();
  if (message.value === content) return;
  message.value = content;
}

const removeShortcutListener = listenShortcut(SHORTCUT_KEYS.SEND_MESSAGE, () => {
  if (props.status === 'streaming') return;
  if (isBtnDisabled.value) return;
  if (!focused.value) return;
  handleSend();
});

watch(message, async () => {
  await nextTick();
  if (!inputRef.value) return;
  inputRef.value.style.height = 'auto';
  inputRef.value.style.height = `${inputRef.value.scrollHeight}px`;
}, { immediate: true });

watch(() => selectedProvider.value, (newVal) => emit('select', newVal));

onUnmounted(() => removeShortcutListener());

defineExpose({
  selectedProvider,
});
</script>

<template>
  <div class="composer">
    <div class="message-input" :class="{ focused }">
      <textarea ref="inputRef" class="input-area" rows="2" :value="message" :placeholder="placeholder" :aria-label="placeholder"
        @input="message = ($event.target as HTMLTextAreaElement).value" @contextmenu="handlePasteClipboard"
        @focus="focused = true" @blur="focused = false" />
      <div class="composer-toolbar">
        <div class="model-picker"><ProviderSelect v-model="selectedProvider" /></div>
        <button class="send-button" :class="{ generating: status !== 'normal' }" :disabled="isBtnDisabled" :title="btnTipContent" :aria-label="btnTipContent" @click="handleSend">
          <ArrowUp v-if="status === 'normal'" :size="19" :stroke-width="2" /><Square v-else :size="13" fill="currentColor" />
        </button>
      </div>
    </div>
    <div class="composer-hint"><span>{{ selectedProvider ? t('ui.composerHint') : t('ui.chooseModelHint') }}</span><span><kbd>{{ sendKey }}</kbd> {{ t('main.message.send') }}</span></div>
  </div>
</template>
<style scoped>
.composer { width: 100%; }
.message-input { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--composer-shadow); transition: border-color .15s, box-shadow .15s; overflow: hidden; }
.message-input.focused { border-color: color-mix(in srgb, var(--accent-ink) 45%, var(--line)); box-shadow: 0 0 0 3px var(--accent-soft), var(--composer-shadow); }
.input-area { display: block; min-height: 78px; max-height: min(220px, 28vh); width: 100%; padding: 17px 18px 10px; background: transparent; color: var(--text-primary); border: 0; resize: none; font-size: var(--message-font-size, 14px); line-height: 1.7; }
.input-area::placeholder { color: var(--text-tertiary); }
.input-area:focus { outline: none; }
.composer-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 3px 12px 12px; }
.model-picker { width: min(260px, 75%); }
.model-picker :deep(.n-base-selection) { --n-border: 1px solid transparent !important; --n-border-hover: 1px solid var(--line) !important; --n-color: transparent !important; --n-font-size: 12px !important; }
.send-button { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 10px; background: var(--text-primary); color: var(--surface); transition: opacity .15s, transform .15s; }
.send-button:not(:disabled):hover { opacity: .8; transform: translateY(-1px); }
.send-button:disabled { background: var(--input-bg); color: var(--text-tertiary); }
.send-button.generating { background: var(--accent-ink); color: var(--surface); }
.composer-hint { display: flex; justify-content: space-between; gap: 12px; margin: 9px 5px 0; font-size: 10px; color: var(--text-secondary); }
kbd { font: inherit; font-family: var(--font-mono); }
</style>
