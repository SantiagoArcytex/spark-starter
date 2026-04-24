import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const views = [
  { label: "Client View", path: "/dashboard" },
  { label: "Specialist View", path: "/specialist/tasks" },
  { label: "Admin View", path: "/admin/tasks" },
];

export default function RolePreviewSwitcher() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAdmin && !isSuperAdmin) return null;

  const currentView = location.pathname.startsWith("/admin")
    ? "Admin View"
    : location.pathname.startsWith("/specialist")
    ? "Specialist View"
    : "Client View";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Eye className="h-3.5 w-3.5" />
          {currentView}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {views.map((v) => (
          <DropdownMenuItem
            key={v.path}
            onClick={() => navigate(v.path)}
            className={currentView === v.label ? "bg-accent" : ""}
          >
            {v.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
