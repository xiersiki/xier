import type { Conversation } from "@common/types";
import supabase from "./client";
import { logger } from "../utils/logger";
import { notify } from "@renderer/utils/notify";
// 云端的数据结构
interface ConversationRow {
  id: string;
  user_id: string;
  provider_id: string;
  title: string;
  selected_model: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  idempotentKey: string;
}

// 将数据库行映射为 Conversation 对象
const mapRowToConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  title: row.title,
  selectedModel: row.selected_model,
  providerId: row.provider_id,
  pinned: row.pinned,
  version: row.version,
  idempotentKey: row.idempotentKey,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  dirty: false,
});

// 将 Conversation 对象映射为数据库行
const mapConversationToRow = (
  userId: string,
  conversation: Partial<Conversation>
): Partial<ConversationRow> => {
  const row: Partial<ConversationRow> = {
    id: conversation.id,
    user_id: userId,
    title: conversation.title,
    selected_model: conversation.selectedModel,
    provider_id: conversation.providerId,
    pinned: conversation.pinned,
    version: conversation.version ?? 1,
    idempotentKey: conversation.idempotentKey,
  };

  // ✅ 如果是新建（有 createdAt），发送客户端时间
  // 这样离线创建的数据能保留原始创建时间
  if (conversation.createdAt) {
    row.created_at = new Date(conversation.createdAt).toISOString();
  }
  // 如果没有 createdAt，让数据库自动生成（不太可能发生）

  // ✅ 总是发送 updated_at，因为修改时间应该是客户端操作时间
  row.updated_at = conversation.updatedAt
    ? new Date(conversation.updatedAt).toISOString()
    : new Date().toISOString();

  return row;
};

export async function fetchConversations(
  userId: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      logger.error("[conversations] 拉取失败:", error);
      notify.error("从云端获取 conversations 失败");
      throw error;
    }
    return (data ?? []).map(mapRowToConversation);
  } catch (err) {
    logger.error("Error fetching conversations:", err);
    notify.error("从云端获取 conversations 失败");
    throw err;
  }
}

export async function upsertConversations(
  userId: string,
  conversations: Partial<Conversation>[]
): Promise<{ success: boolean; data: Conversation[]; skipped?: boolean }> {
  try {
    const payload = conversations.map((c) => mapConversationToRow(userId, c));

    const { data, error } = await supabase
      .from("conversations")
      .upsert(payload, {
        onConflict: "id",
      })
      .select();

    if (error) {
      // 如果是唯一约束冲突，说明已经处理过
      if (error.code === "23505") {
        logger.info("Duplicate idempotent key, skipping");
        notify.error("部分 conversations 已存在，跳过重复同步");
        return { success: true, data: [], skipped: true };
      }
      logger.error("[conversations] 同步失败:", error);
      notify.error("从云端同步 conversations 失败");
      return { success: false, data: [] };
    }

    return {
      success: true,
      data: (data ?? []).map(mapRowToConversation),
      skipped: false,
    };
  } catch (err) {
    logger.error("Error upserting conversations:", err);
    notify.error("从云端同步 conversations 失败");
    return { success: false, data: [] };
  }
}

export async function deleteConversation(
  id: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      logger.error("[conversations] 删除失败:", error);
      notify.error("从云端删除 conversations 失败");
      throw error;
    }
  } catch (err) {
    logger.error("Error deleting conversation:", err);
    notify.error("从云端删除 conversations 失败");
    throw err;
  }
}
