import { Outlet } from "react-router-dom";

import { SidebarLayout } from "./SidebarLayout";

export function AppShell() {
  return <SidebarLayout><Outlet /></SidebarLayout>;
}