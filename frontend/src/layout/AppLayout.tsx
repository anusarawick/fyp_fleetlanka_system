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
  const isDriver = role === "driver";
  const isService = role === "service";
  const shellClass = isDriver ? "app--driver" : isService ? "app--service" : "app--manager";
  const mainClass = isDriver ? "main--driver" : !isService ? "main--manager" : "";

  return (
    <div className={`app ${shellClass}`}>
      {showSidebar ? <Sidebar role={role} /> : null}
      <main className={`main ${mainClass}`}>{children}</main>
    </div>
  );
}
