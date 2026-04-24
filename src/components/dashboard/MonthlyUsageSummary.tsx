import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MonthData {
  tasksCompleted: number;
  hoursUsed: number;
  totalSpend: number;
}

export default function MonthlyUsageSummary({ rate }: { rate: number }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState<MonthData>({ tasksCompleted: 0, hoursUsed: 0, totalSpend: 0 });
  const [previous, setPrevious] = useState<MonthData>({ tasksCompleted: 0, hoursUsed: 0, totalSpend: 0 });

  useEffect(() => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const fetchMonthly = async () => {
      // Current month tasks completed
      const [curTasks, prevTasks, curLogs, prevLogs] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact" })
          .eq("status", "completed")
          .gte("updated_at", startOfMonth),
        supabase
          .from("tasks")
          .select("id", { count: "exact" })
          .eq("status", "completed")
          .gte("updated_at", startOfPrevMonth)
          .lt("updated_at", startOfMonth),
        supabase
          .from("time_logs")
          .select("hours")
          .gte("logged_at", startOfMonth),
        supabase
          .from("time_logs")
          .select("hours")
          .gte("logged_at", startOfPrevMonth)
          .lt("logged_at", startOfMonth),
      ]);

      const curHours = (curLogs.data || []).reduce((s, l) => s + Number(l.hours), 0);
      const prevHours = (prevLogs.data || []).reduce((s, l) => s + Number(l.hours), 0);

      setCurrent({
        tasksCompleted: curTasks.count || 0,
        hoursUsed: curHours,
        totalSpend: curHours * rate,
      });
      setPrevious({
        tasksCompleted: prevTasks.count || 0,
        hoursUsed: prevHours,
        totalSpend: prevHours * rate,
      });
    };

    fetchMonthly();
  }, [user, rate]);

  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  const TrendIcon = ({ value }: { value: number }) =>
    value > 0 ? (
      <TrendingUp className="h-3.5 w-3.5 text-primary" />
    ) : value < 0 ? (
      <TrendingDown className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
    );

  const metrics = [
    {
      label: "Tasks completed",
      value: current.tasksCompleted,
      delta: delta(current.tasksCompleted, previous.tasksCompleted),
    },
    {
      label: "Hours used",
      value: `${current.hoursUsed.toFixed(1)}h`,
      delta: delta(current.hoursUsed, previous.hoursUsed),
    },
    {
      label: "Spend",
      value: `$${current.totalSpend.toFixed(0)}`,
      delta: delta(current.totalSpend, previous.totalSpend),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          This Month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="space-y-1">
              <p className="text-2xl font-bold font-display text-foreground">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <div className="flex items-center gap-1">
                <TrendIcon value={m.delta} />
                <span className="text-xs text-muted-foreground">
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}% vs last month
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
