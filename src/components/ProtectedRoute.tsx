import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Enums } from "@/integrations/supabase/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Enums<"app_role">;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, hasRole, roles } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Super admins and admins can preview any role's view
  const isAdminLike = roles.includes("super_admin") || roles.includes("admin");

  if (requiredRole && !hasRole(requiredRole)) {
    // Admin-like roles can access any route for previewing
    if (isAdminLike || (requiredRole === "admin" && roles.includes("tech_lead"))) {
      return <>{children}</>;
    }
    if (roles.includes("super_admin") || roles.includes("admin")) return <Navigate to="/admin/tasks" replace />;
    if (roles.includes("tech_lead")) return <Navigate to="/admin/tasks" replace />;
    if (roles.includes("specialist")) return <Navigate to="/specialist/tasks" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  // Auto-redirect non-client users from client routes — skip if admin previewing
  if (!requiredRole && !hasRole("client") && !isAdminLike) {
    if (roles.includes("tech_lead")) return <Navigate to="/admin/tasks" replace />;
    if (roles.includes("specialist")) return <Navigate to="/specialist/tasks" replace />;
  }

  return <>{children}</>;
}
