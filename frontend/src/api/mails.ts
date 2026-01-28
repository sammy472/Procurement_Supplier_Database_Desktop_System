import { apiClient, handleApiError } from "./client";

export interface MailRecipient {
  id: string;
  messageId: string;
  userId: string;
  type: "to" | "cc" | "bcc";
  isRead: boolean;
  readAt?: string;
  deletedAt?: string;
  createdAt: string;
}

export interface MailAttachment {
  id: string;
  messageId: string;
  fileName: string;
  filePath?: string;
  fileType?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface MailMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  status: "draft" | "sent" | "archived" | "trashed";
  createdAt: string;
  updatedAt: string;
  recipients?: MailRecipient[];
  attachments?: MailAttachment[];
}

export const mailsApi = {
  getAll: async (params?: {
    folder?: "inbox" | "sent" | "drafts" | "trash";
    limit?: number;
    offset?: number;
  }): Promise<MailMessage[]> => {
    try {
      const response = await apiClient.get<{ messages: MailMessage[] }>(
        "/mails",
        { params }
      );
      return response.data.messages;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id: string): Promise<MailMessage> => {
    try {
      const response = await apiClient.get<{ message: MailMessage }>(
        `/mails/${id}`
      );
      return response.data.message;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  create: async (data: {
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    status?: "draft" | "sent";
  }): Promise<MailMessage> => {
    try {
      const response = await apiClient.post<{ message: MailMessage }>(
        "/mails",
        data
      );
      return response.data.message;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  createWithFiles: async (
    data: {
      subject: string;
      bodyText?: string;
      bodyHtml?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      status?: "draft" | "sent";
    },
    files: File[]
  ): Promise<MailMessage> => {
    try {
      const form = new FormData();
      form.append("subject", data.subject);
      if (data.bodyText) form.append("bodyText", data.bodyText);
      if (data.bodyHtml) form.append("bodyHtml", data.bodyHtml);
      if (data.status) form.append("status", data.status);
      (data.to || []).forEach((id) => form.append("to[]", id));
      (data.cc || []).forEach((id) => form.append("cc[]", id));
      (data.bcc || []).forEach((id) => form.append("bcc[]", id));
      files.forEach((f) => form.append("attachments", f));
      const response = await apiClient.post<{ message: MailMessage }>(
        "/mails",
        form
      );
      return response.data.message;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  update: async (
    id: string,
    data: Partial<{
      subject: string;
      bodyText: string;
      bodyHtml: string;
      status: "draft" | "sent" | "archived" | "trashed";
    }>
  ): Promise<MailMessage> => {
    try {
      const response = await apiClient.put<{ message: MailMessage }>(
        `/mails/${id}`,
        data
      );
      return response.data.message;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/mails/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  markRead: async (id: string): Promise<void> => {
    try {
      await apiClient.patch(`/mails/${id}/read`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getAttachmentUrl: async (attachmentId: string): Promise<string> => {
    try {
      const response = await apiClient.get<{ url: string }>(
        `/mails/attachments/${attachmentId}/url`
      );
      return response.data.url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
