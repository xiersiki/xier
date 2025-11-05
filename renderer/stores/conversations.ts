import type { Conversation } from "@common/types";
import { defineStore } from "pinia";
import { debounce } from "@common/utils";
import { dataBase } from "../dataBase";
import { useAuthStore } from "./auth";
import { logger } from "@renderer/utils/logger";
import { notify } from "@renderer/utils/notify";

type SortBy = "updatedAt" | "createAt" | "name" | "model"; // 排序字段类型
type SortOrder = "asc" | "desc"; // 排序顺序类型

const SORT_BY_KEY = "conversation:sortBy";
const SORT_ORDER_KEY = "conversation:sortOrder";

const saveSortMode = debounce(
  ({ sortBy, sortOrder }: { sortBy: SortBy; sortOrder: SortOrder }) => {
    localStorage.setItem(SORT_BY_KEY, sortBy);
    localStorage.setItem(SORT_ORDER_KEY, sortOrder);
  },
  300
); // 300ms 防抖

/**
 * Conversations Store - 管理 conversations 数据的响应式状态
 */
export const useConversationsStore = defineStore("conversations", () => {
  // 状态
  const conversations = ref<Conversation[]>([]);

  const savedSortBy = localStorage.getItem(SORT_BY_KEY) as SortBy;
  const savedSortOrder = localStorage.getItem(SORT_ORDER_KEY) as SortOrder;

  const sortBy = ref<SortBy>(savedSortBy ?? "createAt"); // 默认按更新时间排序
  const sortOrder = ref<SortOrder>(savedSortOrder ?? "desc"); // 默认倒序排序

  const messagesInputValue = ref(new Map());

  // Getters
  // 按置顶状态和更新时间排序，置顶的对话排在前面，相同置顶状态的按更新时间倒序排列
  const allConversations = computed(() => conversations.value);

  const messageInputValueById = computed(
    () => (conversationId: string) =>
      messagesInputValue.value.get(conversationId) ?? ""
  );

  const sortMode = computed(() => ({
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  }));

  function setMessageInputValue(conversationId: string, value: string) {
    messagesInputValue.value.set(conversationId, value);
  }

  function setSortMode(_sortBy: SortBy, _sortOrder: SortOrder) {
    if (sortBy.value !== _sortBy) sortBy.value = _sortBy;
    if (sortOrder.value !== _sortOrder) sortOrder.value = _sortOrder;
  }
  /**
   * ✅ 统一的同步函数 - 扫描并同步所有脏数据
   */
  async function syncDirtyConversations() {
    const authStore = useAuthStore();
    const userId = authStore.userId;

    if (!userId) {
      logger.info("[conversations] 未登录，跳过同步");
      return { success: false };
    }

    try {
      const { upsertConversations } = await import(
        "../services/conversationRepo"
      );

      // 扫描本地所有的 dirty 数据
      const dirtyConversations = await dataBase.conversations
        .filter((c) => c.dirty === true)
        .toArray();

      if (dirtyConversations.length === 0) {
        logger.info("[conversations] 没有需要同步的数据");
        return { success: true };
      }

      logger.info(
        `[conversations] 正在同步 ${dirtyConversations.length} 条数据...`
      );
      notify.info(
        "同步中",
        `正在同步 ${dirtyConversations.length} 条对话到云端...`
      );

      const res = await upsertConversations(userId, dirtyConversations);

      if (res.success && !res.skipped) {
        // 同步成功，清除 dirty 标记
        await Promise.all(
          res.data.map((c) =>
            dataBase.conversations.update(c.id, { dirty: false })
          )
        );

        // 更新内存中的数据
        conversations.value = conversations.value.map((item) => {
          const synced = res.data.find((c) => c.id === item.id);
          return synced ? { ...synced, dirty: false } : item;
        });

        notify.success("同步成功", `已同步 ${res.data.length} 条对话到云端`);
        return { success: true };
      } else if (res.skipped) {
        notify.info("数据已存在", "部分对话已存在，跳过同步");
        return { success: true };
      }

      notify.error("同步失败", "数据已保存到本地");
      return { success: false };
    } catch (err) {
      logger.error("[conversations] 同步失败:", err);
      notify.error("同步失败", "数据已保存到本地");
      return { success: false };
    }
  }
  /**
   * ✅ 防抖的同步函数 - 避免频繁调用
   */
  const debouncedSync = debounce(syncDirtyConversations, 1000);

  /**
   * ✅ 初始化函数 - 加载对话数据
   */
  async function initialize() {
    const authStore = useAuthStore();
    const userId = authStore.userId;
    conversations.value = await dataBase.conversations.toArray();
    // 清除无用 message
    const ids = conversations.value.map((item) => item.id);
    const msgs = await dataBase.messages.toArray();
    const invalidIds = msgs
      .filter((item) => !ids.includes(item.conversationId))
      .map((item) => item.id);
    invalidIds.length &&
      dataBase.messages.where("id").anyOf(invalidIds).delete();

    if (userId) {
      try {
        const { fetchConversations } = await import(
          "../services/conversationRepo"
        );
        notify.info("同步中", "正在从云端获取 conversations...");
        const remoteConversations = await fetchConversations(userId);
        if (remoteConversations.length > 0) {
          // 合并本地和远程数据，远程数据优先
          const localOnly = conversations.value.filter(
            (local) =>
              !remoteConversations.some((remote) => remote.id === local.id)
          );
          const merged = [...remoteConversations, ...localOnly];
          conversations.value = merged;
          // 更新本地数据库（确保写入的是普通对象，避免 Proxy 导致的 DataCloneError）
          const mergedPlain = merged.map((c) => ({ ...c }));
          await dataBase.conversations.clear();
          await dataBase.conversations.bulkPut(mergedPlain);
          notify.success(
            "同步成功",
            `已从云端获取 ${remoteConversations.length} 条 conversations`
          );
        } else {
          notify.info("无新数据", "云端无 conversations 数据");
        }
      } catch (err) {
        notify.error("同步失败", "从云端获取 conversations 失败");
      }
    }
    // ✅ 初始化时同步脏数据
    await syncDirtyConversations();
  }

  function getConversationById(id: string) {
    return conversations.value.find((c) => c.id === id) as Conversation | void;
  }
  /**
   *
   * @param conversation
   * @returns
   */
  async function addConversation(conversation: Omit<Conversation, "id">) {
    const { v4: uuid } = await import("uuid");

    // 确保新对话有pinned字段，默认为false
    const conversationWithPin: Conversation = {
      ...conversation,
      id: uuid(), // 生成 UUID
      pinned: conversation.pinned ?? false,
    };

    await dataBase.conversations.add(conversationWithPin);
    conversations.value.push(conversationWithPin);

    // ✅ 新建对话时立即同步到云端（不防抖）
    // 这样可以避免用户快速发送消息时的外键约束错误
    const authStore = useAuthStore();
    if (authStore.userId) {
      await syncDirtyConversations(); // 立即同步
    }

    return conversationWithPin.id;
  }

  async function delConversation(id: string) {
    await dataBase.messages.where("conversationId").equals(id).delete(); // 删除关联的消息
    await dataBase.conversations.delete(id);
    conversations.value = conversations.value.filter(
      (conversation) => conversation.id !== id
    );
    // 2. 如果已登录，同步删除到云端
    const authStore = useAuthStore();
    const userId = authStore.userId;
    if (userId) {
      try {
        const { deleteConversation } = await import(
          "../services/conversationRepo"
        );
        await deleteConversation(id, userId);
        notify.success("删除成功", "对话已从云端删除");
      } catch (err) {
        logger.error("[conversations] 删除云端数据失败:", err);
        notify.warning("删除成功", "本地已删除，但云端删除失败");
      }
    }
  }

  async function updateConversation(
    conversation: Conversation,
    updateTime: boolean = true
  ) {
    const _newConversation = {
      ...conversation,
      updatedAt: updateTime ? Date.now() : conversation.updatedAt, // 更新为时间戳
    };
    await dataBase.conversations.update(conversation.id, _newConversation);
    conversations.value = conversations.value.map((item) =>
      item.id === conversation.id ? _newConversation : item
    );
    // 2. 触发同步（防抖）
    debouncedSync();
  }

  /**
   * 将对话置顶
   * @param id 对话ID
   */
  async function pinConversation(id: string) {
    const conversation = conversations.value.find((c) => c.id === id);
    if (conversation) {
      await updateConversation(
        {
          ...conversation,
          pinned: true,
        },
        false
      );
    }
  }

  /**
   * 取消对话置顶
   * @param id 对话ID
   */
  async function unpinConversation(id: string) {
    const conversation = conversations.value.find((c) => c.id === id);
    if (conversation) {
      await updateConversation(
        {
          ...conversation,
          pinned: false,
        },
        false
      );
    }
  }

  watch([() => sortBy.value, () => sortOrder.value], () =>
    saveSortMode({ sortBy: sortBy.value, sortOrder: sortOrder.value })
  );

  // 返回状态、计算属性和方法
  return {
    // 状态
    conversations,
    sortBy,
    sortOrder,
    // 计算属性
    allConversations,
    messageInputValueById,
    sortMode,
    // 方法
    initialize,
    setMessageInputValue,
    getConversationById,
    addConversation,
    delConversation,
    updateConversation,
    pinConversation,
    unpinConversation,
    setSortMode,
  };
});
