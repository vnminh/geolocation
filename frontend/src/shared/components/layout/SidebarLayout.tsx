import { PropsWithChildren } from "react";

import { Sidebar } from "./Sidebar";

interface SidebarLayoutProps extends PropsWithChildren {
  publicMode?: boolean;
}

export function SidebarLayout({ children, publicMode = false }: SidebarLayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar publicMode={publicMode} />
      <main className="page-content">{children}</main>
    </div>
  );
}