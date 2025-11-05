import type { Message, MessageStatus } from "@common/types";
import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { dataBase } from "../dataBase";
import { listenDialogueBack } from "../utils/dialogue";
import { useConversationsStore } from "./conversations";
import { useProvidersStore } from "./providers";
import { cloneDeep, debounce, uniqueByKey } from "@common/utils";
import i18n from "../i18n";
import { useAuthStore } from "./auth";
import { v4 as uuid } from "uuid";
import { deleteRemoteMessage } from "../services/messageRepo";

const msgContentMap = new Map<string, string>();
export const stopMethods = new Map<string, () => void>();

/**
 * Messages Store - 管理 messages 数据的响应式状态
 */
export const useMessagesStore = defineStore("messages", () => {
  const conversationsStore = useConversationsStore();
  const providersStore = useProvidersStore();
  // 状态
  const messages = ref<Message[]>([]);

  // Getters
  const allMessages = computed(() => messages.value);

  const messagesByConversationId = computed(() => {
    return (conversationId: string) => {
      return messages.value
        .filter((message) => message.conversationId === conversationId)
        .sort((a, b) => a.createdAt - b.createdAt);
    };
  });

  const loadingMsgIdsByConversationId = computed(() => {
    return (conversationId: string) => {
      return messagesByConversationId
        .value(conversationId)
        .filter(
          (message) =>
            message.status === "loading" || message.status === "streaming"
        )
        .map((message) => message.id);
    };
  });

  // Actions
  /**
   * 初始化 messages 数据
   * @param conversationId 指定要加载的对话 ID
   */
  async function initialize(conversationId: string) {
    const authStore = useAuthStore();
    const userId = authStore.userId;

    if (!conversationId) return;

    const isConversationLoaded = messages.value.some(
      (message) => message.conversationId === conversationId
    );

    if (isConversationLoaded) return;

    // 1️⃣ 先加载本地消息
    const localMessages = await dataBase.messages
      .where({ conversationId })
      .toArray();

    // 2️⃣ 如果已登录，从云端拉取数据
    if (userId) {
      try {
        const { fetchMessages } = await import("../services/messageRepo");
        const remoteMessages = await fetchMessages(userId, conversationId);

        if (remoteMessages.length > 0) {
          // 3️⃣ 智能合并：云端数据 + 本地独有数据（dirty 的）
          const localOnlyMessages = localMessages.filter(
            (local) =>
              local.dirty &&
              !remoteMessages.some((remote) => remote.id === local.id)
          );

          const merged = [...remoteMessages, ...localOnlyMessages];

          // 4️⃣ 更新本地数据库（使用 bulkPut 自动去重）
          await dataBase.messages.bulkPut(merged);

          // 5️⃣ 更新内存
          messages.value = uniqueByKey([...messages.value, ...merged], "id");

          console.log(
            `✅ [messages] 已从云端获取 ${remoteMessages.length} 条，本地独有 ${localOnlyMessages.length} 条`
          );
        } else {
          // 云端无数据，使用本地
          messages.value = uniqueByKey(
            [...messages.value, ...localMessages],
            "id"
          );
        }
      } catch (err) {
        console.error("[messages] 从云端拉取失败，使用本地数据:", err);
        messages.value = uniqueByKey(
          [...messages.value, ...localMessages],
          "id"
        );
      }
    } else {
      // 未登录，只使用本地数据
      messages.value = uniqueByKey([...messages.value, ...localMessages], "id");
    }

    // 6️⃣ 初始化完成后，同步脏数据（防抖）
    if (userId) {
      syncDirtyMessages();
    }
  }

  /**
   * 更新对话的 updatedAt 字段
   */
  const _updateConversation = async (conversationId: string) => {
    const conversation = await dataBase.conversations.get(conversationId);
    conversation && conversationsStore.updateConversation(conversation);
  };

  /**
   * 添加新的 message
   */
  async function addMessage(message: Omit<Message, "id" | "createdAt">) {
    const newMessage: Message = {
      ...message,
      id: uuid(), // 生成 UUID（使用顶部已导入的 uuid）
      createdAt: Date.now(), // 添加当前时间戳
    };

    await dataBase.messages.add(newMessage);
    _updateConversation(newMessage.conversationId);
    messages.value.push(newMessage); // 将新消息添加到响应式数组中
    return newMessage.id;
  }

  async function sendMessage(
    message: Omit<Message, "id" | "createdAt" | "dirty">
  ) {
    const authStore = useAuthStore();
    const userId = authStore.userId;
    const questionId = await addMessage({
      ...message,
      dirty: true, // ✅ 标记为需要同步
    });
    // 如果已登录，立即同步用户问题
    if (userId) {
      const questionMsg = await dataBase.messages.get(questionId);
      if (questionMsg) {
        syncMessageToCloud(questionMsg);
      }
    }
    const loadingMsgId = await addMessage({
      conversationId: message.conversationId,
      type: "answer",
      content: "",
      status: "loading",
      dirty: false,
    });
    // message
    const conversation = conversationsStore.getConversationById(
      message.conversationId
    );
    if (!conversation) return loadingMsgId;

    const provider = providersStore.allProviders.find(
      (p) => p.id === conversation.providerId
    );

    if (!provider) return loadingMsgId;

    msgContentMap.set(loadingMsgId, "");
    let streamCallback:
      | ((stream: DialogueBackStream) => Promise<void>)
      | void = async (stream) => {
      const { messageId, data } = stream;
      const getStatus = (data: DialogueBackStream["data"]): MessageStatus => {
        if (data.isError) return "error";
        if (data.isEnd) return "success";
        return "streaming";
      };
      msgContentMap.set(messageId, msgContentMap.get(messageId) + data.result);

      const _update = {
        content: msgContentMap.get(messageId) || "",
        status: getStatus(data),
        updatedAt: Date.now(),
        // ⚠️ 流式输出时不标记 dirty（避免频繁同步）
        dirty: false,
      } as Message;
      await nextTick();
      updateMessage(messageId, _update);
      if (data.isEnd) {
        msgContentMap.delete(messageId);
        streamCallback = void 0;
        if (userId) {
          await dataBase.messages.update(messageId, { dirty: true });
          syncDirtyMessages();
        }
      }
    };
    stopMethods.set(
      loadingMsgId,
      listenDialogueBack(streamCallback, loadingMsgId)
    );
    const messages = messagesByConversationId
      .value(message.conversationId)
      .filter((item) => item.status !== "loading")
      .map((item) => ({
        role:
          item.type === "question"
            ? "user"
            : ("assistant" as DialogueMessageRole),
        content: item.content,
      }));
    await window.api.startADialogue({
      messageId: loadingMsgId,
      providerName: provider.name,
      selectedModel: conversation.selectedModel,
      conversationId: message.conversationId,
      messages,
    });

    return loadingMsgId;
  }
  /**
   * 云同步函数
   */
  async function syncMessageToCloud(msg: Message) {
    const authStore = useAuthStore();
    const userId = authStore.userId;

    if (!userId) return;

    try {
      // ✅ 1. 先确保对话已同步到云端（防止外键约束错误）
      const conversation = await dataBase.conversations.get(msg.conversationId);
      if (conversation?.dirty) {
        console.log(`⚠️ 对话 ${msg.conversationId} 尚未同步，先同步对话...`);
        const { upsertConversations } = await import(
          "../services/conversationRepo"
        );
        const result = await upsertConversations(userId, [conversation]);
        if (result.success) {
          await dataBase.conversations.update(conversation.id, {
            dirty: false,
          });
          console.log(`✅ 对话 ${msg.conversationId} 同步成功`);
        } else {
          console.error(`❌ 对话同步失败，取消消息同步`);
          return; // 对话同步失败，不同步消息
        }
      }

      // ✅ 2. 再同步消息
      const { upsertMessages } = await import("../services/messageRepo");
      const { dirty, status, ...syncData } = msg;

      const result = await upsertMessages(userId, [syncData]);
      if (result.success) {
        await dataBase.messages.update(msg.id, { dirty: false });
        console.log(`✅ 消息 ${msg.id} 同步成功`);
      }
    } catch (err) {
      console.error("Message sync failed:", err);
    }
  }
  /**
   * 批量同步所有 dirty 消息（防抖）
   * 最小侵入方案：按 conversationId 分组；若会话仍为 dirty，先同步会话，再同步该组消息
   */
  const syncDirtyMessages = debounce(async () => {
    const authStore = useAuthStore();
    const userId = authStore.userId;

    if (!userId) return;

    const dirtyMessages = await dataBase.messages
      .filter((m) => m.dirty === true)
      .toArray();

    if (dirtyMessages.length === 0) return;

    // 按会话分组
    const groups = dirtyMessages.reduce(
      (acc, msg) => {
        (acc[msg.conversationId] ||= []).push(msg);
        return acc;
      },
      {} as Record<string, Message[]>
    );

    for (const [conversationId, msgs] of Object.entries(groups)) {
      try {
        // 1) 确保会话已在云端存在
        const conversation = await dataBase.conversations.get(conversationId);
        if (!conversation) {
          console.warn(
            `[messages] 未找到会话 ${conversationId}，跳过该组消息同步`
          );
          continue;
        }

        if (conversation.dirty) {
          const { upsertConversations } = await import(
            "../services/conversationRepo"
          );
          const convRes = await upsertConversations(userId, [conversation]);
          if (convRes.success) {
            await dataBase.conversations.update(conversationId, {
              dirty: false,
            });
          } else {
            console.error(
              `[messages] 会话 ${conversationId} 同步失败，跳过该组消息`
            );
            continue; // 会话不同步成功则跳过该组
          }
        }

        // 2) 同步该会话的消息组
        const { upsertMessages } = await import("../services/messageRepo");
        const msgRes = await upsertMessages(userId, msgs);
        if (msgRes.success) {
          const ids = (
            msgRes.data && msgRes.data.length > 0 ? msgRes.data : msgs
          ).map((m) => m.id);
          await Promise.all(
            ids.map((id) => dataBase.messages.update(id, { dirty: false }))
          );
        }
      } catch (err) {
        console.error(`[messages] 同步会话 ${conversationId} 的消息失败:`, err);
      }
    }
  }, 3000);
  async function stopMessage(id: string, update: boolean = true) {
    const stop = stopMethods.get(id);
    stop?.();
    if (update) {
      const msgContent = messages.value.find((item) => item.id === id)?.content;
      await updateMessage(id, {
        status: "success",
        updatedAt: Date.now(),
        content: msgContent
          ? msgContent + i18n.global.t("main.message.stoppedGeneration")
          : void 0,
      });
    }
    stopMethods.delete(id);
  }

  async function updateMessage(id: string, updates: Partial<Message>) {
    let currentMsg = cloneDeep(messages.value.find((item) => item.id === id));
    await dataBase.messages.update(id, { ...currentMsg, ...updates });

    messages.value = messages.value.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
  }
  /**
   * 删除 message
   */
  async function deleteMessage(id: string) {
    let currentMsg = cloneDeep(messages.value.find((item) => item.id === id));
    stopMessage(id, false);
    await dataBase.messages.delete(id);
    currentMsg && _updateConversation(currentMsg.conversationId);
    // 从响应式数组中移除
    messages.value = messages.value.filter((message) => message.id !== id);
    currentMsg = void 0;
    const authStore = useAuthStore();
    const userId = authStore.userId;
    if (userId) {
      deleteRemoteMessage(id, userId);
    }
  }

  // 返回状态、计算属性和方法
  return {
    // 状态
    messages,

    // 计算属性
    allMessages,
    messagesByConversationId,
    loadingMsgIdsByConversationId,

    // 方法
    initialize,
    addMessage,
    deleteMessage,
    sendMessage,
    stopMessage,
  };
});
