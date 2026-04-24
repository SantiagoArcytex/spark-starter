import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Clock, CreditCard, Gift, Heart, ListTodo, Plus, TrendingUp, User, Users, X, UserPlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const statusColors: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  in_review: "bg-primary/10 text-primary",
  in_progress: "bg-warning/10 text-warning",
  awaiting_input: "bg-destructive/10 text-destructive",
  ready_for_review: "bg-accent/10 text-accent-foreground",
  completed: "bg-success/10 text-success",
  declined: "bg-destructive/10 text-destructive",
};
const statusLabels: Record<string, string> = {
  submitted: "Submitted", in_review: "In Review", in_progress: "In Progress",
  awaiting_input: "Awaiting Input", ready_for_review: "Ready for Review", completed: "Completed", declined: "Declined",
};
const healthColors: Record<string, string> = {
  healthy: "bg-success/10 text-success",
  at_risk: "bg-warning/10 text-warning",
  unhappy: "bg-destructive/10 text-destructive",
};

export default function AdminClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [account, setAccount] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [hourBlocks, setHourBlocks] = useState<any[]>([]);
  const [hourCredits, setHourCredits] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [assignedSpecialists, setAssignedSpecialists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable state
  const [healthStatus, setHealthStatus] = useState("healthy");
  const [onboardingDate, setOnboardingDate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [assignedPm, setAssignedPm] = useState("");
  const [saving, setSaving] = useState(false);
  const [newSpecialistId, setNewSpecialistId] = useState("");

  // Credit dialog
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditHours, setCreditHours] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [crediting, setCrediting] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const fetch = async () => {
      const { data: acc } = await supabase.from("client_accounts").select("*").eq("id", clientId).single();
      if (!acc) { setLoading(false); return; }
      setAccount(acc);
      setHealthStatus(acc.health_status || "healthy");
      setOnboardingDate(acc.onboarding_date ? new Date(acc.onboarding_date).toISOString().slice(0, 10) : "");
      setAdminNotes(acc.admin_notes || "");
      setAssignedPm(acc.assigned_pm_id || "");

      const [profileRes, tasksRes, logsRes, blocksRes, creditsRes, specRolesRes, adminRolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", acc.user_id).single(),
        supabase.from("tasks").select("*").eq("client_account_id", clientId).order("created_at", { ascending: false }),
        supabase.from("time_logs").select("*").in("task_id", []),
        supabase.from("hour_blocks").select("*").eq("client_account_id", clientId).order("created_at", { ascending: false }),
        supabase.from("hour_credits").select("*").eq("client_account_id", clientId).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id").eq("role", "specialist"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (tasksRes.data) {
        setTasks(tasksRes.data);
        // Fetch time logs for these tasks
        if (tasksRes.data.length > 0) {
          const taskIds = tasksRes.data.map((t: any) => t.id);
          const { data: logs } = await supabase.from("time_logs").select("*").in("task_id", taskIds);
          if (logs) setTimeLogs(logs);
        }
      }
      if (blocksRes.data) setHourBlocks(blocksRes.data);
      if (creditsRes.data) setHourCredits(creditsRes.data);

      // Get specialist and admin profiles
      const allIds = [...(specRolesRes.data || []).map(r => r.user_id), ...(adminRolesRes.data || []).map(r => r.user_id)];
      if (allIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", allIds);
        const specIds = (specRolesRes.data || []).map(r => r.user_id);
        const adminIds = (adminRolesRes.data || []).map(r => r.user_id);
        setSpecialists((profiles || []).filter(p => specIds.includes(p.user_id)));
        setAdmins((profiles || []).filter(p => adminIds.includes(p.user_id)));
      }

      // Fetch assigned specialists from client_specialists table
      const { data: csData } = await supabase.from("client_specialists").select("specialist_id").eq("client_account_id", clientId);
      if (csData && csData.length > 0) {
        const csIds = csData.map(c => c.specialist_id);
        const { data: csProfiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", csIds);
        setAssignedSpecialists(csProfiles || []);
      }

      setLoading(false);
    };
    fetch();
  }, [clientId]);

  const saveDetails = async () => {
    if (!clientId) return;
    setSaving(true);
    await supabase.from("client_accounts").update({
      health_status: healthStatus,
      onboarding_date: onboardingDate || null,
      admin_notes: adminNotes || null,
      assigned_pm_id: assignedPm || null,
      assigned_specialist_id: assignedSpecialists.length > 0 ? assignedSpecialists[0].user_id : null,
    }).eq("id", clientId);
    toast({ title: "Saved", description: "Client details updated." });
    setSaving(false);
  };

  const addSpecialist = async () => {
    if (!clientId || !user || !newSpecialistId) return;
    if (assignedSpecialists.some(s => s.user_id === newSpecialistId)) {
      toast({ title: "Already assigned", variant: "destructive" });
      return;
    }
    await supabase.from("client_specialists").insert({
      client_account_id: clientId,
      specialist_id: newSpecialistId,
      assigned_by: user.id,
    });
    const spec = specialists.find(s => s.user_id === newSpecialistId);
    if (spec) setAssignedSpecialists(prev => [...prev, spec]);
    setNewSpecialistId("");
    toast({ title: "Specialist assigned" });
  };

  const removeSpecialist = async (specUserId: string) => {
    if (!clientId) return;
    await supabase.from("client_specialists").delete().eq("client_account_id", clientId).eq("specialist_id", specUserId);
    setAssignedSpecialists(prev => prev.filter(s => s.user_id !== specUserId));
    toast({ title: "Specialist removed" });
  };

  const creditClient = async () => {
    if (!clientId || !user || !creditHours || !creditReason) return;
    setCrediting(true);
    const hrs = parseFloat(creditHours);

    await supabase.from("hour_credits").insert({
      client_account_id: clientId,
      hours: hrs,
      reason: creditReason,
      credited_by: user.id,
    });

    // Update hours_purchased
    await supabase.from("client_accounts").update({
      hours_purchased: (account.hours_purchased || 0) + hrs,
    }).eq("id", clientId);

    // Notify client
    await supabase.from("notifications").insert({
      user_id: account.user_id,
      title: "Hours Credited",
      message: `You've been credited ${hrs} hours. Reason: ${creditReason}`,
      type: "billing",
    });

    toast({ title: "Hours credited", description: `${hrs}h added to client's balance.` });
    setCreditOpen(false);
    setCreditHours("");
    setCreditReason("");
    setCrediting(false);
    // Refresh
    setAccount({ ...account, hours_purchased: (account.hours_purchased || 0) + hrs });
    const { data: credits } = await supabase.from("hour_credits").select("*").eq("client_account_id", clientId).order("created_at", { ascending: false });
    if (credits) setHourCredits(credits);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!account) {
    return <div className="py-24 text-center"><p className="text-muted-foreground">Client not found</p></div>;
  }

  const hoursRemaining = (account.hours_purchased || 0) + (account.rollover_hours || 0) - (account.hours_used || 0);
  const usagePct = account.hours_purchased > 0 ? ((account.hours_used || 0) / (account.hours_purchased + (account.rollover_hours || 0))) * 100 : 0;
  const totalBillable = timeLogs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0);
  const totalNonBillable = timeLogs.filter(l => !l.billable).reduce((s, l) => s + l.hours, 0);

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clients")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">{profile?.full_name || "Unnamed Client"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.company || profile?.email}</p>
          <p className="text-xs text-muted-foreground mt-1">Client since {account.client_since ? new Date(account.client_since).toLocaleDateString() : "N/A"}</p>
        </div>
        <Select value={healthStatus} onValueChange={setHealthStatus}>
          <SelectTrigger className="w-36">
            <Badge className={healthColors[healthStatus]} variant="secondary">{healthStatus === "at_risk" ? "At Risk" : healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}</Badge>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="unhappy">Unhappy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Calendar className="h-4 w-4" />Onboarding Date</CardDescription></CardHeader>
          <CardContent>
            <Input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} className="text-sm" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" />Assigned Specialists</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {assignedSpecialists.length > 0 ? (
              <div className="space-y-2">
                {assignedSpecialists.map(s => (
                  <div key={s.user_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-sm text-foreground">{s.full_name || s.email}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeSpecialist(s.user_id)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No specialists assigned</p>
            )}
            <div className="flex gap-2">
              <Select value={newSpecialistId} onValueChange={setNewSpecialistId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add specialist…" /></SelectTrigger>
                <SelectContent>
                  {specialists.filter(s => !assignedSpecialists.some(a => a.user_id === s.user_id)).map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addSpecialist} disabled={!newSpecialistId}><UserPlus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" />Project Manager</CardDescription></CardHeader>
          <CardContent>
            <Select value={assignedPm} onValueChange={setAssignedPm}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {admins.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Rate</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">${account.current_rate}/hr</p>
            <p className="text-xs text-muted-foreground">{account.monthly_allocation}h/mo allocation</p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Admin Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes about this client..." rows={3} />
          <Button onClick={saveDetails} disabled={saving} size="sm">{saving ? "Saving…" : "Save Details"}</Button>
        </CardContent>
      </Card>

      {/* Hours & Billing */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Hours & Billing</CardTitle>
              <CardDescription>Balance, rollover, and billable breakdown</CardDescription>
            </div>
            <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1"><Gift className="h-4 w-4" /> Credit Hours</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Credit Hours</DialogTitle>
                  <DialogDescription>Add hours to this client's balance. They'll be notified.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Hours to credit</Label>
                    <Input type="number" step="0.5" value={creditHours} onChange={e => setCreditHours(e.target.value)} placeholder="e.g. 2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea value={creditReason} onChange={e => setCreditReason(e.target.value)} placeholder="e.g. Compensation for delayed delivery" />
                  </div>
                  <Button onClick={creditClient} disabled={crediting || !creditHours || !creditReason} className="w-full">
                    {crediting ? "Crediting…" : "Credit Hours"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{hoursRemaining.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{(account.rollover_hours || 0).toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Rolled Over</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{totalBillable.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Billable</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{totalNonBillable.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Non-Billable</p>
            </div>
          </div>
          <Progress value={Math.min(usagePct, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">{(account.hours_used || 0).toFixed(1)}h used of {((account.hours_purchased || 0) + (account.rollover_hours || 0)).toFixed(1)}h total</p>
        </CardContent>
      </Card>

      {/* Hour Credits Log */}
      {hourCredits.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Hour Credits</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hourCredits.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">+{c.hours}h credited</p>
                    <p className="text-xs text-muted-foreground">{c.reason}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      <Card>
        <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent>
          {hourBlocks.length > 0 ? (
            <div className="space-y-2">
              {hourBlocks.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.hours}h at ${b.rate}/hr</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">${b.total_amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tasks ({tasks.length})</CardTitle></CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/admin/tasks/${t.id}`)}
                  className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer transition-colors hover:border-primary/20 hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                      {t.estimated_hours != null && <span>{t.estimated_hours}h est.</span>}
                      {t.actual_hours != null && t.actual_hours > 0 && <span>{t.actual_hours}h logged</span>}
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge className={statusColors[t.status]} variant="secondary">{statusLabels[t.status] || t.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks submitted</p>
          )}
        </CardContent>
      </Card>

      {/* Billable Breakdown by Task */}
      {tasks.length > 0 && timeLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Billable Breakdown by Task</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2">Task</th>
                    <th className="pb-2">Estimated</th>
                    <th className="pb-2">Actual</th>
                    <th className="pb-2">Billable</th>
                    <th className="pb-2">Non-Billable</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.filter(t => timeLogs.some(l => l.task_id === t.id)).map(t => {
                    const logs = timeLogs.filter(l => l.task_id === t.id);
                    const billable = logs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0);
                    const nonBillable = logs.filter(l => !l.billable).reduce((s, l) => s + l.hours, 0);
                    return (
                      <tr key={t.id} className="border-b border-border/50">
                        <td className="py-2 font-medium text-foreground">{t.name}</td>
                        <td className="py-2 text-muted-foreground">{t.estimated_hours ?? "—"}h</td>
                        <td className="py-2 text-muted-foreground">{t.actual_hours ?? "—"}h</td>
                        <td className="py-2 text-success">{billable.toFixed(1)}h</td>
                        <td className="py-2 text-warning">{nonBillable.toFixed(1)}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
