<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import ContentWorkspace from '../features/content/ContentWorkspace.vue';
import { FixtureAgentPort } from '../platform/content/fixture-agent';
import { browserFiles } from '../platform/content/browser-files';
const auth = useAuthStore();
const workspace = computed(() => ({ scopeId: auth.userId ?? 'desktop-guest', port: new FixtureAgentPort() }));
</script>
<template><ContentWorkspace :key="workspace.scopeId" :files="browserFiles" :scope-id="workspace.scopeId" :port="workspace.port" /></template>
