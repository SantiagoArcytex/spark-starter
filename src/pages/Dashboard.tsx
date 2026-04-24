import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, AlertTriangle, CheckCircle, ArrowRight, TrendingUp, LayoutGrid, List, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SubmitTaskDialog from "@/components/SubmitTaskDialog";
import MonthlyUsageSummary from "@/components/dashboard/MonthlyUsageSummary";
import TaskKanban from "@/components/dashboard/TaskKanban";

interface ClientAccount {
  id: string;
  hours_purchased: number;
  hours_used: number;
  current_rate: number;
  rollover_hours?: number;
  monthly_allocation?: number;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  in_review: "bg-primary/10 text-primary",
  in_progress: "bg-warning/10 text-warning",
  awaiting_input: "bg-destructive/10 text-destructive",
  ready_for_review: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  declined: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In Review",
  in_progress: "In Progress",
  awaiting_input: "Awaiting Input",
  ready_for_review: "Ready for Review",
  completed: "Completed",
  declined: "Declined",
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [accountRes, tasksRes] = await Promise.all([
        supabase.from("client_accounts").select("*").eq("user_id", user.id).single(),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      ]);

      if (accountRes.data) {
        setAccount(accountRes.data);

        // Check onboarding status
        const { data: onb } = await supabase
          .from("client_onboarding")
          .select("completed_at")
          .eq("client_account_id", accountRes.data.id)
          .single();
        if (!onb || !onb.completed_at) {
          navigate("/onboarding");
          return;
        }
      }
      if (tasksRes.data) {
        setTasks(tasksRes.data);
        setPendingApprovals(
          tasksRes.data.filter((t) => t.status === "submitted" || t.status === "awaiting_input" || t.status === "ready_for_review")
        );
      }
      setLoading(false);
    };

    fetchData();

    const accountChannel = supabase
      .channel("dashboard-account")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "client_accounts" }, (payload) => {
        if (payload.new && (payload.new as any).user_id === user.id) setAccount(payload.new as any);
      })
      .subscribe();

    const taskChannel = supabase
      .channel("dashboard-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(accountChannel);
      supabase.removeChannel(taskChannel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const rolloverHours = account?.rollover_hours || 0;
  const totalAvailable = account ? account.hours_purchased + rolloverHours : 0;
  const hoursRemaining = account ? totalAvailable - account.hours_used : 0;
  const usagePercent = totalAvailable > 0
    ? ((account?.hours_used || 0) / totalAvailable) * 100
    : 0;

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your hour balance and active tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {/* One-click top-up */}
          {account && hoursRemaining < 5 && (
            <Button variant="outline" size="sm" onClick={() => navigate("/billing")} className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Top up
            </Button>
          )}
          {account && (
            <SubmitTaskDialog
              clientAccountId={account.id}
              onTaskCreated={() => window.location.reload()}
            />
          )}
        </div>
      </div>

      {/* Alert banners */}
      {usagePercent >= 90 && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">90% of hours used</AlertTitle>
          <AlertDescription>
            You've used {account?.hours_used}h of {account?.hours_purchased}h.{" "}
            <button onClick={() => navigate("/billing")} className="font-medium underline">Top up now</button>
          </AlertDescription>
        </Alert>
      )}
      {usagePercent >= 70 && usagePercent < 90 && (
        <Alert className="border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">70% of hours used</AlertTitle>
          <AlertDescription>
            Consider purchasing more hours.{" "}
            <button onClick={() => navigate("/billing")} className="font-medium underline">View billing</button>
          </AlertDescription>
        </Alert>
      )}

      {/* Monthly Usage Summary */}
      {account && <MonthlyUsageSummary rate={account.current_rate} />}

      {/* Top row: Hour Balance + Pending Approvals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gradient-border">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Hour Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {account ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground font-display">{hoursRemaining.toFixed(1)}</span>
                  <span className="text-lg text-muted-foreground">hrs remaining</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{account.hours_used.toFixed(1)}h used</span>
                  <span>{totalAvailable.toFixed(1)}h total</span>
                </div>
                {rolloverHours > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-success/5 px-3 py-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm text-success font-medium">{rolloverHours.toFixed(1)}h rolled over from previous period</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Current rate: ${account.current_rate}/hr</span>
                </div>
                <Button onClick={() => navigate("/billing")} className="w-full font-semibold">Top up hours</Button>
              </div>
            ) : (
              <div className="space-y-3 py-4 text-center">
                <p className="text-muted-foreground">No hour block purchased yet</p>
                <Button onClick={() => navigate("/billing")}>Purchase hours</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={pendingApprovals.length > 0 ? "gradient-border" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Pending Approvals
              </CardDescription>
              {pendingApprovals.length > 0 && (
                <Badge className="bg-primary text-primary-foreground">{pendingApprovals.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.estimated_hours}h est. · ${((task.estimated_hours || 0) * (account?.current_rate || 100)).toFixed(0)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/approvals")}>Review</Button>
                  </div>
                ))}
                {pendingApprovals.length > 3 && (
                  <Button variant="ghost" className="w-full text-primary" onClick={() => navigate("/approvals")}>
                    View all {pendingApprovals.length} approvals <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-success/50" />
                <p className="text-sm text-muted-foreground">All caught up — no pending approvals</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Tasks with view toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Active Tasks</CardTitle>
              <CardDescription>Your current and recent tasks</CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`rounded-md p-1.5 transition-colors ${viewMode === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            viewMode === "kanban" ? (
              <TaskKanban tasks={tasks} />
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-lg border border-border p-4 transition-all hover:border-primary/20 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{task.name}</p>
                      {task.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{task.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {task.estimated_hours != null && <span>{task.estimated_hours}h estimated</span>}
                        {task.actual_hours != null && task.actual_hours > 0 && (
                          <><span>·</span><span>{task.actual_hours}h logged</span></>
                        )}
                        <span>·</span>
                        <span>{new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge className={statusColors[task.status] || ""} variant="secondary">
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">No active tasks</p>
              <p className="text-sm text-muted-foreground">Your specialist is ready — submit your first task to get started.</p>
              {account && (
                <SubmitTaskDialog
                  clientAccountId={account.id}
                  onTaskCreated={() => window.location.reload()}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
