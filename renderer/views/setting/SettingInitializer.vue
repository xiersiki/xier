<script setup lang="ts">
import { useNotification } from 'naive-ui';
import { setNotificationInstance } from '@renderer/utils/notify';
import { useAuthStore } from '@renderer/stores/auth';
import { useProvidersStore } from '@renderer/stores/providers';

const notification = useNotification();
const authStore = useAuthStore();
const providersStore = useProvidersStore();

onMounted(async () => {
    // 设置通知实例
    setNotificationInstance(notification);

    // 初始化 auth store
    await authStore.initialize();

    // 初始化 providers store
    await providersStore.initialize();
});
</script>

<template>
    <slot />
</template>
