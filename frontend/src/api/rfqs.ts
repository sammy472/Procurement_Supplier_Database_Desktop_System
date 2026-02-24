import { apiClient, handleApiError } from "./client";

export type RfqStatus = "active" | "sent" | "closed";

export interface RfqItem {
  partNumber?: string;
  serialNumber?: string;
  description: string;
  quantity: number;
}

export interface Rfq {
  id: string;
  subject: string;
  senderAddress: string;
  items: RfqItem[];
  openDate: string;
  closeDate: string;
  resolved?: boolean;
  status: RfqStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const rfqsApi = {
  getAll: async (params?: { status?: RfqStatus; limit?: number; offset?: number }): Promise<Rfq[]> => {
    try {
      const res = await apiClient.get<{ rfqs: Rfq[] }>("/rfqs", { params });
      return res.data.rfqs;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
  getById: async (id: string): Promise<{ rfq: Rfq; assignments: Array<{ assigneeId: string; firstName?: string; lastName?: string; email?: string }> }> => {
    try {
      const res = await apiClient.get<{ rfq: Rfq; assignments: any[] }>(`/rfqs/${id}`);
      return res.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
  create: async (data: {
    subject: string;
    senderAddress: string;
    items: RfqItem[];
    openDate: string;
    closeDate: string;
    assigneeIds?: string[];
  }): Promise<Rfq> => {
    try {
      const res = await apiClient.post<{ rfq: Rfq }>("/rfqs", data);
      return res.data.rfq;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
  update: async (id: string, data: Partial<{
    subject: string;
    senderAddress: string;
    items: RfqItem[];
    openDate: string;
    closeDate: string;
    status: RfqStatus;
    assigneeIds: string[];
  }>): Promise<Rfq> => {
    try {
      const res = await apiClient.patch<{ rfq: Rfq }>(`/rfqs/${id}`, data);
      return res.data.rfq;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
  setResolved: async (id: string, resolved: boolean): Promise<Rfq> => {
    try {
      const res = await apiClient.patch<{ rfq: Rfq }>(`/rfqs/${id}/resolved`, { resolved });
      return res.data.rfq;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/rfqs/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
