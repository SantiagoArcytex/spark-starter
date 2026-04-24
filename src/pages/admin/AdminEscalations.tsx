import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap } from "lucide-react";

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  is_urgent: boolean;
  at_risk: boolean;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
}

export default function AdminEscalations() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("at_risk", true)
        .order("created_at", { ascending: false });
      if (data) setTasks(data as any);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Escalations</h1>
        <p className="text-sm text-muted-foreground">{tasks.length} task(s) flagged as at risk</p>
      </div>

      {tasks.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No escalated tasks — everything looks good!</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="cursor-pointer border-destructive/30 transition-all hover:border-destructive/50" onClick={() => navigate(`/admin/tasks/${task.id}`)}>
              <CardContent className="flex items-center gap-4 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{task.name}</p>
                    {task.is_urgent && (
                      <Badge className="bg-warning/10 text-warning gap-1" variant="secondary"><Zap className="h-3 w-3" /> Urgent</Badge>
                    )}
                  </div>
                  {task.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{task.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(task.created_at).toLocaleDateString()}</p>
                </div>
                <Badge className="bg-destructive/10 text-destructive" variant="secondary">At Risk</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
