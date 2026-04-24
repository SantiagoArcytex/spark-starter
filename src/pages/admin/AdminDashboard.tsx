import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, ListTodo, DollarSign, TrendingUp, AlertTriangle, Zap, ArrowRight, 
  Clock, UserPlus, BarChart3 
} from "lucide-react";
import { startOfMonth, startOfWeek, subWeeks, isAfter } from "date-fns";

interface ClientRow {
  id: string;
  user_id: string;
  hours_purchased: number;
  hours_used: number;
  current_rate: number;
  monthly_allocation: number | null;
  health_status: string | null;
  client_since: string | null;
  rollover_hours: number | null;
}

interface TaskRow {
  id: string;
  name: string;
  status: string;
  at_risk: boolean;
  is_urgent: boolean;
  created_at: string;
  estimated_hours: number | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  company: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [billedThisMonth, setBilledThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [clientsRes, tasksRes, profilesRes] = await Promise.all([
        supabase.from("client_accounts").select("*"),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, company"),
      ]);
      if (clientsRes.data) setClients(clientsRes.data as any);
      if (tasksRes.data) setTasks(tasksRes.data as any);
      if (profilesRes.data) setProfiles(profilesRes.data);

      // Billed revenue this month from time_logs
      const monthStart = startOfMonth(new Date()).toISOString();
      const { data: logs } = await supabase
        .from("time_logs")
        .select("hours, task_id")
        .eq("billable", true)
        .gte("logged_at", monthStart);

      if (logs && clientsRes.data) {
        // For simplicity, sum billable hours × average rate
        const avgRate = clientsRes.data.length > 0
          ? clientsRes.data.reduce((s, c) => s + (c as any).current_rate, 0) / clientsRes.data.length
          : 100;
        setBilledThisMonth(logs.reduce((s, l) => s + l.hours, 0) * avgRate);
      }

      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(weekStart, 1);

  const newClientsThisMonth = clients.filter(
    (c) => c.client_since && isAfter(new Date(c.client_since), monthStart)
  ).length;

  const tasksThisWeek = tasks.filter((t) => isAfter(new Date(t.created_at), weekStart)).length;
  const tasksLastWeek = tasks.filter(
    (t) => isAfter(new Date(t.created_at), lastWeekStart) && !isAfter(new Date(t.created_at), weekStart)
  ).length;
  const tasksThisMonth = tasks.filter((t) => isAfter(new Date(t.created_at), monthStart)).length;

  const weekDelta = tasksLastWeek > 0 ? ((tasksThisWeek - tasksLastWeek) / tasksLastWeek) * 100 : 0;

  const mrr = clients.reduce((s, c) => s + (c.monthly_allocation || 10) * c.current_rate, 0);

  const totalBilledHours = clients.reduce((s, c) => s + c.hours_used, 0);

  const atRiskTasks = tasks.filter((t) => t.at_risk);
  const pendingTasks = tasks.filter((t) => t.status === "submitted" || t.status === "ready_for_review");

  const clientsNeedingAttention = clients.filter((c) => {
    if (c.health_status && c.health_status !== "healthy") return true;
    const total = c.hours_purchased + (c.rollover_hours || 0);
    if (total > 0 && c.hours_used / total > 0.9) return true;
    return false;
  });

  const getClientName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.company || p?.full_name || "Unknown";
  };

  // Active hours demand
  const activeEstimated = tasks
    .filter((t) => ["in_progress", "in_review", "submitted"].includes(t.status))
    .reduce((s, t) => s + (t.estimated_hours || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Business performance at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gradient-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-3xl font-bold text-foreground font-display">{clients.length}</p>
                {newClientsThisMonth > 0 && (
                  <p className="text-xs text-success flex items-center gap-1 mt-1">
                    <UserPlus className="h-3 w-3" /> +{newClientsThisMonth} this month
                  </p>
                )}
              </div>
              <Users className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks This Week</p>
                <p className="text-3xl font-bold text-foreground font-display">{tasksThisWeek}</p>
                <p className={`text-xs flex items-center gap-1 mt-1 ${weekDelta >= 0 ? "text-success" : "text-destructive"}`}>
                  <TrendingUp className="h-3 w-3" />
                  {weekDelta >= 0 ? "+" : ""}{weekDelta.toFixed(0)}% vs last week
                </p>
              </div>
              <ListTodo className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                <p className="text-3xl font-bold text-foreground font-display">${mrr.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{tasksThisMonth} tasks this month</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billed This Month</p>
                <p className="text-3xl font-bold text-foreground font-display">${billedThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalBilledHours.toFixed(1)}h total billed</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity indicator */}
      {activeEstimated > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm font-medium text-foreground">Active Hours Demand</p>
              <p className="text-xs text-muted-foreground">
                {activeEstimated.toFixed(1)}h estimated across {tasks.filter((t) => ["in_progress", "in_review", "submitted"].includes(t.status)).length} active tasks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold text-foreground font-display">{activeEstimated.toFixed(0)}h</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clients Needing Attention */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Clients Needing Attention
            </CardTitle>
            <CardDescription>{clientsNeedingAttention.length} client(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {clientsNeedingAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All clients are in good standing</p>
            ) : (
              <div className="space-y-2">
                {clientsNeedingAttention.slice(0, 5).map((c) => {
                  const total = c.hours_purchased + (c.rollover_hours || 0);
                  const usage = total > 0 ? (c.hours_used / total) * 100 : 0;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:border-warning/30 transition-colors"
                      onClick={() => navigate(`/admin/clients/${c.id}`)}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{getClientName(c.user_id)}</p>
                        <p className="text-xs text-muted-foreground">{usage.toFixed(0)}% usage · {c.health_status}</p>
                      </div>
                      <Badge variant="secondary" className="bg-warning/10 text-warning">{c.health_status || "high usage"}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* At Risk Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-destructive" /> At Risk Tasks
            </CardTitle>
            <CardDescription>{atRiskTasks.length} escalated</CardDescription>
          </CardHeader>
          <CardContent>
            {atRiskTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No at-risk tasks</p>
            ) : (
              <div className="space-y-2">
                {atRiskTasks.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-destructive/20 p-3 cursor-pointer hover:border-destructive/40 transition-colors"
                    onClick={() => navigate(`/admin/tasks/${t.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">At Risk</Badge>
                  </div>
                ))}
                {atRiskTasks.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/admin/escalations")}>
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      {pendingTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending Approvals</CardTitle>
            <CardDescription>{pendingTasks.length} task(s) waiting for action</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTasks.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:border-primary/20 transition-colors"
                  onClick={() => navigate(`/admin/tasks/${t.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {t.status === "ready_for_review" ? "Ready for Review" : "Submitted"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
