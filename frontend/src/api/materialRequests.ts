import { apiClient, handleApiError } from "./client";

export interface MaterialRequestItem {
  materialId?: string;
  quantity: number;
  description: string;
}

export interface MaterialRequestDocument {
  id: string;
  requestId: string;
  fileName: string;
  filePath?: string;
  fileType?: string;
  uploadedAt: string;
}

export interface MaterialRequest {
  id: string;
  requestNumber: string;
  requestingEngineer: string;
  department?: string;
  project?: string;
  items: MaterialRequestItem[] | string;
  justification?: string;
  urgencyLevel?: string;
  attachmentPath?: string;
  status: "pending" | "approved" | "rejected" | "procured";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  documents?: MaterialRequestDocument[];
}

export const materialRequestsApi = {
  getAll: async (params?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MaterialRequest[]> => {
    try {
      const response = await apiClient.get<{ requests: MaterialRequest[] }>(
        "/material-requests",
        { params }
      );
      return response.data.requests;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id: string): Promise<MaterialRequest> => {
    try {
      const response = await apiClient.get<{ request: MaterialRequest }>(
        `/material-requests/${id}`
      );
      return response.data.request;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  create: async (data: Partial<MaterialRequest>): Promise<MaterialRequest> => {
    try {
      const response = await apiClient.post<{ request: MaterialRequest }>(
        "/material-requests",
        data
      );
      return response.data.request;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  createWithFiles: async (data: Partial<MaterialRequest>, files: File[], onUploadProgress?: (progress: number) => void): Promise<{ request: MaterialRequest; documents: any[] }> => {
    try {
      const formData = new FormData();
      
      // Append form fields
      formData.append("department", data.department || "");
      formData.append("project", data.project || "");
      formData.append("items", JSON.stringify(data.items || []));
      formData.append("justification", data.justification || "");
      formData.append("urgencyLevel", data.urgencyLevel || "normal");

      // Append files (max 3)
      files.slice(0, 3).forEach((file) => {
        formData.append("files", file);
      });

      console.log("Creating material request with files:", {
        department: data.department,
        project: data.project,
        fileCount: files.length,
      });

      const response = await apiClient.post<{ request: MaterialRequest; documents: any[] }>(
        "/material-requests/with-files",
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

  update: async (
    id: string,
    data: Partial<MaterialRequest>
  ): Promise<MaterialRequest> => {
    try {
      const response = await apiClient.put<{ request: MaterialRequest }>(
        `/material-requests/${id}`,
        data
      );
      return response.data.request;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  approve: async (id: string): Promise<MaterialRequest> => {
    try {
      const response = await apiClient.put<{ request: MaterialRequest }>(
        `/material-requests/${id}/approve`,
        {}
      );
      return response.data.request;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  reject: async (
    id: string,
    rejectionReason?: string
  ): Promise<MaterialRequest> => {
    try {
      const response = await apiClient.put<{ request: MaterialRequest }>(
        `/material-requests/${id}/reject`,
        { rejectionReason }
      );
      return response.data.request;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/material-requests/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  uploadDocument: async (
    requestId: string,
    file: File,
    onUploadProgress?: (progress: number) => void
  ): Promise<{ documentId: string }> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<{ document: any }>(
        `/material-requests/${requestId}/documents`,
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
      return { documentId: response.data.document.id };
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  downloadDocument: async (documentId: string, fileName?: string): Promise<void> => {
    try {
      const response = await apiClient.get(
        `/material-requests/documents/${documentId}/download`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName || "document");
      document.body.appendChild(link);
      link.click();
      link.parentElement?.removeChild(link);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getDocumentUrl: async (documentId: string): Promise<string> => {
    try {
      const response = await apiClient.get<{ url: string }>(
        `/material-requests/documents/${documentId}/url`
      );
      return response.data.url;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteDocument: async (documentId: string): Promise<void> => {
    try {
      await apiClient.delete(`/material-requests/documents/${documentId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
