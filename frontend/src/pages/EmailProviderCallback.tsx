import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiClient, handleApiError } from "../api/client";
import { useSearchParams } from "react-router-dom";

export default function EmailProviderCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const run = async () => {
      try {
        const state = params.get("state");
        let code = params.get("code");
        if (!code && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          code = hashParams.get("code") || code;
        }
        const error = params.get("error") || new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error");
        const errorDesc =
          params.get("error_description") ||
          new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
        if (error) {
          toast.error(errorDesc || error || "Authorization failed");
          navigate("/profile");
          return;
        }
        if (!code) {
          toast.error("Missing authorization code");
          navigate("/profile");
          return;
        }
        let provider: "google" | "microsoft" | null = null;
        if (state) {
          try {
            const parsed = JSON.parse(decodeURIComponent(state));
            provider = parsed.provider || null;
          } catch {
            provider = null;
          }
        }
        if (!provider) {
          // Try provider from query for safety
          const p = params.get("provider");
          if (p === "google" || p === "microsoft") provider = p;
        }
        if (!provider) {
          toast.error("Missing provider");
          navigate("/profile");
          return;
        }
        const res = await apiClient.get(`/email/providers/${provider}/callback`, {
          params: { code },
        });
        if (res.data?.account) {
          toast.success(`Connected ${provider} account`);
        } else {
          toast.success("Email account connected");
        }
        navigate("/profile");
      } catch (error) {
        toast.error(handleApiError(error));
        navigate("/profile");
      }
    };
    run();
  }, [params, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="mb-4 inline-block">
          <div className="w-12 h-12 border-4 border-gray-300 dark:border-[#3f51b5] border-t-primary-500 rounded-se-md rounded-es-md animate-spin"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Connecting your email account...</p>
      </div>
    </div>
  );
}
