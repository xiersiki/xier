import { fetchAllRows } from './pagination';
import type { Provider } from "@common/types";
import { ensureModelsArray } from "@common/dataHelpers";
import { getUserClient } from "./client";
import { logger } from "../utils/logger";

interface ProviderRow {
  id: string;
  user_id: string;
  name: string;
  title: string | null;
  models: string[] | string | null;
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
  models: ensureModelsArray(row.models),
  openAISetting: row.openAISetting ?? undefined,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
  version: row.version,
  idempotentKey: row.idempotentKey,
  visible: row.visible,
  dirty: false,
});

const mapProviderToRow = (userId: string, provider: Partial<Provider>) => ({
  ...(provider.id ? { id: provider.id } : {}),
  user_id: userId,
  name: provider.name ?? "",
  title: provider.title ?? null,
  models: provider.models ?? [],
  openAISetting: provider.openAISetting ?? null,
  version: provider.version ?? 1,
  idempotentKey: provider.idempotentKey ?? null,
  visible: provider.visible ?? false,
  created_at: provider.createdAt ? new Date(provider.createdAt).toISOString() : undefined,
  updated_at: new Date(provider.updatedAt ?? Date.now()).toISOString(),
});

export async function fetchProviders(userId: string): Promise<Provider[]> {
  const client = await getUserClient(userId);
  const rows = await fetchAllRows<ProviderRow>((from, to) => {
    const query = client.from('providers').select('*').eq('user_id', userId);
    return query.order('created_at', { ascending: true }).order('id').range(from, to);
  });
  return rows.map(mapRowToProvider);
}

export async function upsertProviders(
  userId: string,
  providers: Partial<Provider>[]
) {
  try {
    const payload = providers.map((p) => mapProviderToRow(userId, p));
    const { data, error } = await (await getUserClient(userId))
      .from("providers")
      .upsert(payload)
      .select();
    if (error) {
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
  id: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await (await getUserClient(userId))
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
