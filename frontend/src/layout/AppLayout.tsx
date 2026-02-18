import { ReactNode } from "react";
import Sidebar from "../components/Sidebar";

type AppLayoutProps = {
  children: ReactNode;
  showSidebar?: boolean;
  role?: string | null;
};

export default function AppLayout({
  children,
  showSidebar = true,
  role,
}: AppLayoutProps) {
  return (
    <div className="app">
      {showSidebar ? <Sidebar role={role} /> : null}
      <main className="main">{children}</main>
    </div>
  );
}
