import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SpecialistPerf {
  user_id: string;
  full_name: string | null;
  salary: number | null;
  health_score: number | null;
  start_date: string | null;
  totalHours: number;
  billableHours: number;
  taskCount: number;
}

export default function AdminPerformance() {
  const [specialists, setSpecialists] = useState<SpecialistPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "specialist");
      if (!roles) { setLoading(false); return; }
      const specIds = roles.map((r) => r.user_id);

      const [profilesRes, logsRes, tasksRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, salary, health_score, start_date").in("user_id", specIds),
        supabase.from("time_logs").select("specialist_id, hours, billable").in("specialist_id", specIds),
        supabase.from("tasks").select("assigned_specialist_id").in("assigned_specialist_id", specIds),
      ]);

      const profiles = profilesRes.data || [];
      const logs = logsRes.data || [];
      const tasks = tasksRes.data || [];

      setSpecialists(
        profiles.map((p) => {
          const specLogs = logs.filter((l) => l.specialist_id === p.user_id);
          return {
            user_id: p.user_id,
            full_name: p.full_name,
            salary: p.salary,
            health_score: p.health_score,
            start_date: p.start_date,
            totalHours: specLogs.reduce((s, l) => s + l.hours, 0),
            billableHours: specLogs.filter((l) => l.billable).reduce((s, l) => s + l.hours, 0),
            taskCount: tasks.filter((t) => t.assigned_specialist_id === p.user_id).length,
          };
        })
      );
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const totalSalary = specialists.reduce((s, sp) => s + (sp.salary || 0), 0);
  const totalBillable = specialists.reduce((s, sp) => s + sp.billableHours, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Team Performance</h1>
        <p className="text-sm text-muted-foreground">Specialist performance, salaries, and utilization</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-foreground">{specialists.length}</p>
          <p className="text-sm text-muted-foreground">Active Specialists</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-foreground">${totalSalary.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total Monthly Salary</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-primary">{totalBillable.toFixed(1)}h</p>
          <p className="text-sm text-muted-foreground">Total Billable Hours</p>
        </CardContent></Card>
      </div>

      <div className="space-y-4">
        {specialists.map((sp) => {
          const efficiency = sp.totalHours > 0 ? (sp.billableHours / sp.totalHours) * 100 : 0;
          return (
            <Card key={sp.user_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-foreground">{sp.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">
                      {sp.start_date ? `Since ${new Date(sp.start_date).toLocaleDateString()}` : "No start date"} · {sp.taskCount} tasks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">${(sp.salary || 0).toLocaleString()}/mo</p>
                    <Badge variant="secondary" className={sp.health_score && sp.health_score >= 70 ? "bg-success/10 text-success" : sp.health_score && sp.health_score >= 40 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}>
                      Health: {sp.health_score ?? "N/A"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Efficiency (billable/total)</span>
                    <span>{efficiency.toFixed(0)}% — {sp.billableHours.toFixed(1)}h / {sp.totalHours.toFixed(1)}h</span>
                  </div>
                  <Progress value={efficiency} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
