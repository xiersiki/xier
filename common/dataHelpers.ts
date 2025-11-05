/**
 * 数据转换辅助函数
 * 处理 Supabase 和本地 Dexie 之间的数据格式差异
 */

/**
 * 确保 models 字段是数组
 * Supabase 存储为 JSON 字符串，需要解析
 */
export function ensureModelsArray(models: any): string[] {
  if (Array.isArray(models)) {
    return models;
  }

  if (typeof models === "string") {
    try {
      const parsed = JSON.parse(models);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn("[ensureModelsArray] 解析失败:", models);
      return [];
    }
  }

  return [];
}

/**
 * 将数组转换为 JSON 字符串（用于存储到 Supabase）
 */
export function stringifyModels(models: string[]): string {
  return JSON.stringify(models);
}
