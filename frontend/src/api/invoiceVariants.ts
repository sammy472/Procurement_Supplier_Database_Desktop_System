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
};
