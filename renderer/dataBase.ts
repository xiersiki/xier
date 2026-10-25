import type { Provider, Conversation, Message } from "@common/types";
import { stringifyOpenAISetting } from "@common/utils";
import { logger } from "./utils/logger";
import Dexie, { type Table } from "dexie";
import { v4 as uuid } from "uuid";

// 使用固定 UUID，避免每次重启生成新 ID
const DEFAULT_PROVIDER_IDS = {
  bigmodel: "550e8400-e29b-41d4-a716-446655440001",
  deepseek: "550e8400-e29b-41d4-a716-446655440002",
  siliconflow: "550e8400-e29b-41d4-a716-446655440003",
  qianfan: "550e8400-e29b-41d4-a716-446655440004",
};

export const providers: Provider[] = [
  {
    id: DEFAULT_PROVIDER_IDS.bigmodel,
    name: "bigmodel",
    title: "智谱AI",
    models: ["glm-4.5-flash"],
    openAISetting: stringifyOpenAISetting({
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      apiKey: "",
    }),
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    version: 1,
    idempotentKey: uuid(),
    dirty: false, // 默认数据不需要同步
  },
  {
    id: DEFAULT_PROVIDER_IDS.deepseek,
    name: "deepseek",
    title: "深度求索 (DeepSeek)",
    models: ["deepseek-flash", "deepseek-v4-pro"],
    openAISetting: stringifyOpenAISetting({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: "",
    }),
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    version: 1,
    idempotentKey: uuid(),
    dirty: false,
  },
  {
    id: DEFAULT_PROVIDER_IDS.siliconflow,
    name: "siliconflow",
    title: "硅基流动",
    models: ["Qwen/Qwen3-8B", "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B"],
    openAISetting: stringifyOpenAISetting({
      baseURL: "https://api.siliconflow.cn/v1",
      apiKey: "",
    }),
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    version: 1,
    idempotentKey: uuid(),
    dirty: false,
  },
  {
    id: DEFAULT_PROVIDER_IDS.qianfan,
    name: "qianfan",
    title: "百度千帆",
    models: ["ernie-speed-128k", "ernie-4.0-8k", "ernie-3.5-8k"],
    openAISetting: stringifyOpenAISetting({
      baseURL: "https://qianfan.baidubce.com/v2",
      apiKey: "",
    }),
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    version: 1,
    idempotentKey: uuid(),
    dirty: false,
  },
];

export interface PendingDeletion { id: string; table: 'conversations' | 'messages' }
export type XierDatabase = Dexie & {
  providers: Table<Provider, string>;
  conversations: Table<Conversation, string>;
  messages: Table<Message, string>;
  deletions: Table<PendingDeletion, string>;
};
function createDatabase(name: string): XierDatabase {
  const db = new Dexie(name) as XierDatabase;
  db.version(5).stores({ providers: 'id,name', conversations: 'id,providerId,pinned', messages: 'id,conversationId' });
  db.version(6).stores({ providers: 'id,name', conversations: 'id,providerId,pinned', messages: 'id,conversationId', deletions: 'id,table' });
  return db;
}
const databases = new Map<string, XierDatabase>();
export let dataBase = createDatabase('xier');
databases.set('xier', dataBase);
export function getGuestDatabase() { return databases.get('xier')!; }
export function selectAccountDatabase(userId: string | null) {
  const name = userId ? `xier-user-${userId}` : 'xier';
  if (!databases.has(name)) databases.set(name, createDatabase(name));
  dataBase = databases.get(name)!;
}

export async function initProviders(db = dataBase) {
  const existing = await db.providers.toArray();
  const missing = providers.filter(p => !existing.some(local => local.name === p.name));
  if (missing.length) {
    await db.providers.bulkPut(missing.map(p => ({ ...p, id: uuid(), idempotentKey: uuid(), dirty: true })));
    logger.info('[providers] 本地默认数据已初始化');
  }
}
