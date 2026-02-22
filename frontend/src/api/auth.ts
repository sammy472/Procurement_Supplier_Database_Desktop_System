import { apiClient, handleApiError } from "./client";
import { useAuthStore } from "../store/authStore";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    company: "ONK_GROUP" | "ANT_SAVY";
  };
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post<AuthResponse>(
        "/auth/login",
        credentials
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post<AuthResponse>(
        "/auth/register",
        data
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  logout: async (): Promise<void> => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        await apiClient.post("/auth/logout", { refreshToken });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  getProfile: async () => {
    try {
      const response = await apiClient.get("/auth/profile");
      return response.data.user;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  updateProfile: async (data: {
    firstName: string;
    lastName: string;
    email: string;
  }) => {
    try {
      const response = await apiClient.put("/auth/profile", data);
      return response.data.user;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      const response = await apiClient.post("/auth/change-password", data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  requestPasswordReset: async (
    email: string
  ): Promise<{ message: string; resetToken?: string }> => {
    try {
      const response = await apiClient.post<{ message: string; resetToken?: string }>(
        "/auth/request-password-reset",
        { email }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  resetPassword: async (
    token: string,
    newPassword: string
  ): Promise<{ message: string }> => {
    try {
      const response = await apiClient.post<{ message: string }>(
        "/auth/reset-password",
        { token, newPassword }
      );
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getUsers: async (): Promise<
    {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
    }[]
  > => {
    try {
      const response = await apiClient.get<{ users: any[] }>("/auth/users");
      return response.data.users;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};
