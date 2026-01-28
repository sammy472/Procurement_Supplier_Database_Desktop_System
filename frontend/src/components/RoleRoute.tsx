import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: string | string[];
}

export default function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const hasRole = useAuthStore((state) => state.hasRole);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(allowedRoles)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
