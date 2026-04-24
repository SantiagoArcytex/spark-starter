import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { LayoutDashboard, CheckSquare, CreditCard, Settings, LogOut } from "lucide-react";
import NotificationCentre from "@/components/NotificationCentre";
import RolePreviewSwitcher from "@/components/RolePreviewSwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null as string | null },
  { to: "/approvals", label: "Approvals", icon: CheckSquare, badge: "approvals" },
  { to: "/billing", label: "Billing", icon: CreditCard, badge: null },
  { to: "/settings", label: "Settings", icon: Settings, badge: null },
];

export default function ClientLayout() {
  const { signOut, profile } = useAuth();
  const counts = useNotificationCounts();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground font-display">A</span>
          </div>
          <span className="text-lg font-semibold text-foreground font-display">Arcytex</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const badgeCount = item.badge === "approvals" ? counts.pendingApprovals : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_-10px_hsl(var(--primary)/0.2)]"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {badgeCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 text-sm">
            <p className="font-medium text-foreground truncate">{profile?.full_name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-end gap-2 px-4 py-3 md:px-8">
          <RolePreviewSwitcher />
          <NotificationCentre />
        </div>
        <div className="radial-glow mx-auto max-w-6xl px-4 pb-8 md:px-8">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-card md:hidden">
        {navItems.map((item) => {
          const badgeCount = item.badge === "approvals" ? counts.pendingApprovals : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {badgeCount > 0 && (
                <span className="absolute right-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {badgeCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
