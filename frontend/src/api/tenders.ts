import { apiClient, handleApiError } from "./client";

export interface Tender {
  id: string;
  title: string;
  description?: string;
  deadline: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creatorFirstName?: string;
  creatorLastName?: string;
}

export interface TenderTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  submittedAt?: string;
  dueDate?: string;
  assigneeId: string;
  assigneeFirstName?: string;
  assigneeLastName?: string;
  assigneeEmail?: string;
}

export interface CreateTenderTaskInput {
  title: string;
  description?: string;
  assigneeId: string;
  dueDate?: string;
}

export interface CreateTenderInput {
  title: string;
  description?: string;
  deadline: string;
  tasks?: CreateTenderTaskInput[];
}

export interface UpdateTenderInput {
  title?: string;
  description?: string;
  deadline?: string;
  status?: string;
}

export interface UpdateTenderTaskInput {
  title?: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  status?: string;
}

export const tendersApi = {
  getTenders: async (): Promise<Tender[]> => {
    try {
      const response = await apiClient.get<{ tenders: Tender[] }>("/tenders");
      return response.data.tenders;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getTender: async (
    id: string
  ): Promise<{ tender: Tender; tasks: TenderTask[] }> => {
    try {
      const response = await apiClient.get<{ tender: Tender; tasks: TenderTask[] }>(
        `/tenders/${id}`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  createTender: async (data: CreateTenderInput): Promise<Tender> => {
    try {
      const response = await apiClient.post<{ tender: Tender }>("/tenders", data);
      return response.data.tender;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  updateTender: async (
    id: string,
    data: UpdateTenderInput
  ): Promise<Tender> => {
    try {
      const response = await apiClient.put<{ tender: Tender }>(
        `/tenders/${id}`,
        data
      );
      return response.data.tender;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteTender: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/tenders/${id}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  createTask: async (
    tenderId: string,
    data: CreateTenderTaskInput
  ): Promise<TenderTask> => {
    try {
      const response = await apiClient.post<{ task: TenderTask }>(
        `/tenders/${tenderId}/tasks`,
        data
      );
      return response.data.task;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  uploadTaskFile: async (
    taskId: string,
    file: File,
    onUploadProgress?: (progress: number) => void
  ): Promise<{ task: TenderTask; fileUrl: string }> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiClient.post<{ task: TenderTask; fileUrl: string }>(
        `/tenders/tasks/${taskId}/upload`,
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
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getTaskFileUrl: async (
    taskId: string
  ): Promise<{ url: string; fileName?: string }> => {
    try {
      const response = await apiClient.get<{ url: string; fileName?: string }>(
        `/tenders/tasks/${taskId}/file-url`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  updateTask: async (
    taskId: string,
    data: UpdateTenderTaskInput
  ): Promise<TenderTask> => {
    try {
      const response = await apiClient.put<{ task: TenderTask }>(
        `/tenders/tasks/${taskId}`,
        data
      );
      return response.data.task;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteTask: async (taskId: string): Promise<void> => {
    try {
      await apiClient.delete(`/tenders/tasks/${taskId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteTaskFile: async (taskId: string): Promise<TenderTask> => {
    try {
      const response = await apiClient.delete<{ task: TenderTask }>(
        `/tenders/tasks/${taskId}/file`
      );
      return response.data.task;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getMergedDocumentUrl: async (
    tenderId: string
  ): Promise<{ url: string }> => {
    try {
      const response = await apiClient.get<{ url: string }>(
        `/tenders/${tenderId}/merged-document`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  mergeDocuments: async (
    tenderId: string
  ): Promise<{ url: string; path: string }> => {
    try {
      const response = await apiClient.post<{ url: string; path: string }>(
        `/tenders/${tenderId}/merge-documents`
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteMergedDocument: async (tenderId: string): Promise<void> => {
    try {
      await apiClient.delete(`/tenders/${tenderId}/merged-document`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  downloadMergedDocument: async (tenderId: string): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/tenders/${tenderId}/merged-document/download`, {
        responseType: "blob",
      });
      return response.data as Blob;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
