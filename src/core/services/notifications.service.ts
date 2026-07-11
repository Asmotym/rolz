import { readonly, ref } from 'vue';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: number;
  message: string;
  type: NotificationType;
  timeout: number;
}

const current = ref<AppNotification | null>(null);
let nextId = 1;

function show(message: string, type: NotificationType = 'info', timeout = 3500) {
  current.value = {
    id: nextId,
    message,
    type,
    timeout,
  };
  nextId += 1;
}

export const notifications = {
  current: readonly(current),
  show,
  success(message: string, timeout?: number) {
    show(message, 'success', timeout);
  },
  info(message: string, timeout?: number) {
    show(message, 'info', timeout);
  },
  warning(message: string, timeout?: number) {
    show(message, 'warning', timeout);
  },
  error(message: string, timeout?: number) {
    show(message, 'error', timeout);
  },
  close() {
    current.value = null;
  },
};
