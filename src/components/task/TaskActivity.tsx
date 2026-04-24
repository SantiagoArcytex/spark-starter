import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, FileText, CheckCircle2, AlertTriangle, MessageSquare } from "lucide-react";

interface ActivityEvent {
  id: string;
  type: "approval" | "time_log" | "activity";
  description: string;
  actor_name: string;
  created_at: string;
  icon: "approval" | "time" | "status" | "message";
}

interface Subtask {
  title: string;
  completed: boolean;
}

interface TaskActivityProps {
  taskId: string;
}

export function TaskActivityTimeline({ taskId }: TaskActivityProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const allEvents: ActivityEvent[] = [];

      // Fetch approvals
      const { data: approvals } = await supabase
        .from("task_approvals")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (approvals) {
        const actorIds = [...new Set(approvals.map((a) => a.acted_by))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds);
        const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

        approvals.forEach((a) => {
          allEvents.push({
            id: `approval-${a.id}`,
            type: "approval",
            description: `${a.action === "approved" ? "Approved" : a.action === "declined" ? "Declined" : "Changes requested"}${a.comment ? `: ${a.comment}` : ""}`,
            actor_name: nameMap.get(a.acted_by) || "Unknown",
            created_at: a.created_at,
            icon: "approval",
          });
        });
      }

      // Fetch time logs
      const { data: logs } = await supabase
        .from("time_logs")
        .select("*")
        .eq("task_id", taskId)
        .order("logged_at", { ascending: false });

      if (logs) {
        const specIds = [...new Set(logs.map((l) => l.specialist_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", specIds);
        const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

        logs.forEach((l) => {
          allEvents.push({
            id: `log-${l.id}`,
            type: "time_log",
            description: `Logged ${l.hours}h${l.billable ? " (billable)" : " (non-billable)"}${l.description ? ` — ${l.description}` : ""}`,
            actor_name: nameMap.get(l.specialist_id) || "Unknown",
            created_at: l.logged_at,
            icon: "time",
          });
        });
      }

      // Fetch activity log entries
      const { data: activities } = await supabase
        .from("task_activity_log" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (activities) {
        const actorIds = [...new Set((activities as any[]).map((a: any) => a.actor_id))];
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", actorIds);
          const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

          (activities as any[]).forEach((a: any) => {
            allEvents.push({
              id: `activity-${a.id}`,
              type: "activity",
              description: a.action + (a.details ? ` — ${JSON.stringify(a.details)}` : ""),
              actor_name: nameMap.get(a.actor_id) || "Unknown",
              created_at: a.created_at,
              icon: "status",
            });
          });
        }
      }

      // Sort all by date desc
      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvents(allEvents);
      setLoading(false);
    };
    fetch();
  }, [taskId]);

  const iconMap = {
    approval: <CheckCircle2 className="h-4 w-4 text-success" />,
    time: <Clock className="h-4 w-4 text-primary" />,
    status: <AlertTriangle className="h-4 w-4 text-warning" />,
    message: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
  };

  if (loading) return <div className="py-6 text-center text-sm text-muted-foreground">Loading activity…</div>;

  if (events.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet</div>;
  }

  return (
    <div className="space-y-3 py-2">
      {events.map((e) => (
        <div key={e.id} className="flex gap-3 items-start">
          <div className="mt-0.5 shrink-0">{iconMap[e.icon]}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">{e.description}</p>
            <p className="text-xs text-muted-foreground">
              {e.actor_name} · {new Date(e.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SubtaskChecklistProps {
  taskId: string;
  subtasks: Subtask[];
  canEdit: boolean;
}

export function SubtaskChecklist({ taskId, subtasks: initial, canEdit }: SubtaskChecklistProps) {
  const [items, setItems] = useState<Subtask[]>(initial);

  const toggle = async (idx: number) => {
    if (!canEdit) return;
    const updated = items.map((s, i) => i === idx ? { ...s, completed: !s.completed } : s);
    setItems(updated);
    await supabase.from("tasks").update({ subtasks: updated } as any).eq("id", taskId);
  };

  const completed = items.filter((s) => s.completed).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Subtasks
          </span>
          <Badge variant="secondary" className="text-xs">
            {completed}/{items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((st, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 rounded-lg border border-border p-3 transition-colors cursor-pointer ${
                st.completed ? "bg-muted/30" : "hover:bg-muted/10"
              }`}
            >
              <Checkbox
                checked={st.completed}
                onCheckedChange={() => toggle(idx)}
                disabled={!canEdit}
              />
              <span className={`text-sm ${st.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {st.title}
              </span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
