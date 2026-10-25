<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';
import { useFilter } from './useFilter';
const { searchKey } = useFilter();
const { t } = useI18n();
</script>
<template>
  <div class="search-field" @contextmenu.stop>
    <Search :size="15" :stroke-width="1.7" aria-hidden="true" />
    <input v-model="searchKey" type="search" :placeholder="t('main.conversation.searchPlaceholder')" :aria-label="t('main.conversation.searchPlaceholder')" />
    <button v-if="searchKey" class="icon-button" :aria-label="t('ui.clearSearch')" @click="searchKey = ''"><X :size="13" /></button>
  </div>
</template>
<style scoped>
.search-field { display: flex; align-items: center; gap: 8px; margin-top: 13px; padding: 5px 10px; height: 34px; color: var(--text-secondary); border: 1px solid transparent; border-radius: 7px; }
.search-field:focus-within { border-color: var(--line); background: var(--surface); }
input { width: 100%; min-width: 0; background: transparent; border: 0; outline: none; font-size: 12px; color: var(--text-primary); }
input::placeholder { color: var(--text-secondary); }
input::-webkit-search-cancel-button { display: none; }
.icon-button { width: 20px; height: 20px; }
</style>
