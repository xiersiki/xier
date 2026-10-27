export const materialErrorMessages: Record<string, string> = {
  INVALID_UTF8: "文件不是有效的 UTF-8 文本，请转换编码后重新导入。",
  BINARY_FILE: "文件含二进制内容，无法作为文字资料导入。",
  FILE_UNREADABLE: "无法读取原文件，请检查文件是否存在和访问权限。",
  NOT_FOUND: "副本已移除，请刷新资料库。",
  INVALID_QUERY: "搜索词无效，请检查字符并限制在 128 个字符内。",
  DATABASE_CORRUPT:
    "资料库损坏，原数据库已保留。请先备份并检查磁盘，再联系维护者恢复。",
  CANCEL_UNCONFIRMED: "停止结果尚未保存，请查询任务或重启资料服务核对。",
  UNBOUND: "正在确认当前账号，请稍后重试。",
  STALE_LEASE: "账号已切换，请刷新资料库。",
  FEATURE_DISABLED: "资料库当前已关闭，本机副本仍然保留。",
  SERVICE_UNAVAILABLE: "资料服务暂时不可用，请重启资料服务。",
  UNKNOWN_OUTCOME: "服务未确认结果，请先查询任务记录，避免重复提交。",
  STORAGE_UNAVAILABLE: "无法读取资料库，请检查磁盘和文件权限后重启服务。",
  DISK_FULL: "磁盘空间不足，请释放空间后重新选择文件重试。",
  READ_ONLY: "资料库不可写，请检查磁盘权限。",
  LIBRARY_QUOTA: "资料库已达到 500 份或 100 MiB 上限，请先移除不需要的副本。",
  FILE_TOO_LARGE: "每份文件最多 2 MiB，请选择较小的文件。",
  BATCH_BYTE_LIMIT: "每批文件合计最多 20 MiB。",
  BATCH_FILE_LIMIT: "每批最多导入 100 份文件。",
  NOT_REGULAR_FILE: "请选择普通文件，不支持文件夹和符号链接。",
  UNSUPPORTED_FILE: "仅支持 TXT 和 Markdown 文件。",
  EMPTY_FILE: "无法导入空文件。",
  SOURCE_CHANGED: "原文件在选择后发生变化，请重新选择。",
  SELECTION_EXPIRED: "文件选择已过期，请重新选择。",
  BUSY: "已有任务正在处理，请稍后重试。",
  SCHEMA_TOO_NEW: "资料库由更高版本创建，请使用原版本打开。",
};
export function explainMaterialError(value: unknown) {
  const message = String(value);
  return (
    Object.entries(materialErrorMessages).find(([code]) =>
      message.includes(code),
    )?.[1] ?? "操作未完成，请重试或重启资料服务。"
  );
}
