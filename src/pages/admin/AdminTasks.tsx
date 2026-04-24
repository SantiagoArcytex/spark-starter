import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ListTodo, TrendingUp, Clock, AlertTriangle, Users } from "lucide-react";

const statusLabels: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In Review",
  in_progress: "In Progress",
  awaiting_input: "Awaiting Input",
  ready_for_review: "Ready for Review",
  completed: "Completed",
  declined: "Declined",
};

const statusColors: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  in_review: "bg-primary/10 text-primary",
  in_progress: "bg-warning/10 text-warning",
  awaiting_input: "bg-destructive/10 text-destructive",
  ready_for_review: "bg-accent/10 text-accent-foreground",
  completed: "bg-success/10 text-success",
  declined: "bg-destructive/10 text-destructive",
};

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  estimated_hours: number | null;
  actual_hours: number | null;
  client_account_id: string;
  assigned_specialist_id: string | null;
  created_at: string;
}

interface ClientAccount {
  id: string;
  user_id: string;
  profile?: { full_name: string | null };
}

interface SpecialistOption {
  user_id: string;
  full_name: string | null;
}

export default function AdminTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [taskName, setTaskName] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskHours, setTaskHours] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedSpecialist, setSelectedSpecialist] = useState("");
  const [creating, setCreating] = useState(false);

  // KPI data
  const [totalBillableHours, setTotalBillableHours] = useState(0);

  const fetchData = async () => {
    const [tasksRes, accountsRes, rolesRes, logsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("client_accounts").select("id, user_id"),
      supabase.from("user_roles").select("user_id").eq("role", "specialist"),
      supabase.from("time_logs").select("hours, billable, logged_at").eq("billable", true),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (logsRes.data) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthHours = logsRes.data
        .filter((l) => new Date(l.logged_at) >= startOfMonth)
        .reduce((s, l) => s + l.hours, 0);
      setTotalBillableHours(thisMonthHours);
    }

    if (accountsRes.data) {
      const userIds = accountsRes.data.map((a) => a.user_id);
      const specIds = (rolesRes.data || []).map((r) => r.user_id);
      const allIds = [...new Set([...userIds, ...specIds])];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", allIds);

      setClients(accountsRes.data.map((a) => ({
        ...a,
        profile: profiles?.find((p) => p.user_id === a.user_id) || undefined,
      })));

      setSpecialists(specIds.map((uid) => ({
        user_id: uid,
        full_name: profiles?.find((p) => p.user_id === uid)?.full_name || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!user || !selectedClient || !taskName) return;
    setCreating(true);
    const { error } = await supabase.from("tasks").insert({
      name: taskName,
      description: taskDesc || null,
      estimated_hours: taskHours ? parseFloat(taskHours) : null,
      client_account_id: selectedClient,
      assigned_specialist_id: selectedSpecialist || null,
      created_by: user.id,
      status: "submitted",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task created", description: "Sent to client for approval." });
      setDialogOpen(false);
      setTaskName(""); setTaskDesc(""); setTaskHours(""); setSelectedClient(""); setSelectedSpecialist("");
      fetchData();
    }
    setCreating(false);
  };

  const updateStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status: status as any }).eq("id", taskId);
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // KPI calculations
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tasksThisMonth = tasks.filter((t) => new Date(t.created_at) >= startOfMonth).length;
  const activeTasks = tasks.filter((t) => ["in_review", "in_progress", "awaiting_input", "ready_for_review"].includes(t.status));
  const activeHoursDemand = activeTasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);

  // Capacity: specialists count × ~160h/month, utilization = billable hours / capacity
  const specCount = specialists.length || 1;
  const monthlyCapacity = specCount * 160;
  const utilizationPct = monthlyCapacity > 0 ? (totalBillableHours / monthlyCapacity) * 100 : 0;
  const needsHiring = utilizationPct > 80;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Task Manager</h1>
          <p className="text-sm text-muted-foreground">Create and manage tasks across clients</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>Assign a new task to a client for approval</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.profile?.full_name || c.user_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign specialist</Label>
                <Select value={selectedSpecialist} onValueChange={setSelectedSpecialist}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {specialists.map((sp) => (
                      <SelectItem key={sp.user_id} value={sp.user_id}>{sp.full_name || sp.user_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Task name</Label>
                <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g. Workflow automation setup" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Scope of work…" />
              </div>
              <div className="space-y-2">
                <Label>Estimated hours</Label>
                <Input type="number" step="0.5" value={taskHours} onChange={(e) => setTaskHours(e.target.value)} placeholder="e.g. 5" />
              </div>
              <Button onClick={handleCreate} disabled={creating || !taskName || !selectedClient} className="w-full">
                {creating ? "Creating…" : "Create & send for approval"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Tasks This Month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{tasksThisMonth}</p>
            <p className="text-xs text-muted-foreground">{activeTasks.length} active now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" /> Active Hours Demand</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{activeHoursDemand.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">Estimated across active tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" /> Team Utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${utilizationPct > 80 ? "text-warning" : "text-foreground"}`}>{utilizationPct.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">{totalBillableHours.toFixed(1)}h / {monthlyCapacity}h capacity</p>
          </CardContent>
        </Card>
        {needsHiring && (
          <Card className="border-warning/30">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-warning" /> Capacity Alert</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-warning">Consider hiring</p>
              <p className="text-xs text-muted-foreground">Team utilization exceeds 80%</p>
            </CardContent>
          </Card>
        )}
      </div>

      {tasks.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <ListTodo className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No tasks yet. Create one to get started.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="cursor-pointer transition-all hover:border-primary/20" onClick={() => navigate(`/admin/tasks/${task.id}`)}>
              <CardContent className="flex items-center gap-4 p-4" onClick={(e) => e.stopPropagation()}>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/admin/tasks/${task.id}`)}>
                  <p className="font-medium text-foreground">{task.name}</p>
                  {task.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{task.description}</p>}
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    {task.estimated_hours != null && <span>{task.estimated_hours}h est.</span>}
                    {task.actual_hours != null && task.actual_hours > 0 && <span>{task.actual_hours}h logged</span>}
                    <span>{new Date(task.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Select value={task.status} onValueChange={(v) => updateStatus(task.id, v)}>
                  <SelectTrigger className="w-44">
                    <Badge className={statusColors[task.status]} variant="secondary">
                      {statusLabels[task.status] || task.status}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
