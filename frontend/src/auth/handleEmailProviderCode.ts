import { toast } from "react-toastify";
import { apiClient, handleApiError } from "../api/client";

export async function handleEmailProviderCode(
  code: string,
  provider: "google" | "microsoft"
) {
  try {
    const res = await apiClient.get(
      `/email/providers/${provider}/callback`,
      {
        params: { code },
      }
    );

    if (res.data?.account) {
      toast.success(`Connected ${provider} account`);
    } else {
      toast.success("Email account connected");
    }
  } catch (error) {
    toast.error(handleApiError(error));
    throw error;
  }
}
