import type { NotificationApiInjection } from "naive-ui/es/notification/src/NotificationProvider";

let notificationInstance: NotificationApiInjection | null = null;

export function setNotificationInstance(instance: NotificationApiInjection) {
  notificationInstance = instance;
}

export const notify = {
  success(message: string, title = "成功") {
    notificationInstance?.success({
      title,
      content: message,
      duration: 2000,
    });
  },

  error(message: string, title = "错误") {
    notificationInstance?.error({
      title,
      content: message,
      duration: 3000,
    });
  },

  info(message: string, title = "提示") {
    notificationInstance?.info({
      title,
      content: message,
      duration: 2000,
    });
  },

  warning(message: string, title = "警告") {
    notificationInstance?.warning({
      title,
      content: message,
      duration: 2500,
    });
  },
};
