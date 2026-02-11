import { apiClient } from "./client";

export interface GenerateVariantsResponse {
  success: boolean;
  generatedFiles: string[];
  variants?: any[];
  generatedUrls?: { inline: string; download: string }[];
}

export const invoiceVariantsApi = {
  generate: async (formData: FormData): Promise<GenerateVariantsResponse> => {
    const response = await apiClient.post("/invoice-variants/generate", formData);
    return response.data;
  },
  generateFromHtml: async (html: string, invoiceMeta: any, buyerProfiles?: any[], items?: any[]): Promise<GenerateVariantsResponse> => {
    const response = await apiClient.post("/invoice-variants/generate", {
      html,
      invoiceMeta,
      buyerProfiles,
      items,
    });
    return response.data;
  },
  uploadClientPdf: async (
    file: Blob,
    filename: string,
    invoiceMeta: any,
    buyerProfiles?: any[],
    items?: any[]
  ): Promise<GenerateVariantsResponse> => {
    const formData = new FormData();
    formData.append("file", file, filename);
    formData.append("invoiceMeta", JSON.stringify(invoiceMeta));
    formData.append("buyerProfiles", JSON.stringify(buyerProfiles || []));
    formData.append("items", JSON.stringify(items || []));
    const response = await apiClient.post("/invoice-variants/upload", formData);
    return response.data;
  },
};
