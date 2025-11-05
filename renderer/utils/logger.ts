// 直接使用浏览器控制台，方便调试
// 如果需要将日志写入主进程，取消下面的注释：
// export const logger = window.api.logger ?? console;
// if (window.api.logger) {
//   console.log = logger.info;
//   console.info = logger.info;
//   console.warn = logger.warn;
//   console.error = logger.error;
//   console.debug = logger.debug;
// }

// 使用浏览器原生控制台，便于在开发者工具中调试
export const logger = console;
