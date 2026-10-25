<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotification } from 'naive-ui';
import { setNotificationInstance } from '@renderer/utils/notify';
import { useAuthStore } from '@renderer/stores/auth';
const notification = useNotification();
const auth = useAuthStore();
onMounted(async () => {
  setNotificationInstance(notification);
  await auth.initialize({ recoverMessages: false });
});
</script>
<template><slot /></template>
