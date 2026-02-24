import { apiClient, handleApiError } from "./client";

export interface POLineItem {
  materialId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  quotationId?: string;
  supplierId: string;
  currency: string;
  lineItems: POLineItem[] | string;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  expectedDeliveryDate?: string;
  shippingMethod?: string;
  shippingService?: string;
  paymentTerms?: string;
  status: "draft" | "sent" | "delivered" | "closed";
  createdAt: string;
  updatedAt: string;
}

export const purchaseOrdersApi = {
  getAll: async (params?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PurchaseOrder[]> => {
    try {
      const response = await apiClient.get<{ purchaseOrders: PurchaseOrder[] }>(
        "/purchase-orders",
        { params }
      );
      return response.data.purchaseOrders;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id: string): Promise<PurchaseOrder> => {
    try {
      const response = await apiClient.get<{ purchaseOrder: PurchaseOrder }>(
        `/purchase-orders/${id}`
      );
      return response.data.purchaseOrder;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  create: async (data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    try {
      const response = await apiClient.post<{ purchaseOrder: PurchaseOrder }>(
        "/purchase-orders",
        data
      );
      return response.data.purchaseOrder;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  update: async (
    id: string,
    data: Partial<PurchaseOrder>
  ): Promise<PurchaseOrder> => {
    try {
      const response = await apiClient.put<{ purchaseOrder: PurchaseOrder }>(
        `/purchase-orders/${id}`,
        data
      );
      return response.data.purchaseOrder;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/purchase-orders/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  sendEmail: async (id: string, data: { recipientEmail: string; subject?: string; body?: string }): Promise<void> => {
    try {
      await apiClient.post(`/purchase-orders/${id}/email`, data);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  exportPDF: async (id: string, view: boolean = false): Promise<string> => {
    try {
      const response = await apiClient.get(`/purchase-orders/${id}/pdf?view=${view}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      
      if (!view) {
        // Download mode
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `purchase-order-${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return "";
      }
      
      // View mode - return URL for viewing
      return url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
