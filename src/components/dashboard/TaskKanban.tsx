import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
}

const columns = [
  { key: "submitted", label: "Submitted", color: "bg-muted" },
  { key: "in_review", label: "In Review", color: "bg-primary/10" },
  { key: "in_progress", label: "In Progress", color: "bg-warning/10" },
  { key: "awaiting_input", label: "Awaiting Input", color: "bg-destructive/10" },
  { key: "completed", label: "Completed", color: "bg-success/10" },
];

export default function TaskKanban({ tasks }: { tasks: Task[] }) {
  const navigate = useNavigate();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className="min-w-[240px] flex-1 rounded-xl border border-border bg-card/50 p-3"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", col.color)} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {col.label}
              </span>
              <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                {colTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/30 hover:shadow-[0_0_12px_-4px_hsl(var(--glow-color)/0.15)]"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {task.name}
                  </p>
                  {task.estimated_hours != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.estimated_hours}h est.
                    </p>
                  )}
                </button>
              ))}
              {colTasks.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground/50">
                  No tasks
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
