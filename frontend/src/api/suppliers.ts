import { apiClient, handleApiError } from "./client";

export interface Supplier {
  id: string;
  name: string;
  category?: string;
  address?: string;
  email?: string;
  phone?: string;
  country?: string;
  contactPerson?: string;
  reliabilityRating?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const suppliersApi = {
  getAll: async (params?: {
    search?: string;
    category?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Supplier[]> => {
    try {
      const response = await apiClient.get<{ suppliers: Supplier[] }>(
        "/suppliers",
        { params }
      );
      return response.data.suppliers;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id: string): Promise<Supplier> => {
    try {
      const response = await apiClient.get<{ supplier: Supplier }>(
        `/suppliers/${id}`
      );
      return response.data.supplier;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  create: async (data: Partial<Supplier>): Promise<Supplier> => {
    try {
      const response = await apiClient.post<{ supplier: Supplier }>(
        "/suppliers",
        data
      );
      return response.data.supplier;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },


  update: async (id: string, data: Partial<Supplier>): Promise<Supplier> => {
    try {
      const response = await apiClient.put<{ supplier: Supplier }>(
        `/suppliers/${id}`,
        data
      );
      return response.data.supplier;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/suppliers/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  uploadDocument: async (
    supplierId: string,
    file: File,
    onUploadProgress?: (progress: number) => void
  ): Promise<{ documentId: string }> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("Uploading file:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        supplierId,
      });

      const response = await apiClient.post<{ document: any }>(
        `/suppliers/${supplierId}/documents`,
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
      
      console.log("Upload successful:", response.data);
      return { documentId: response.data.document.id };
    } catch (error: any) {
      console.error("Upload error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(handleApiError(error));
    }
  },

  createWithFiles: async (
    data: Partial<Supplier>,
    files: File[],
    onUploadProgress?: (progress: number) => void
  ): Promise<{ supplier: Supplier; documents: any[] }> => {
    try {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        const value = (data as any)[key];
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
      files.slice(0, 3).forEach((file) => formData.append("files", file));
      const response = await apiClient.post<{ supplier: Supplier; documents: any[] }>(
        "/suppliers/with-files",
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
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  downloadDocument: async (documentId: string, fileName?: string): Promise<void> => {
    try {
      const response = await apiClient.get(
        `/suppliers/documents/${documentId}/download`,
        {
          responseType: "blob",
        }
      );
      
      // Get filename from Content-Disposition header or use parameter
      let filename = fileName || "supplier-document";
      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getDocumentUrl: async (documentId: string): Promise<string> => {
    try {
      const response = await apiClient.get<{ url: string }>(
        `/suppliers/documents/${documentId}/url`
      );
      return response.data.url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteDocument: async (documentId: string): Promise<void> => {
    try {
      await apiClient.delete(`/suppliers/documents/${documentId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
