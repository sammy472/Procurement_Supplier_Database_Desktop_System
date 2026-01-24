import { apiClient, handleApiError } from "./client";

export type Provider = "google" | "microsoft";

export const providerMailsApi = {
  getAuthUrl: async (provider: Provider): Promise<string> => {
    try {
      const res = await apiClient.get<{ url: string }>(`/email/providers/${provider}/auth-url`);
      return res.data.url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getLinkedAccounts: async (): Promise<{ providers: Provider[]; accounts: any[] }> => {
    try {
      const res = await apiClient.get<{ providers: Provider[]; accounts: any[] }>(`/email/providers/linked`);
      return res.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  listMessages: async (
    provider: Provider,
    folder?: "inbox" | "sent" | "drafts" | "trash",
    opts?: { limit?: number; pageToken?: string | null; skip?: number }
  ): Promise<{ messages: any[]; paging?: { limit: number; nextPageToken?: string | null; nextLink?: string | null } }> => {
    try {
      const res = await apiClient.get<{ messages: any[]; paging?: { limit: number; nextPageToken?: string | null; nextLink?: string | null } }>(
        `/email/providers/${provider}/messages`,
        {
          params: {
            ...(folder ? { folder } : {}),
            limit: (opts && opts.limit) || 10,
            ...(opts && opts.pageToken ? { pageToken: opts.pageToken } : {}),
            ...(opts && typeof opts.skip === "number" ? { skip: opts.skip } : {}),
          },
        });
      return res.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getMessage: async (provider: Provider, id: string): Promise<any> => {
    try {
      const res = await apiClient.get<{ message: any }>(`/email/providers/${provider}/messages/${id}`);
      return res.data.message;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  sendMessage: async (
    provider: Provider,
    data: {
      subject: string;
      bodyText?: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      attachments?: Array<{ filename: string; contentType: string; contentBase64: string }>;
    }
  ) => {
    try {
      const res = await apiClient.post(`/email/providers/${provider}/messages`, data, {
        responseType: "text",
        transformResponse: [(raw) => raw],
      });
      return typeof res.data === "string" && res.data.trim().length > 0 ? res.data : { ok: true };
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteMessage: async (provider: Provider, id: string) => {
    try {
      await apiClient.delete(`/email/providers/${provider}/messages/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  markRead: async (provider: Provider, id: string) => {
    try {
      await apiClient.patch(`/email/providers/${provider}/messages/${id}/read`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
