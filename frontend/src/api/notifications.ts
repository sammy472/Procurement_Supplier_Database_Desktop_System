import { apiClient, handleApiError } from "./client";

export interface Notification {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
  readStatusId?: string;
}

export const notificationsApi = {
  getAll: async (status?: "read" | "unread"): Promise<Notification[]> => {
    try {
      const params = status ? { status } : {};
      const response = await apiClient.get<{ notifications: Notification[] }>(
        "/notifications",
        { params }
      );
      return response.data.notifications;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getUnreadCount: async (): Promise<number> => {
    try {
      const response = await apiClient.get<{ count: number }>(
        "/notifications/unread-count"
      );
      return response.data.count;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  markAsRead: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  markAsUnread: async (id: string): Promise<void> => {
    try {
      await apiClient.put(`/notifications/${id}/unread`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  markAllAsRead: async (): Promise<void> => {
    try {
      await apiClient.put("/notifications/mark-all-read");
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteNotification: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/notifications/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteAllRead: async (): Promise<void> => {
    try {
      await apiClient.delete("/notifications/read/all");
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
