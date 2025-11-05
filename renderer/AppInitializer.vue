<!-- filepath: d:\code\github\app\renderer\components\AppInitializer.vue -->
<script setup lang="ts">
import { useNotification } from 'naive-ui';
import { setNotificationInstance } from '@renderer/utils/notify';
import { useAuthStore } from '@renderer/stores/auth';
import { useConversationsStore } from '@renderer/stores/conversations';
import { useProvidersStore } from '@renderer/stores/providers';
import { initProviders } from '@renderer/dataBase';

const notification = useNotification();

const { initialize: initializeConversationsStore } = useConversationsStore();
const { initialize: initializeProvidersStore } = useProvidersStore();

onMounted(async () => {
    try {
        // 1️⃣ 设置全局通知实例
        setNotificationInstance(notification);

        // 2️⃣ 初始化认证状态（恢复已有会话）
        const authStore = useAuthStore();
        await authStore.initialize();

        // 3️⃣ 初始化默认 Providers（本地数据）
        await initProviders();

        // 4️⃣ 加载本地 Providers 到 store
        await initializeProvidersStore();

        // 5️⃣ 初始化 Conversations（包含云端同步）
        await initializeConversationsStore();

        // ✅ 注意：Messages 的初始化会在用户点击对话时才触发
    } catch (err) {
        console.error('应用初始化失败', err);
    }
});
</script>

<template>
    <slot />
</template>