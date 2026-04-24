import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Users, ListTodo, CreditCard, UserCog, LogOut, AlertTriangle, BarChart3 } from "lucide-react";
import NotificationCentre from "@/components/NotificationCentre";
import { Button } from "@/components/ui/button";
import RolePreviewSwitcher from "@/components/RolePreviewSwitcher";
import { cn } from "@/lib/utils";

export default function AdminLayout() {
  const { signOut, profile, isTechLead, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Tech leads get a filtered nav
  const navItems = [];

  if (isTechLead && !isAdmin && !isSuperAdmin) {
    navItems.push(
      { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
      { to: "/admin/tasks", label: "Tasks", icon: ListTodo },
      { to: "/admin/escalations", label: "Escalations", icon: AlertTriangle },
      { to: "/admin/specialists", label: "Specialists", icon: UserCog },
    );
  } else {
    navItems.push(
      { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
      { to: "/admin/clients", label: "Clients", icon: Users },
      { to: "/admin/specialists", label: "Specialists", icon: UserCog },
      { to: "/admin/tasks", label: "Tasks", icon: ListTodo },
      { to: "/admin/billing", label: "Billing", icon: CreditCard },
    );
    if (isSuperAdmin) {
      navItems.push({ to: "/admin/performance", label: "Team Performance", icon: BarChart3 });
    }
  }

  const roleLabel = isSuperAdmin ? "Super Admin" : isTechLead ? "Tech Lead" : "Admin";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground font-display">A</span>
          </div>
          <span className="text-lg font-semibold text-foreground font-display">Arcytex {roleLabel}</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
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
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 text-sm">
            <p className="font-medium text-foreground truncate">{profile?.full_name || roleLabel}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-end gap-2 px-4 py-3 md:px-8">
          <RolePreviewSwitcher />
          <NotificationCentre />
        </div>
        <div className="radial-glow mx-auto max-w-7xl px-4 pb-8 md:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
