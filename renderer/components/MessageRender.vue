<script setup lang="ts">
import VueMarkdown from 'vue-markdown-render';
import markdownItHighlightjs from 'markdown-it-highlightjs';

defineOptions({ name: 'MessageRender' })
const props = defineProps<{
  msgId: string;
  content: string;
  isStreaming: boolean;
}>()

const { t } = useI18n();

const renderId = computed(() => `msg-render-${props.msgId}`);

const _findLastElement = (target: HTMLElement): Element | void => {
  const isList = (el: Element) => el.tagName === 'OL' || el.tagName === 'UL';

  if (!target) return
  let lastElement: Element | void = target.lastElementChild ?? target;
  if (lastElement && lastElement.tagName === 'PRE')
    lastElement = lastElement.getElementsByClassName('hljs')[0] ?? lastElement
  if (lastElement && isList(lastElement))
    lastElement = _findLastElement(lastElement as HTMLElement)

  if (lastElement && lastElement.tagName === 'LI') {
    const _uls = lastElement.getElementsByTagName('ul');
    const _ols = lastElement.getElementsByTagName('ol');
    if (_uls.length) lastElement = _findLastElement(_uls[0]);
    if (_ols.length) lastElement = _findLastElement(_ols[0]);
  }

  return lastElement;
}

function addCursor(target: HTMLElement) {
  const lastEl = _findLastElement(target);
  if (!lastEl) return
  lastEl?.classList.add('_cursor');
}

async function handleCursor() {
  if (props.isStreaming) {
    await nextTick();
    const target = document.getElementById(renderId.value);
    if (!target) return;
    addCursor(target);
  }
}

function removeCursor() {
  const target = document.getElementById(renderId.value);
  if (!target) return;
  const lastEl = _findLastElement(target);
  lastEl?.classList.remove('_cursor');
}

watch(() => props.content, () => handleCursor());

watch(() => props.isStreaming, async (newVal, oldVal) => {
  if (!newVal && oldVal) {
    await nextTick();
    removeCursor();
  }
});
</script>

<template>
  <template v-if="content?.trim()?.length">
    <VueMarkdown :id="renderId"
      class="prose text-inherit" :source="content"
      :plugins="[markdownItHighlightjs]" />
  </template>
  <span class="_cursor" v-else>{{ t('main.message.rendering') }}</span>
</template>

<style scoped>
.prose { font-size: inherit; color: inherit; line-height: 1.85; max-width: none; overflow-wrap: anywhere; --tw-prose-body: var(--text-primary); --tw-prose-headings: var(--text-primary); --tw-prose-bold: var(--text-primary); --tw-prose-links: var(--accent-ink); --tw-prose-code: var(--text-primary); --tw-prose-quotes: var(--text-secondary); --tw-prose-counters: var(--text-secondary); --tw-prose-bullets: var(--text-tertiary); }
.prose :deep(> :first-child) { margin-top: 0; }
.prose :deep(> :last-child) { margin-bottom: 0; }
.prose :deep(p) { margin-block: .8em; }
.prose :deep(h1) { font-size: 1.6em; font-weight: 600; line-height: 1.45; margin: 1.5em 0 .65em; letter-spacing: -.02em; }
.prose :deep(h2) { font-size: 1.3em; font-weight: 600; line-height: 1.5; margin: 1.7em 0 .65em; }
.prose :deep(h3) { font-size: 1.1em; font-weight: 600; margin: 1.4em 0 .5em; }
.prose :deep(strong) { font-weight: 600; }
.prose :deep(hr) { border-color: var(--line); margin-block: 1.7em; }
.prose :deep(pre) { max-width: 100%; padding: 0; margin: 1em 0; border: 1px solid var(--line); border-radius: 9px; background: var(--bg-color); }
.prose :deep(pre code) { font-family: var(--font-mono); font-size: .85em; line-height: 1.7; background: transparent; padding: 16px 18px; }
.prose :deep(:not(pre) > code) { background: var(--input-bg); padding: .15em .35em; border-radius: 4px; font-family: var(--font-mono); font-size: .88em; font-weight: 400; }
.prose :deep(code::before), .prose :deep(code::after) { content: none; }
.prose :deep(table) { display: block; overflow-x: auto; width: 100%; font-size: .9em; margin-block: 1.2em; }
.prose :deep(th), .prose :deep(td) { padding: 9px 12px; border-bottom: 1px solid var(--line); }
.prose :deep(th) { font-weight: 500; color: var(--text-secondary); background: var(--bg-color); }
.prose :deep(blockquote) { color: var(--text-secondary); border-left: 2px solid var(--accent-ink); font-style: normal; font-weight: 400; padding-left: 1em; }
.prose :deep(blockquote p::before), .prose :deep(blockquote p::after) { content: none; }
.prose :deep(a) { text-underline-offset: 3px; }
</style>

<style>
/* 打字机光标效果 - 通过CSS伪元素实现 */
._cursor::after {
  content: '';
  display: inline-block;
  width: 0.3em;
  height: 1em;
  transform: translateX(0.2em);
  background-color: currentColor;
  animation: cursor-blink 1s infinite;
  margin-left: 2px;
  vertical-align: text-bottom;
  line-height: 1;
}

@keyframes cursor-blink {

  0%,
  49% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0;
  }
}
</style>
