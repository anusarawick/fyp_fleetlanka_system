import { createContext, ReactNode, useContext, useState } from "react";
import Sidebar from "../components/Sidebar";

type AppLayoutProps = {
  children: ReactNode;
  showSidebar?: boolean;
  role?: string | null;
};

type ShellContextType = {
  canOpenSidebar: boolean;
  openSidebar: () => void;
};

const ShellContext = createContext<ShellContextType>({
  canOpenSidebar: false,
  openSidebar: () => undefined,
});

export default function AppLayout({
  children,
  showSidebar = true,
  role,
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isDriver = role === "driver";
  const isService = role === "service";
  const shellClass = isDriver ? "app--driver" : isService ? "app--service" : "app--manager";
  const mainClass = isDriver ? "main--driver" : !isService ? "main--manager" : "";
  const canUseSidebar = showSidebar && !isDriver;
  const appClass = [
    "app",
    shellClass,
    canUseSidebar && sidebarCollapsed ? "app--sidebar-collapsed" : "",
    canUseSidebar && mobileSidebarOpen ? "app--sidebar-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <ShellContext.Provider
      value={{
        canOpenSidebar: canUseSidebar,
        openSidebar: () => setMobileSidebarOpen(true),
      }}
    >
      <div className={appClass}>
        {showSidebar ? (
          <>
            <Sidebar
              role={role}
              collapsed={canUseSidebar && sidebarCollapsed}
              onCollapseToggle={() => setSidebarCollapsed((value) => !value)}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            {canUseSidebar && (
              <button
                className="sidebar-backdrop"
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}
          </>
        ) : null}
        <main className={`main ${mainClass}`}>{children}</main>
      </div>
    </ShellContext.Provider>
  );
}

export function useShell() {
  return useContext(ShellContext);
}
