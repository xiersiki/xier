<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type EditorState, type Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
const props = defineProps<{ state: EditorState }>();
const emit = defineEmits<{ transaction: [value: Transaction] }>();
const host = ref<HTMLDivElement>();
let view: EditorView | undefined;
onMounted(() => {
  view = new EditorView({ parent: host.value, state: props.state, dispatch: transaction => {
    view!.update([transaction]); emit('transaction', transaction);
  } });
});
watch(() => props.state, state => { if (view && view.state !== state) view.setState(state); });
onBeforeUnmount(() => view?.destroy());
</script>
<template><div ref="host" class="content-editor" /></template>
<style scoped>
.content-editor { height: 100%; min-height: 240px; overflow: hidden; }
</style>
