import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiClient, handleApiError } from "../api/client";
import { useSearchParams } from "react-router-dom";
import LoadingSkeleton from "@/components/LoadingSkeleton";



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
    <LoadingSkeleton />
  );
}
