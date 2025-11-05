import type { Provider } from "@common/types";
import { stringifyOpenAISetting } from "@common/utils";
import supabase from "./client";
import { logger } from "../utils/logger";

interface ProviderRow {
  id: string;
  user_id: string;
  name: string;
  title: string | null;
  models: string | null;
  openAISetting: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  idempotentKey: string;
  visible: boolean;
}

// 将数据库行映射为 Provider 对象
const mapRowToProvider = (row: ProviderRow): Provider => ({
  id: row.id,
  name: row.name,
  title: row.title ?? undefined,
  models: row.models ? JSON.parse(row.models) : [],
  openAISetting: row.openAISetting ?? undefined,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  version: row.version,
  idempotentKey: row.idempotentKey,
  visible: row.visible,
});

const mapProviderToRow = (userId: string, provider: Partial<Provider>) => ({
  ...(provider.id ? { id: provider.id } : {}),
  user_id: userId,
  name: provider.name ?? "",
  title: provider.title ?? null,
  models: JSON.stringify(provider.models ?? []),
  openAISetting: provider.openAISetting ?? null,
  version: provider.version ?? 1,
  idempotentKey: provider.idempotentKey ?? null,
  visible: provider.visible ?? false,
});

export async function fetchProviders(userId: string): Promise<Provider[]> {
  try {
    const { data, error } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map(mapRowToProvider);
  } catch (err) {
    logger.error("Error fetching providers:", err);
    throw err;
  }
}

export async function upsertProviders(
  userId: string,
  providers: Partial<Provider>[]
) {
  try {
    const payload = providers.map((p) => mapProviderToRow(userId, p));
    const { data, error } = await supabase
      .from("providers")
      .upsert(payload)
      .select();
    if (error) {
      // 如果是唯一约束冲突，说明已经处理过
      if (error.code === "23505") {
        logger.info("Duplicate idempotent key, skipping");
        return [];
      }
      logger.error("[providers] 同步失败:", error);
      throw error;
    }
    return (data ?? []).map(mapRowToProvider);
  } catch (err) {
    logger.error("Error upserting provider:", err);
    throw err;
  }
}

export async function deleteProvider(
  id: number,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("providers")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      throw error;
    }
  } catch (err) {
    logger.error("Error deleting provider:", err);
    throw err;
  }
}
