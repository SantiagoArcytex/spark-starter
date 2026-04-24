import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ListTodo, Zap, ArrowUpRight, Clock, Plus, X } from "lucide-react";

const statusLabels: Record<string, string> = {
  submitted: "Needs Estimate",
  in_review: "In Review",
  in_progress: "In Progress",
  awaiting_input: "Awaiting Input",
  completed: "Completed",
  declined: "Declined",
};

const statusColors: Record<string, string> = {
  submitted: "bg-warning/10 text-warning",
  in_review: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  awaiting_input: "bg-destructive/10 text-destructive",
  completed: "bg-success/10 text-success",
  declined: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-destructive/10 text-destructive",
};

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  is_urgent: boolean;
  estimated_hours: number | null;
  actual_hours: number | null;
  client_account_id: string;
  created_at: string;
  client_name?: string;
  logged_hours?: number;
}

export default function SpecialistTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickLogTaskId, setQuickLogTaskId] = useState<string | null>(null);
  const [quickHours, setQuickHours] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const fetchTasks = async () => {
    if (!user) return;

    // Get assigned client_account_ids from client_specialists
    const { data: csAssignments } = await supabase
      .from("client_specialists")
      .select("client_account_id")
      .eq("specialist_id", user.id);
    const assignedAccountIds = (csAssignments || []).map(a => a.client_account_id);

    // Get tasks where specialist is primary assignee
    const { data: primaryTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_specialist_id", user.id)
      .order("created_at", { ascending: false });

    // Get tasks where specialist is secondary (via task_specialists)
    const { data: secondaryAssignments } = await supabase
      .from("task_specialists")
      .select("task_id")
      .eq("specialist_id", user.id);

    const existingTaskIds = new Set((primaryTasks || []).map((t: any) => t.id));

    const secondaryTaskIds = (secondaryAssignments || [])
      .map((a) => a.task_id)
      .filter((id) => !existingTaskIds.has(id));

    // Get tasks from assigned clients (via client_specialists)
    let clientTasks: any[] = [];
    if (assignedAccountIds.length > 0) {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .in("client_account_id", assignedAccountIds)
        .order("created_at", { ascending: false });
      clientTasks = (data || []).filter(t => !existingTaskIds.has(t.id));
      clientTasks.forEach(t => existingTaskIds.add(t.id));
    }

    let secondaryTasks: any[] = [];
    if (secondaryTaskIds.length > 0) {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .in("id", secondaryTaskIds.filter(id => !existingTaskIds.has(id)))
        .order("created_at", { ascending: false });
      secondaryTasks = data || [];
    }

    const tasksData = [...(primaryTasks || []), ...clientTasks, ...secondaryTasks];

    if (!tasksData) { setLoading(false); return; }

    // Get client names
    const accountIds = [...new Set(tasksData.map((t: any) => t.client_account_id))];
    const { data: accounts } = await supabase.from("client_accounts").select("id, user_id").in("id", accountIds);

    let profileMap: Record<string, string> = {};
    if (accounts) {
      const userIds = accounts.map((a) => a.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      if (profiles) {
        const userToName = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name || "Unknown"]));
        profileMap = Object.fromEntries(accounts.map((a) => [a.id, userToName[a.user_id] || "Unknown"]));
      }
    }

    // Get logged hours per task
    const taskIds = tasksData.map((t: any) => t.id);
    const { data: timeLogs } = await supabase
      .from("time_logs")
      .select("task_id, hours")
      .eq("specialist_id", user.id)
      .in("task_id", taskIds);

    const hoursMap: Record<string, number> = {};
    if (timeLogs) {
      timeLogs.forEach((l) => {
        if (l.task_id) hoursMap[l.task_id] = (hoursMap[l.task_id] || 0) + l.hours;
      });
    }

    setTasks(
      tasksData.map((t: any) => ({
        ...t,
        client_name: profileMap[t.client_account_id] || "Unknown Client",
        logged_hours: hoursMap[t.id] || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const handleQuickLog = async (taskId: string) => {
    if (!user || !quickHours) return;
    setQuickSubmitting(true);
    const { error } = await supabase.from("time_logs").insert({
      task_id: taskId,
      specialist_id: user.id,
      hours: parseFloat(quickHours),
      description: quickDesc.trim() || null,
      billable: true,
      activity_type: "task",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Hours logged", description: `${quickHours}h logged successfully.` });
      setQuickLogTaskId(null);
      setQuickHours("");
      setQuickDesc("");
      fetchTasks();
    }
    setQuickSubmitting(false);
  };

  const filtered = filterStatus === "all" ? tasks : tasks.filter((t) => t.status === filterStatus);
  const needsEstimate = tasks.filter((t) => t.status === "submitted" && !t.is_urgent);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {needsEstimate.length > 0 && (
            <span className="text-warning font-medium">{needsEstimate.length} task(s) need estimates · </span>
          )}
          {tasks.length} total tasks assigned
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(statusLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListTodo className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No tasks found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <Card key={task.id} className="transition-colors hover:border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/specialist/tasks/${task.id}`)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{task.name}</p>
                      {task.is_urgent && (
                        <Badge className="bg-warning/10 text-warning gap-1" variant="secondary">
                          <Zap className="h-3 w-3" /> Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{task.client_name}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {(task.logged_hours || 0).toFixed(1)}h logged
                        {task.estimated_hours != null && ` / ${task.estimated_hours}h est.`}
                      </span>
                      <span>{new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={priorityColors[task.priority] || ""} variant="secondary">
                      {task.priority}
                    </Badge>
                    <Badge className={statusColors[task.status] || ""} variant="secondary">
                      {statusLabels[task.status] || task.status}
                    </Badge>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                {/* Quick log button */}
                {task.status !== "completed" && task.status !== "declined" && (
                  <div className="mt-3 border-t border-border pt-3">
                    {quickLogTaskId === task.id ? (
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Input
                            type="number"
                            step="0.25"
                            min="0.25"
                            placeholder="Hours"
                            value={quickHours}
                            onChange={(e) => setQuickHours(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex-[2] space-y-1">
                          <Textarea
                            placeholder="What did you work on?"
                            value={quickDesc}
                            onChange={(e) => setQuickDesc(e.target.value)}
                            className="h-8 min-h-8 text-sm resize-none"
                            rows={1}
                          />
                        </div>
                        <Button size="sm" onClick={() => handleQuickLog(task.id)} disabled={quickSubmitting || !quickHours}>
                          Log
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setQuickLogTaskId(null); setQuickHours(""); setQuickDesc(""); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setQuickLogTaskId(task.id); }}
                      >
                        <Plus className="h-3 w-3" /> Quick log hours
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
