import { Routes, Route, Navigate, HashRouter } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";
import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import LoadingSkeleton from "./components/LoadingSkeleton";
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Materials = lazy(() => import("./pages/Materials"));
const Quotations = lazy(() => import("./pages/Quotations"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const MaterialRequests = lazy(() => import("./pages/MaterialRequests"));
const Profile = lazy(() => import("./pages/Profile"));
const Layout = lazy(() => import("./components/Layout"));
const Tenders = lazy(() => import("./pages/Tenders"));
const EmailProviderCallback = lazy(() => import("./pages/EmailProviderCallback"));
const RFQs = lazy(() => import("./pages/RFQs"));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const isDark = useThemeStore((state) => state.isDark);
  const queryClient = new QueryClient();

  useEffect(() => {
    // Listen for deep links (e.g. onk-savvy://email-callback?status=success)
    const removeListener = (window.electron as any)?.onDeepLink?.((url: string) => {
      console.log("Deep link received:", url);
      try {
        const queryStr = url.split("?")[1];
        if (!queryStr) return;
        const params = new URLSearchParams(queryStr);
        const status = params.get("status");
        const provider = params.get("provider");
        const error = params.get("error");
        
        if (status === "success") {
          toast.success(`Connected ${provider || "email"} account successfully`);
          queryClient.invalidateQueries({ queryKey: ["linked-accounts"] });
        } else if (error) {
          toast.error(`Failed to connect: ${decodeURIComponent(error)}`);
        } else if (status === "error") {
          toast.error("Failed to connect email account");
        }
      } catch (e) {
        console.error("Error parsing deep link", e);
      }
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, [queryClient]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Suspense fallback={<LoadingSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="materials" element={<Materials />} />
              <Route path="quotations" element={<Quotations />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="material-requests" element={<MaterialRequests />} />
              <Route path="tenders" element={<Tenders />} />
              <Route path="rfqs" element={<RFQs />} />
              <Route path="profile" element={<Profile />} />
              <Route path="/provider/callback" element={<EmailProviderCallback />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
      <ToastContainer position="top-right" theme={isDark ? "dark" : "light"} />
    </QueryClientProvider>
  );
}
export default App;
