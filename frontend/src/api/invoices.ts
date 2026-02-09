import { apiClient, handleApiError } from "./client";

export interface CreateInvoiceRequest {
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  quotationNumber?: string;
  baseInvoiceId?: string;
  pricingRuleSnapshot?: any;
  companyProfileSnapshot?: any;
  items: any[];
  subtotal: number;
  taxTotal?: number;
  total: number;
  currency: string;
  pdfPath?: string;
  status?: string;
}

export const invoiceApi = {
  create: async (data: CreateInvoiceRequest) => {
    const response = await apiClient.post("/invoices", data);
    return response.data;
  },
  
  getAll: async (params?: { search?: string; status?: string; limit?: number; offset?: number }) => {
    const response = await apiClient.get("/invoices", { params });
    return response.data;
  },
  
  getOne: async (id: string) => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateInvoiceRequest>) => {
    const response = await apiClient.patch(`/invoices/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/invoices/${id}`);
    return response.data;
  },

  exportPDF: async (id: string, view: boolean = false): Promise<string> => {
    try {
      const response = await apiClient.get(`/invoices/${id}/pdf?view=${view}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (!view) {
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `invoice-${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};
