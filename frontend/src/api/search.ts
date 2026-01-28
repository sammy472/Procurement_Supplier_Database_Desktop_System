import { apiClient, handleApiError } from "./client";
import { Supplier } from "./suppliers";
import { Quotation } from "./quotations";
import { PurchaseOrder } from "./purchaseOrders";

export interface Material {
  id: string;
  name: string;
  partNumber?: string;
  description?: string;
  category?: string;
  brand?: string;
}

export interface GlobalSearchResults {
  suppliers: Supplier[];
  materials: Material[];
  quotations: Quotation[];
  purchaseOrders: PurchaseOrder[];
}

export const searchApi = {
  globalSearch: async (query: string): Promise<GlobalSearchResults> => {
    try {
      const response = await apiClient.get<GlobalSearchResults>("/search", {
        params: { q: query },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
