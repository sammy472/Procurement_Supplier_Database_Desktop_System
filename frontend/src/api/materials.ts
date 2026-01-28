import { apiClient, handleApiError } from "./client";

export interface Material {
  id: string;
  name: string;
  description?: string;
  technicalSpec?: string;
  category?: string;
  partNumber?: string;
  unitOfMeasure?: string;
  brand?: string;
  manufacturer?: string;
  defaultSupplierId?: string;
  minimumStockLevel?: number;
  linkedSuppliers?: any[];
  priceHistory?: PriceHistory[];
  cheapestSupplier?: {
    id: string;
    name: string;
    unitPrice: string;
    leadTime?: number;
    availabilityStatus?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: string;
  materialId: string;
  supplierId: string;
  unitPrice: number;
  currency: string;
  dateQuoted: string;
  availabilityStatus?: string;
  warrantyNotes?: string;
  leadTime?: number;
  remarks?: string;
}

export interface MaterialDocument {
  id: string;
  materialId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
}

export const materialsApi = {
  getAll: async (params?: {
    search?: string;
    category?: string;
    brand?: string;
    limit?: number;
    offset?: number;
  }): Promise<Material[]> => {
    try {
      const response = await apiClient.get<{ materials: Material[] }>(
        "/materials",
        { params }
      );
      console.log("Fetched materials:", response.data.materials);
      return response.data.materials;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id: string): Promise<Material> => {
    try {
      const response = await apiClient.get<{ material: Material }>(
        `/materials/${id}`
      );
      return response.data.material;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  create: async (data: Partial<Material>): Promise<Material> => {
    try {
      const response = await apiClient.post<{ material: Material }>(
        "/materials",
        data
      );
      return response.data.material;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  createWithFiles: async (data: Partial<Material>, files: File[], onUploadProgress?: (progress: number) => void): Promise<{ material: Material; documents: MaterialDocument[] }> => {
    try {
      const formData = new FormData();
      
      // Append form fields
      Object.keys(data).forEach((key) => {
        const value = (data as any)[key];
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });

      // Append files (max 3)
      files.slice(0, 3).forEach((file) => {
        formData.append("files", file);
      });

      console.log("Creating material with files:", {
        dataFields: Object.keys(data),
        fileCount: files.length,
      });

      const response = await apiClient.post<{ material: Material; documents: MaterialDocument[] }>(
        "/materials/with-files",
        formData,
        onUploadProgress
          ? {
              headers: { "Content-Type": "multipart/form-data" },
              onUploadProgress: (event) => {
                if (!event.total) return;
                const percent = Math.round((event.loaded * 100) / event.total);
                onUploadProgress(percent);
              },
            }
          : { headers: { "Content-Type": "multipart/form-data" } }
      );

      return response.data;
    } catch (error: any) {
      console.error("Create with files error:", error.response?.data || error.message);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id: string, data: Partial<Material>): Promise<Material> => {
    try {
      const response = await apiClient.put<{ material: Material }>(
        `/materials/${id}`,
        data
      );
      return response.data.material;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/materials/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  addPriceHistory: async (
    materialId: string,
    data?: Partial<PriceHistory>
  ): Promise<PriceHistory> => {
    try {
      const response = await apiClient.post<{ priceHistory: PriceHistory }>(
        `/materials/${materialId}/price-history`,
        data
      );
      return response.data.priceHistory;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Document management
  uploadDocument: async (materialId: string, file: File, onUploadProgress?: (progress: number) => void): Promise<MaterialDocument> => {
    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await apiClient.post<any>(
        `/materials/${materialId}/documents`,
        formData,
        onUploadProgress
          ? {
              onUploadProgress: (event) => {
                if (!event.total) return;
                const percent = Math.round((event.loaded * 100) / event.total);
                onUploadProgress(percent);
              },
            }
          : undefined
      );
      return response.data.document;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getDocuments: async (materialId: string): Promise<MaterialDocument[]> => {
    try {
      const response = await apiClient.get<{ documents: MaterialDocument[] }>(
        `/materials/${materialId}/documents`
      );
      return response.data.documents;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getDocumentUrl: async (documentId: string): Promise<string> => {
    try {
      const response = await apiClient.get<{ url: string }>(
        `/materials/documents/${documentId}/url`
      );
      return response.data.url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  downloadDocument: async (documentId: string, fileName: string): Promise<void> => {
    try {
      const response = await apiClient.get(`/materials/documents/${documentId}/download`, {
        responseType: "blob",
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.parentElement?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteDocument: async (documentId: string): Promise<void> => {
    try {
      await apiClient.delete(`/materials/documents/${documentId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
