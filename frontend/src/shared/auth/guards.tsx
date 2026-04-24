import { Navigate, Outlet } from "react-router-dom";

import { routePaths } from "../constants/routePaths";
import { useAuth } from "./context";
import { UserRole } from "./role";

export function RequireAuth() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to={routePaths.signin} replace />;
  }
  return <Outlet />;
}

interface RequireRoleProps {
  allowedRoles: UserRole[];
}

export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to={routePaths.signin} replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={routePaths.userTagging} replace />;
  }
  return <Outlet />;
}