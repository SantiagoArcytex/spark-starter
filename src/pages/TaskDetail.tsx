import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Clock, FileText, Zap, AlertTriangle, UserPlus, X, CheckCircle2, Activity } from "lucide-react";
import TaskMessages from "@/components/task/TaskMessages";
import TaskDeliverables from "@/components/task/TaskDeliverables";
import TaskCredentials from "@/components/task/TaskCredentials";
import SpecialistProfileCard from "@/components/task/SpecialistProfileCard";
import { TaskActivityTimeline, SubtaskChecklist } from "@/components/task/TaskActivity";

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  is_urgent: boolean;
  estimated_hours: number | null;
  actual_hours: number | null;
  assigned_specialist_id: string | null;
  client_account_id: string;
  created_at: string;
  at_risk?: boolean;
  category?: string | null;
  subtasks?: { title: string; completed: boolean }[] | null;
}

interface TaskSpecialist {
  id: string;
  specialist_id: string;
  role: string;
  name?: string;
}

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
  in_progress: "bg-primary/10 text-primary",
  awaiting_input: "bg-destructive/10 text-destructive",
  ready_for_review: "bg-accent/10 text-accent-foreground",
  completed: "bg-success/10 text-success",
  declined: "bg-destructive/10 text-destructive",
};

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user, isSpecialist, isAdmin, isTechLead, isSuperAdmin, isClient } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdminLike = isAdmin || isTechLead || isSuperAdmin;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimateHours, setEstimateHours] = useState("");
  const [submittingEstimate, setSubmittingEstimate] = useState(false);

  // Specialist log hours
  const [logHours, setLogHours] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [logBillable, setLogBillable] = useState(true);
  const [loggingHours, setLoggingHours] = useState(false);
  const [totalLogged, setTotalLogged] = useState(0);

  // Multi-specialist
  const [taskSpecialists, setTaskSpecialists] = useState<TaskSpecialist[]>([]);
  const [allSpecialists, setAllSpecialists] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [addSpecId, setAddSpecId] = useState("");
  const [addSpecDialogOpen, setAddSpecDialogOpen] = useState(false);

  const fetchTask = async () => {
    if (!taskId) return;
    const { data } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    if (data) setTask(data as any);
  };

  const fetchTimeLogs = async () => {
    if (!taskId || !user) return;
    const { data } = await supabase.from("time_logs").select("hours").eq("task_id", taskId);
    if (data) setTotalLogged(data.reduce((s, l) => s + l.hours, 0));
  };

  const fetchTaskSpecialists = async () => {
    if (!taskId) return;
    const { data } = await supabase.from("task_specialists").select("*").eq("task_id", taskId);
    if (data && data.length > 0) {
      const specIds = data.map((d) => d.specialist_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", specIds);
      setTaskSpecialists(data.map((d) => ({
        ...d,
        name: profiles?.find((p) => p.user_id === d.specialist_id)?.full_name || "Unknown",
      })));
    } else {
      setTaskSpecialists([]);
    }
  };

  const fetchAllSpecialists = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "specialist");
    if (roles) {
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      setAllSpecialists(profiles || []);
    }
  };

  useEffect(() => {
    Promise.all([fetchTask(), fetchTimeLogs(), fetchTaskSpecialists()]).then(() => setLoading(false));
    if (isAdminLike) fetchAllSpecialists();

    if (taskId) {
      const channel = supabase
        .channel(`task-detail-${taskId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` }, (payload) => {
          if (payload.new) setTask(payload.new as any);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [taskId]);

  const submitEstimate = async () => {
    if (!taskId || !estimateHours) return;
    setSubmittingEstimate(true);
    await supabase.from("tasks").update({ estimated_hours: parseFloat(estimateHours), status: "submitted" as any }).eq("id", taskId);
    toast({ title: "Estimate submitted", description: "Client will review your estimate." });
    setEstimateHours("");
    setSubmittingEstimate(false);
    fetchTask();
  };

  const handleLogHours = async () => {
    if (!taskId || !user || !logHours) return;
    setLoggingHours(true);
    const { error } = await supabase.from("time_logs").insert({
      task_id: taskId,
      specialist_id: user.id,
      hours: parseFloat(logHours),
      description: logDesc.trim() || null,
      billable: logBillable,
      activity_type: "task",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Hours logged", description: `${logHours}h logged.` });
      setLogHours("");
      setLogDesc("");
      setLogBillable(true);
      fetchTimeLogs();
    }
    setLoggingHours(false);
  };

  const handleSubmitForReview = async () => {
    if (!taskId || !user || !task) return;
    await supabase.from("tasks").update({ status: "ready_for_review" as any }).eq("id", taskId);

    // Notify the client who owns this task
    const { data: account } = await supabase.from("client_accounts").select("user_id").eq("id", task.client_account_id).single();
    if (account) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      await supabase.from("notifications").insert({
        user_id: account.user_id,
        title: "Task Ready for Review",
        message: `"${task.name}" has been completed by ${profile?.full_name || "your specialist"} and is ready for your sign-off.`,
        type: "approval",
        task_id: taskId,
      });
    }

    toast({ title: "Submitted for review", description: "The client has been notified to sign off." });
    fetchTask();
  };

  const handleClientSignOff = async () => {
    if (!taskId || !user) return;
    await supabase.from("tasks").update({ status: "completed" as any }).eq("id", taskId);
    await supabase.from("task_approvals").insert({
      task_id: taskId,
      action: "approved" as any,
      acted_by: user.id,
      comment: "Client signed off on completed task",
    });
    toast({ title: "Task signed off", description: "This task is now marked as completed." });
    fetchTask();
  };

  const handleRequestRevisions = async () => {
    if (!taskId || !user) return;
    await supabase.from("tasks").update({ status: "in_progress" as any }).eq("id", taskId);
    await supabase.from("task_approvals").insert({
      task_id: taskId,
      action: "changes_requested" as any,
      acted_by: user.id,
      comment: "Client requested revisions",
    });

    // Notify specialist
    if (task?.assigned_specialist_id) {
      await supabase.from("notifications").insert({
        user_id: task.assigned_specialist_id,
        title: "Revisions Requested",
        message: `Client has requested revisions on "${task?.name}".`,
        type: "approval",
        task_id: taskId,
      });
    }

    toast({ title: "Revisions requested", description: "The task has been sent back to the specialist." });
    fetchTask();
  };

  const handleFlagAtRisk = async () => {
    if (!taskId || !user) return;
    await supabase.from("tasks").update({ at_risk: true } as any).eq("id", taskId);
    const { data: techLeads } = await supabase.from("user_roles").select("user_id").eq("role", "tech_lead");
    if (techLeads) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      const specName = profile?.full_name || "A specialist";
      const notifications = techLeads.map((tl) => ({
        user_id: tl.user_id,
        title: "Task Escalated",
        message: `Task "${task?.name}" has been flagged as at risk by ${specName}`,
        type: "escalation",
        task_id: taskId,
      }));
      if (notifications.length > 0) await supabase.from("notifications").insert(notifications);
    }
    toast({ title: "Task flagged as at risk", description: "Tech leads have been notified." });
    fetchTask();
  };

  const handleResolveRisk = async () => {
    if (!taskId) return;
    await supabase.from("tasks").update({ at_risk: false } as any).eq("id", taskId);
    toast({ title: "Risk resolved" });
    fetchTask();
  };

  const handleAddSpecialist = async () => {
    if (!taskId || !addSpecId) return;
    const { error } = await supabase.from("task_specialists").insert({ task_id: taskId, specialist_id: addSpecId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Specialist added" });
      setAddSpecId("");
      setAddSpecDialogOpen(false);
      fetchTaskSpecialists();
    }
  };

  const handleRemoveSpecialist = async (id: string) => {
    await supabase.from("task_specialists").delete().eq("id", id);
    fetchTaskSpecialists();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!task) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">Go back</Button>
      </div>
    );
  }

  const hoursProgress = task.estimated_hours ? Math.min((totalLogged / task.estimated_hours) * 100, 100) : 0;

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Task header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground font-display">{task.name}</h1>
            {task.is_urgent && (
              <Badge className="bg-warning/10 text-warning gap-1" variant="secondary"><Zap className="h-3 w-3" /> Urgent</Badge>
            )}
            {task.at_risk && (
              <Badge className="bg-destructive/10 text-destructive gap-1" variant="secondary"><AlertTriangle className="h-3 w-3" /> At Risk</Badge>
            )}
            {task.category && task.category !== "other" && (
              <Badge variant="outline" className="capitalize">{task.category}</Badge>
            )}
          </div>
          {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Created {new Date(task.created_at).toLocaleDateString()}</p>
        </div>
        <Badge className={statusColors[task.status]} variant="secondary">{statusLabels[task.status] || task.status}</Badge>
      </div>

      {/* Hours progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {totalLogged.toFixed(1)}h logged {task.estimated_hours != null && `/ ${task.estimated_hours}h estimated`}
            </div>
            <span className="text-sm text-muted-foreground">Priority: {task.priority}</span>
          </div>
          {task.estimated_hours != null && <Progress value={hoursProgress} className="h-2" />}
        </CardContent>
      </Card>

      {/* Client: Sign off on ready_for_review tasks */}
      {isClient && task.status === "ready_for_review" && (
        <Card className="border-success/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" /> Task Ready for Your Review
            </CardTitle>
            <CardDescription>Your specialist has completed this task. Please review and sign off or request revisions.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={handleClientSignOff} className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Sign Off & Complete
            </Button>
            <Button variant="outline" onClick={handleRequestRevisions}>
              Request Revisions
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Specialist: estimate submission */}
      {isSpecialist && task.status === "submitted" && !task.is_urgent && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Submit Estimate</CardTitle>
            <CardDescription>This task needs your hours estimate before the client approves.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label>Estimated hours</Label>
              <Input type="number" step="0.5" value={estimateHours} onChange={(e) => setEstimateHours(e.target.value)} placeholder="e.g. 8" />
            </div>
            <Button onClick={submitEstimate} disabled={submittingEstimate || !estimateHours}>
              {submittingEstimate ? "Submitting…" : "Submit estimate"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Specialist: Log hours + flag at risk + submit for review */}
      {isSpecialist && task.status !== "completed" && task.status !== "declined" && task.status !== "ready_for_review" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Log Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="w-24 space-y-1">
                <Label>Hours</Label>
                <Input type="number" step="0.25" min="0.25" value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="2.5" />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Description</Label>
                <Textarea value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder="What did you work on?" rows={1} className="min-h-10 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="task-billable" checked={logBillable} onCheckedChange={setLogBillable} />
                <Label htmlFor="task-billable" className="cursor-pointer text-sm">Billable</Label>
              </div>
              <div className="flex gap-2">
                {!task.at_risk && (
                  <Button variant="destructive" size="sm" onClick={handleFlagAtRisk} className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Flag as At Risk
                  </Button>
                )}
                {task.at_risk && isAdminLike && (
                  <Button variant="outline" size="sm" onClick={handleResolveRisk}>Resolve Risk</Button>
                )}
                <Button size="sm" onClick={handleLogHours} disabled={loggingHours || !logHours}>
                  {loggingHours ? "Logging…" : "Log hours"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Specialist: Submit for client review */}
      {isSpecialist && task.status === "in_progress" && (
        <Card className="border-primary/30">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-foreground">Done with this task?</p>
              <p className="text-sm text-muted-foreground">Submit for client review and sign-off.</p>
            </div>
            <Button onClick={handleSubmitForReview} className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Submit for Review
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin: resolve risk */}
      {isAdminLike && !isSpecialist && task.at_risk && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-medium text-destructive">This task is flagged as at risk</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleResolveRisk}>Resolve Risk</Button>
          </CardContent>
        </Card>
      )}

      {/* Multi-specialist assignment (admin only) */}
      {isAdminLike && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assigned Specialists</CardTitle>
              <Dialog open={addSpecDialogOpen} onOpenChange={setAddSpecDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1"><UserPlus className="h-3 w-3" /> Add</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Specialist</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <Select value={addSpecId} onValueChange={setAddSpecId}>
                      <SelectTrigger><SelectValue placeholder="Select specialist" /></SelectTrigger>
                      <SelectContent>
                        {allSpecialists
                          .filter((s) => s.user_id !== task.assigned_specialist_id && !taskSpecialists.some((ts) => ts.specialist_id === s.user_id))
                          .map((s) => (
                            <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.user_id}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddSpecialist} disabled={!addSpecId} className="w-full">Add to task</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {task.assigned_specialist_id && (
              <div className="mb-2">
                <SpecialistProfileCard specialistId={task.assigned_specialist_id} />
                <Badge variant="secondary" className="mt-1 text-xs">Primary</Badge>
              </div>
            )}
            {taskSpecialists.length > 0 && (
              <div className="space-y-2 mt-2">
                {taskSpecialists.map((ts) => (
                  <div key={ts.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ts.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{ts.role}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleRemoveSpecialist(ts.id)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
            {!task.assigned_specialist_id && taskSpecialists.length === 0 && (
              <p className="text-sm text-muted-foreground">No specialists assigned</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-admin: show specialist profile */}
      {!isAdminLike && task.assigned_specialist_id && (
        <SpecialistProfileCard specialistId={task.assigned_specialist_id} />
      )}

      <TaskCredentials taskId={task.id} />

      {/* Subtask checklist */}
      {task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
        <SubtaskChecklist
          taskId={task.id}
          subtasks={task.subtasks}
          canEdit={isSpecialist || isAdminLike}
        />
      )}

      <Tabs defaultValue="messages" className="w-full">
        <TabsList>
          <TabsTrigger value="messages" className="gap-1.5"><Send className="h-3.5 w-3.5" /> Messages</TabsTrigger>
          <TabsTrigger value="deliverables" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Deliverables</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="messages"><TaskMessages taskId={task.id} /></TabsContent>
        <TabsContent value="deliverables"><TaskDeliverables taskId={task.id} /></TabsContent>
        <TabsContent value="activity"><TaskActivityTimeline taskId={task.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
