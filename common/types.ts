import { IPC_EVENTS, WINDOW_NAMES, CONFIG_KEYS } from "./constants";

export type IpcEvents = `${IPC_EVENTS}`;
export type WindowNames = `${WINDOW_NAMES}`;
export type ConfigKeys = `${CONFIG_KEYS}`;

export interface IConfig {
  // 主题模式配置
  [CONFIG_KEYS.THEME_MODE]: ThemeMode;
  // 高亮色
  [CONFIG_KEYS.PRIMARY_COLOR]: string;
  // 语言
  [CONFIG_KEYS.LANGUAGE]: "zh" | "en";
  // 字体大小
  [CONFIG_KEYS.FONT_SIZE]: number;
  // 关闭时最小化到托盘
  [CONFIG_KEYS.MINIMIZE_TO_TRAY]: boolean;
  // provider 配置 JSON
  [CONFIG_KEYS.PROVIDER]?: string;
  // 默认模型
  [CONFIG_KEYS.DEFAULT_MODEL]?: string | null;
}
export interface Conversation {
  id: string; // 修改为uuid
  userId?: string;
  title: string;
  selectedModel: string;
  createdAt: number;
  updatedAt: number;
  providerId: string; // 外键对应provider表的主键id
  pinned: boolean;
  type?: "divider" | "conversation";
  dirty: boolean;
  version: number; // 版本号
  idempotentKey: string; // uuid用于幂等性
}

export type MessageStatus = "loading" | "streaming" | "success" | "error";
export interface Message {
  id: string; // 修改为uuid
  content: string;
  type: "question" | "answer";
  createdAt: number;
  updatedAt?: number;
  status?: MessageStatus;
  conversationId: string; // 外键对应conversation表的主键id
  dirty: boolean;
}

export interface OpenAISetting {
  baseURL?: string;
  apiKey?: string;
}

export interface Provider {
  id: string; // 换成uuid了
  name: string;
  visible?: boolean;
  title?: string;
  type?: "OpenAI";
  openAISetting?: string;
  createdAt: number;
  updatedAt: number;
  models: string[];
  version: number; // 版本号
  idempotentKey: string; // uuid用于幂等性
  dirty?: boolean; // 这条数据是否已经同步，可以不传即为undefine即为false
}
