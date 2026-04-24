import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, TrendingUp, Clock, AlertTriangle, Plus } from "lucide-react";

interface SpecialistData {
  user_id: string;
  full_name: string | null;
  email: string | null;
  total_hours: number;
  billable_hours: number;
  billable_pct: number;
  active_tasks: number;
  completed_tasks: number;
  efficiency_score: number;
  revenue_generated: number;
}

export default function AdminSpecialists() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [specialists, setSpecialists] = useState<SpecialistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Add specialist form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [salaryVal, setSalaryVal] = useState("");
  const [bio, setBio] = useState("");
  const [certification, setCertification] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "specialist");
    if (!roles || roles.length === 0) { setLoading(false); return; }
    const specIds = roles.map(r => r.user_id);

    const [profilesRes, logsRes, tasksRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").in("user_id", specIds),
      supabase.from("time_logs").select("specialist_id, hours, billable, task_id").in("specialist_id", specIds),
      supabase.from("tasks").select("id, assigned_specialist_id, status, estimated_hours, actual_hours").in("assigned_specialist_id", specIds),
    ]);

    const profiles = profilesRes.data || [];
    const logs = logsRes.data || [];
    const tasks = tasksRes.data || [];

    const { data: accounts } = await supabase.from("client_accounts").select("id, current_rate");
    const { data: taskAccounts } = await supabase.from("tasks").select("id, client_account_id").in("assigned_specialist_id", specIds);
    const accountRateMap: Record<string, number> = {};
    (accounts || []).forEach(a => { accountRateMap[a.id] = a.current_rate; });
    const taskAccountMap: Record<string, string> = {};
    (taskAccounts || []).forEach(t => { taskAccountMap[t.id] = t.client_account_id; });

    const result: SpecialistData[] = specIds.map(uid => {
      const profile = profiles.find(p => p.user_id === uid);
      const specLogs = logs.filter(l => l.specialist_id === uid);
      const specTasks = tasks.filter(t => t.assigned_specialist_id === uid);
      const total_hours = specLogs.reduce((s, l) => s + l.hours, 0);
      const billable_hours = specLogs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0);
      const billable_pct = total_hours > 0 ? (billable_hours / total_hours) * 100 : 0;
      const active_tasks = specTasks.filter(t => !["completed", "declined"].includes(t.status)).length;
      const completed_tasks = specTasks.filter(t => t.status === "completed").length;
      const estimated_completed = specTasks.filter(t => t.status === "completed" && t.estimated_hours != null && t.estimated_hours > 0);
      const on_estimate_count = estimated_completed.filter(t => (t.actual_hours || 0) <= (t.estimated_hours || 0)).length;
      const on_estimate_pct = estimated_completed.length > 0 ? (on_estimate_count / estimated_completed.length) * 100 : 0;
      const efficiency_score = (billable_pct / 100) * (on_estimate_pct / 100) * 100;

      let revenue_generated = 0;
      const billableByTask: Record<string, number> = {};
      specLogs.filter(l => l.billable).forEach(l => { billableByTask[l.task_id] = (billableByTask[l.task_id] || 0) + l.hours; });
      Object.entries(billableByTask).forEach(([taskId, hrs]) => {
        const accountId = taskAccountMap[taskId];
        const rate = accountId ? accountRateMap[accountId] || 100 : 100;
        revenue_generated += hrs * rate;
      });

      return { user_id: uid, full_name: profile?.full_name || null, email: profile?.email || null, total_hours, billable_hours, billable_pct, active_tasks, completed_tasks, efficiency_score, revenue_generated };
    });

    setSpecialists(result);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddSpecialist = async () => {
    if (!email || !fullName) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-specialist", {
        body: { email, full_name: fullName, start_date: startDate || null, salary: salaryVal ? parseFloat(salaryVal) : null, bio, certification },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Specialist created", description: `${fullName} has been added. A password reset email was sent.` });
      setDialogOpen(false);
      setEmail(""); setFullName(""); setStartDate(""); setSalaryVal(""); setBio(""); setCertification("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const totalBillable = specialists.reduce((s, sp) => s + sp.billable_hours, 0);
  const totalHours = specialists.reduce((s, sp) => s + sp.total_hours, 0);
  const totalRevenue = specialists.reduce((s, sp) => s + sp.revenue_generated, 0);
  const avgEfficiency = specialists.length > 0 ? specialists.reduce((s, sp) => s + sp.efficiency_score, 0) / specialists.length : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Specialists</h1>
          <p className="text-sm text-muted-foreground">Utilization, efficiency, and profitability overview</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Specialist</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Specialist</DialogTitle>
              <DialogDescription>Create a specialist account. They'll receive a password reset email.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="spec@arcytex.com" /></div>
                <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>Salary ($/mo)</Label><Input type="number" value={salaryVal} onChange={e => setSalaryVal(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Certification</Label><Input value={certification} onChange={e => setCertification(e.target.value)} placeholder="e.g. GHL Certified" /></div>
              <div className="space-y-2"><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Short bio…" rows={2} /></div>
              <Button onClick={handleAddSpecialist} disabled={creating || !email || !fullName} className="w-full">
                {creating ? "Creating…" : "Create Specialist"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" />Team Size</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold text-foreground">{specialists.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" />Total Hours</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold text-foreground">{totalHours.toFixed(1)}h</p><p className="text-xs text-muted-foreground">{totalBillable.toFixed(1)}h billable</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Revenue</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Avg Efficiency</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold text-foreground">{avgEfficiency.toFixed(0)}%</p><p className="text-xs text-muted-foreground">billable % × on-estimate %</p></CardContent></Card>
      </div>

      {/* Specialist list */}
      {specialists.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="text-muted-foreground">No specialists registered yet</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {specialists.map(sp => {
            const isIdle = sp.active_tasks === 0 && sp.total_hours > 0;
            return (
              <Card
                key={sp.user_id}
                className={`cursor-pointer transition-all hover:border-primary/20 hover:shadow-lg ${isIdle ? "border-warning/40" : ""}`}
                onClick={() => navigate(`/admin/specialists/${sp.user_id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div><CardTitle className="text-base">{sp.full_name || "Unnamed"}</CardTitle><CardDescription>{sp.email}</CardDescription></div>
                    <div className="flex gap-1.5">
                      {isIdle && <Badge variant="outline" className="border-warning text-warning gap-1"><AlertTriangle className="h-3 w-3" /> Idle</Badge>}
                      <Badge variant="secondary">{sp.active_tasks} active</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Billable utilization</span><span className="font-medium">{sp.billable_pct.toFixed(0)}%</span></div>
                    <Progress value={sp.billable_pct} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <div><span className="text-muted-foreground">Efficiency: </span><span className="font-semibold">{sp.efficiency_score.toFixed(0)}%</span></div>
                    <div><span className="text-muted-foreground">Revenue: </span><span className="font-semibold">${sp.revenue_generated.toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Done: </span><span className="font-semibold">{sp.completed_tasks}</span></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
