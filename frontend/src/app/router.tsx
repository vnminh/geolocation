import { Navigate, createBrowserRouter } from "react-router-dom";

import { routePaths } from "../shared/constants/routePaths";
import { AppShell } from "../shared/components/layout/AppShell";
import { RequireAuth, RequireRole } from "../shared/auth/guards";
import { getSessionUser } from "../shared/auth/token";
import { SigninRoute } from "../routes/signin/SigninRoute";
import { SignupRoute } from "../routes/signup/SignupRoute";
import { UserManagementRoute } from "../routes/user/user-management/UserManagementRoute";
import { UserSettingsRoute } from "../routes/user/settings/UserSettingsRoute";
import { UserTaggingRoute } from "../routes/user/tagging/UserTaggingRoute";
import { UserHistoryRoute } from "../routes/user/history/UserHistoryRoute";
import { UserUpsertRequestRoute } from "../routes/user/upsert-request/UserUpsertRequestRoute";

function RootRedirect() {
  const user = getSessionUser();
  return <Navigate to={user ? routePaths.userTagging : routePaths.signin} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: routePaths.signin,
    element: <SigninRoute />,
  },
  {
    path: routePaths.signup,
    element: <SignupRoute />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/user",
        element: <AppShell />,
        children: [
          {
            path: "settings",
            element: <UserSettingsRoute />,
          },
          {
            path: "tagging",
            element: <UserTaggingRoute />,
          },
          {
            path: "history",
            element: <UserHistoryRoute />,
          },
        ],
      },
      {
        element: <RequireRole allowedRoles={["admin"]} />,
        children: [
          {
            path: routePaths.userUpsertRequest,
            element: <AppShell />,
            children: [
              {
                path: "",
                element: <UserUpsertRequestRoute />,
              },
            ],
          },
          {
            path: routePaths.userManagement,
            element: <AppShell />,
            children: [
              {
                path: "",
                element: <UserManagementRoute />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <RootRedirect />,
  },
]);