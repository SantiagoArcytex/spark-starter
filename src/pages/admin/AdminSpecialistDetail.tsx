import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Award, Briefcase, Clock, DollarSign, Plus, TrendingUp, User } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";

export default function AdminSpecialistDetail() {
  const { specialistId } = useParams<{ specialistId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable
  const [healthScore, setHealthScore] = useState("");
  const [salary, setSalary] = useState("");
  const [saving, setSaving] = useState(false);

  // Milestone dialog
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);

  useEffect(() => {
    if (!specialistId) return;
    const fetch = async () => {
      // Find user_id — specialistId could be user_id directly
      const [profileRes, tasksRes, logsRes, milestonesRes, clientsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", specialistId).single(),
        supabase.from("tasks").select("*").eq("assigned_specialist_id", specialistId).order("created_at", { ascending: false }),
        supabase.from("time_logs").select("*").eq("specialist_id", specialistId),
        supabase.from("specialist_milestones").select("*").eq("specialist_id", specialistId).order("achieved_at", { ascending: false }),
        supabase.from("client_accounts").select("id, user_id, hours_purchased, hours_used, current_rate").or(`assigned_specialist_id.eq.${specialistId}`),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setHealthScore(profileRes.data.health_score?.toString() || "");
        setSalary(profileRes.data.salary?.toString() || "");
      }
      if (tasksRes.data) setTasks(tasksRes.data);
      if (logsRes.data) setTimeLogs(logsRes.data);
      if (milestonesRes.data) setMilestones(milestonesRes.data);

      // Get client profiles for assigned clients
      if (clientsRes.data && clientsRes.data.length > 0) {
        const userIds = clientsRes.data.map(c => c.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, company").in("user_id", userIds);
        setAssignedClients(clientsRes.data.map(c => ({
          ...c,
          profile: profiles?.find(p => p.user_id === c.user_id),
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [specialistId]);

  const saveDetails = async () => {
    if (!specialistId) return;
    setSaving(true);
    await supabase.from("profiles").update({
      health_score: healthScore ? parseInt(healthScore) : null,
      salary: salary ? parseFloat(salary) : null,
    }).eq("user_id", specialistId);
    toast({ title: "Saved", description: "Specialist details updated." });
    setSaving(false);
  };

  const addMilestone = async () => {
    if (!specialistId || !milestoneTitle) return;
    setAddingMilestone(true);
    await supabase.from("specialist_milestones").insert({
      specialist_id: specialistId,
      title: milestoneTitle,
      achieved_at: milestoneDate || new Date().toISOString(),
    });
    toast({ title: "Milestone added" });
    setMilestoneOpen(false);
    setMilestoneTitle("");
    setMilestoneDate("");
    setAddingMilestone(false);
    const { data } = await supabase.from("specialist_milestones").select("*").eq("specialist_id", specialistId).order("achieved_at", { ascending: false });
    if (data) setMilestones(data);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!profile) {
    return <div className="py-24 text-center"><p className="text-muted-foreground">Specialist not found</p></div>;
  }

  const totalHours = timeLogs.reduce((s, l) => s + l.hours, 0);
  const billableHours = timeLogs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0);
  const billablePct = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
  const activeTasks = tasks.filter(t => !["completed", "declined"].includes(t.status)).length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;

  const statusColors: Record<string, string> = {
    submitted: "bg-muted text-muted-foreground", in_review: "bg-primary/10 text-primary",
    in_progress: "bg-warning/10 text-warning", awaiting_input: "bg-destructive/10 text-destructive",
    ready_for_review: "bg-accent/10 text-accent-foreground",
    completed: "bg-success/10 text-success", declined: "bg-destructive/10 text-destructive",
  };
  const statusLabels: Record<string, string> = {
    submitted: "Submitted", in_review: "In Review", in_progress: "In Progress",
    awaiting_input: "Awaiting Input", ready_for_review: "Ready for Review", completed: "Completed", declined: "Declined",
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/specialists")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Specialists
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        {specialistId && (
          <AvatarUpload
            userId={specialistId}
            currentUrl={profile.avatar_url}
            name={profile.full_name}
            onUploaded={(url) => setProfile({ ...profile, avatar_url: url })}
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">{profile.full_name || "Unnamed"}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          {profile.start_date && <p className="text-xs text-muted-foreground mt-1">Started {new Date(profile.start_date).toLocaleDateString()}</p>}
          {profile.specialist_certification && <Badge variant="outline" className="mt-1">{profile.specialist_certification}</Badge>}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Briefcase className="h-4 w-4" />Active Tasks</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{activeTasks}</p><p className="text-xs text-muted-foreground">{completedTasks} completed</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" />Total Hours</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{totalHours.toFixed(1)}h</p><p className="text-xs text-muted-foreground">{billableHours.toFixed(1)}h billable</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Billable %</CardDescription></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{billablePct.toFixed(0)}%</p>
            <Progress value={billablePct} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><DollarSign className="h-4 w-4" />Salary</CardDescription></CardHeader>
          <CardContent>
            <Input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Monthly salary" className="text-sm" />
          </CardContent>
        </Card>
      </div>

      {/* Health Score */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Health Score & Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <Label>Health Score (1-100)</Label>
              <Input type="number" min="1" max="100" value={healthScore} onChange={e => setHealthScore(e.target.value)} />
            </div>
          </div>
          {profile.specialist_bio && <p className="text-sm text-muted-foreground">{profile.specialist_bio}</p>}
          <Button onClick={saveDetails} disabled={saving} size="sm">{saving ? "Saving…" : "Save Details"}</Button>
        </CardContent>
      </Card>

      {/* Active Accounts */}
      {assignedClients.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assigned Clients ({assignedClients.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignedClients.map((c: any) => (
                <div key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer transition-colors hover:border-primary/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.profile?.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{c.profile?.company}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{(c.hours_purchased - c.hours_used).toFixed(1)}h remaining</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tasks ({tasks.length})</CardTitle></CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((t: any) => (
                <div key={t.id} onClick={() => navigate(`/admin/tasks/${t.id}`)} className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer transition-colors hover:border-primary/20 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                      {t.estimated_hours != null && <span>{t.estimated_hours}h est.</span>}
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge className={statusColors[t.status]} variant="secondary">{statusLabels[t.status] || t.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned</p>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Milestones</CardTitle>
            <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Milestone</DialogTitle>
                  <DialogDescription>Record an achievement for this specialist.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} placeholder="e.g. Completed 50 tasks" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date achieved</Label>
                    <Input type="date" value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} />
                  </div>
                  <Button onClick={addMilestone} disabled={addingMilestone || !milestoneTitle} className="w-full">
                    {addingMilestone ? "Adding…" : "Add Milestone"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {milestones.length > 0 ? (
            <div className="space-y-2">
              {milestones.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Award className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(m.achieved_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No milestones yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
