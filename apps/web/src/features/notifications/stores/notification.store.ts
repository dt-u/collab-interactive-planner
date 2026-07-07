import { create } from "zustand";

export interface NotificationDto {
  id: string;
  recipientId: string;
  senderId?: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface NotificationState {
  notifications: NotificationDto[];
  unreadCount: number;
  setNotifications: (notifications: NotificationDto[]) => void;
  addNotification: (notification: NotificationDto) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  resetUnreadCount: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications: NotificationDto[]) =>
    set({
      notifications,
      unreadCount: notifications.filter((n: NotificationDto) => !n.read).length,
    }),
  addNotification: (notification: NotificationDto) =>
    set((state: NotificationState) => {
      if (state.notifications.some((n: NotificationDto) => n.id === notification.id)) {
        return {};
      }
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
      };
    }),
  incrementUnreadCount: () => set((state: NotificationState) => ({ unreadCount: state.unreadCount + 1 })),
  decrementUnreadCount: () => set((state: NotificationState) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  resetUnreadCount: () => set({ unreadCount: 0 }),
}));

export const notificationStore = {
  useNotificationStore,
};
