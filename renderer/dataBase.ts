import type { Provider, Conversation, Message } from "@common/types";
import { stringifyOpenAISetting } from "@common/utils";
import { logger } from "./utils/logger";
import Dexie, { type EntityTable } from "dexie";
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
    idempotentKey: null,
    dirty: false, // 默认数据不需要同步
  },
  {
    id: DEFAULT_PROVIDER_IDS.deepseek,
    name: "deepseek",
    title: "深度求索 (DeepSeek)",
    models: ["deepseek-chat"],
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
    idempotentKey: null,
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
    idempotentKey: null,
    dirty: false,
  },
];

export const dataBase = new Dexie("xier") as Dexie & {
  providers: EntityTable<Provider, "id">;
  conversations: EntityTable<Conversation, "id">;
  messages: EntityTable<Message, "id">;
};

// 版本 1 - 初始版本
// dataBase.version(1).stores({
//   providers: '++id,name',
//   conversations: '++id,providerId,pinned',
//   messages: '++id,conversationId'
// });
// 版本 2 - 修改时间字段类型从 string 到 number (时间戳)
// 版本 3 - 修改 OpenAISetting 字段类型 为 base64 字符串
// 版本 4 - providers 主键改为手动提供的 UUID
// 版本 5 - conversations 和 messages 主键也改为手动提供的 UUID
dataBase.version(5).stores({
  providers: "id,name", // 主键为非自增，使用 UUID
  conversations: "id,providerId,pinned", // 主键为非自增，使用 UUID
  messages: "id,conversationId", // 主键为非自增，使用 UUID
});

/**
 * 初始化 providers 并进行双向同步
 */
export async function initProviders() {
  const count = await dataBase.providers.count();

  // 1. 初始化本地默认数据
  if (count === 0) {
    await dataBase.providers.bulkPut(providers);
    logger.info("[providers] 本地默认数据已初始化");
  }
}
