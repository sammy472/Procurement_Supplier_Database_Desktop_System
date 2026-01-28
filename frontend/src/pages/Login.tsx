import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import { authApi } from "../api/auth";
import { toast } from "react-toastify";
import { useEffect } from "react";
import { MdWbSunny, MdNightlightRound } from "react-icons/md";
import {
  validateLoginCredentials,
  validatePasswordResetRequest,
  validatePasswordReset,
} from "../utils/validation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "reset">("request");
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { isDark, toggleTheme } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate credentials before making API call
    const validation = validateLoginCredentials({ email, password });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      setAuth(response.user, response.accessToken, response.refreshToken);
      toast.success("Login successful");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email before making API call
    const validation = validatePasswordResetRequest(resetEmail);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setResetLoading(true);

    try {
      await authApi.requestPasswordReset(resetEmail);
      toast.success("Password reset link sent to email");
      setResetStep("reset");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate reset data before making API call
    const validation = validatePasswordReset({
      token: resetToken,
      newPassword,
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setResetLoading(true);

    try {
      await authApi.resetPassword(resetToken, newPassword);
      toast.success("Password reset successfully");
      setShowPasswordReset(false);
      setResetStep("request");
      setResetEmail("");
      setResetToken("");
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#0f1929] transition-colors duration-300 px-4 sm:px-6 lg:px-8">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-8 right-8 p-2 rounded-full bg-gray-100 dark:bg-[#3f51b5] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3f51b5]/80 transition-all duration-200"
        title={isDark ? "Light mode" : "Dark mode"}
      >
        {isDark ? <MdWbSunny className="w-5 h-5" /> : <MdNightlightRound className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center animate-slideIn">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Procurement System
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Streamlined supplier and inventory management
          </p>
        </div>

        {/* Login Card */}
        <div className="card">
          {!showPasswordReset ? (
            <>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn btn-primary py-3 font-semibold"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-se-md rounded-es-md animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </button>

                <div className="flex items-center justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(true)}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                  >
                    Forgot your password?
                  </button>
                </div>
              </form>

              {/* Demo Credentials */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#3f51b5]">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Demo Credentials
                </p>
                <div className="space-y-2 text-sm">
                  <div className="bg-gray-50 dark:bg-[#0f1929] p-3 rounded-se-md rounded-es-md">
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Admin:</span> admin@onkgroup.com
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">admin123</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#0f1929] p-3 rounded-se-md rounded-es-md">
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Officer:</span> officer@onkgroup.com
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">officer123</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {resetStep === "request" ? (
                <form className="space-y-5" onSubmit={handlePasswordResetRequest}>
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      className="input"
                      placeholder="you@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full btn btn-primary py-3 font-semibold"
                  >
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordReset(false);
                      setResetStep("request");
                    }}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium py-2"
                  >
                    Back to Sign In
                  </button>
                </form>
              ) : (
                <form className="space-y-5" onSubmit={handlePasswordReset}>
                  <div>
                    <label htmlFor="reset-token" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Reset Token
                    </label>
                    <input
                      id="reset-token"
                      type="text"
                      required
                      className="input"
                      placeholder="Enter token from email"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      required
                      className="input"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full btn btn-primary py-3 font-semibold"
                  >
                    {resetLoading ? "Resetting..." : "Reset Password"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetStep("request")}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium py-2"
                  >
                    Request New Token
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-6">
          © {new Date().getFullYear()} ONK Group. All rights reserved.
        </p>
      </div>
    </div>
  );
}
