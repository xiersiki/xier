import type { Message, MessageStatus } from "@common/types";
import supabase from "./client";
import { logger } from "../utils/logger";
import { notify } from "@renderer/utils/notify";

// 云端的数据结构
interface MessageRow {
  id: string;
  user_id: string;
  conversation_id: string;
  content: string;
  type: "question" | "answer";
  created_at: string;
  updated_at: string;
  status: MessageStatus;
}

// 将数据库行映射为 Message 对象
const mapRowToMessage = (row: MessageRow): Message => ({
  id: row.id,
  content: row.content,
  type: row.type,
  conversationId: row.conversation_id,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  dirty: false,
});

// 将 Message 对象映射为数据库行
const mapMessageToRow = (
  userId: string,
  message: Partial<Message>
): Partial<MessageRow> => {
  const row: Partial<MessageRow> = {
    id: message.id,
    user_id: userId,
    conversation_id: message.conversationId,
    content: message.content,
    type: message.type,
  };

  // ✅ 如果是新建（有 createdAt），发送客户端时间
  // 这样离线创建的数据能保留原始创建时间
  if (message.createdAt) {
    row.created_at = new Date(message.createdAt).toISOString();
  }
  // 如果没有 createdAt，让数据库自动生成（不太可能发生）

  // ✅ 总是发送 updated_at，因为修改时间应该是客户端操作时间
  row.updated_at = message.updatedAt
    ? new Date(message.updatedAt).toISOString()
    : new Date().toISOString();

  return row;
};

export async function fetchMessages(
  userId: string,
  conversationId: string
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("[messages] 拉取失败:", error);
      notify.error("从云端获取 messages 失败");
      throw error;
    }
    return (data ?? []).map(mapRowToMessage);
  } catch (err) {
    logger.error("Error fetching messages:", err);
    notify.error("从云端获取 messages 失败");
    throw err;
  }
}

export async function upsertMessages(
  userId: string,
  messages: Partial<Message>[]
): Promise<{ success: boolean; data: Message[]; skipped?: boolean }> {
  try {
    const payload = messages.map((m) => mapMessageToRow(userId, m));

    const { data, error } = await supabase
      .from("messages")
      .upsert(payload, {
        onConflict: "id",
      })
      .select();

    if (error) {
      // 如果是唯一约束冲突，说明已经处理过
      if (error.code === "23505") {
        logger.info("Duplicate idempotent key, skipping");
        notify.error("部分 messages 已存在，跳过重复同步");
        return { success: true, data: [], skipped: true };
      }
      logger.error("[messages] 同步失败:", error);
      notify.error("从云端同步 messages 失败");
      return { success: false, data: [] };
    }

    return {
      success: true,
      data: (data ?? []).map(mapRowToMessage),
      skipped: false,
    };
  } catch (err) {
    logger.error("Error upserting messages:", err);
    notify.error("从云端同步 messages 失败");
    return { success: false, data: [] };
  }
}

export async function deleteRemoteMessage(id: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      logger.error("[messages] 删除失败:", error);
      notify.error("从云端删除 messages 失败");
      throw error;
    }
  } catch (err) {
    logger.error("Error deleting message:", err);
    notify.error("从云端删除 messages 失败");
    throw err;
  }
}

export async function deleteMessagesByConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    if (error) {
      logger.error("[messages] 批量删除失败:", error);
      notify.error("从云端批量删除 messages 失败");
      throw error;
    }
  } catch (err) {
    logger.error("Error deleting messages by conversation:", err);
    notify.error("从云端批量删除 messages 失败");
    throw err;
  }
}
