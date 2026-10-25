<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotification } from 'naive-ui';
import { setNotificationInstance } from './utils/notify';
import { useAuthStore } from './stores/auth';
const notification = useNotification();
const auth = useAuthStore();
onMounted(async () => {
  setNotificationInstance(notification);
  await auth.initialize();
});
</script>
<template><slot /></template>
