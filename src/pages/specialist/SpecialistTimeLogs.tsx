import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Mic, Pencil, Trash2, Loader2 } from "lucide-react";

interface TimeLog {
  id: string;
  task_id: string | null;
  hours: number;
  description: string | null;
  billable: boolean;
  logged_at: string;
  activity_type: string;
  activity_label: string | null;
  task_name?: string;
  specialist_id: string;
}

interface TaskOption {
  id: string;
  name: string;
}

interface ParsedEntry {
  task_name_hint: string;
  hours: number;
  description: string;
  billable: boolean;
  activity_type: string;
  matched_task_id?: string;
}

const activityTypes = [
  { value: "task", label: "Task" },
  { value: "training", label: "Training" },
  { value: "internal", label: "Internal" },
  { value: "meeting", label: "Meeting" },
];

export default function SpecialistTimeLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dictateOpen, setDictateOpen] = useState(false);

  // Form
  const [isNonTask, setIsNonTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [activityType, setActivityType] = useState("task");
  const [activityLabel, setActivityLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);

  // Dictation
  const [dictationText, setDictationText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    // Fetch primary tasks + secondary tasks via task_specialists
    const [logsRes, primaryTasksRes, secondaryAssignmentsRes] = await Promise.all([
      supabase.from("time_logs").select("*").eq("specialist_id", user.id).order("logged_at", { ascending: false }).limit(50),
      supabase.from("tasks").select("id, name").eq("assigned_specialist_id", user.id).not("status", "in", '("completed","declined")'),
      supabase.from("task_specialists").select("task_id").eq("specialist_id", user.id),
    ]);

    const primaryTasks = primaryTasksRes.data || [];
    const secondaryIds = (secondaryAssignmentsRes.data || [])
      .map((a) => a.task_id)
      .filter((id) => !primaryTasks.some((t) => t.id === id));

    let allTasks = [...primaryTasks];
    if (secondaryIds.length > 0) {
      const { data: extraTasks } = await supabase.from("tasks").select("id, name").in("id", secondaryIds).not("status", "in", '("completed","declined")');
      if (extraTasks) allTasks = [...allTasks, ...extraTasks];
    }

    const tasksRes = { data: allTasks };

    if (tasksRes.data) setTasks(tasksRes.data);

    if (logsRes.data) {
      const taskMap: Record<string, string> = {};
      if (tasksRes.data) tasksRes.data.forEach((t) => (taskMap[t.id] = t.name));

      const logTaskIds = [...new Set(logsRes.data.filter((l: any) => l.task_id).map((l: any) => l.task_id))];
      const missingIds = logTaskIds.filter((id) => !taskMap[id]);
      if (missingIds.length > 0) {
        const { data: extraTasks } = await supabase.from("tasks").select("id, name").in("id", missingIds);
        if (extraTasks) extraTasks.forEach((t) => (taskMap[t.id] = t.name));
      }

      setLogs(logsRes.data.map((l: any) => ({
        ...l,
        task_name: l.task_id ? (taskMap[l.task_id] || "Unknown Task") : null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!isNonTask && !selectedTask) return;
    if (!hours) return;
    setSubmitting(true);

    const payload: any = {
      specialist_id: user.id,
      hours: parseFloat(hours),
      description: description.trim() || null,
      billable: isNonTask ? false : billable,
      activity_type: isNonTask ? activityType : "task",
      activity_label: isNonTask ? activityLabel.trim() || null : null,
      task_id: isNonTask ? null : selectedTask,
    };

    let error;
    if (editingLog) {
      ({ error } = await supabase.from("time_logs").update(payload).eq("id", editingLog.id));
    } else {
      ({ error } = await supabase.from("time_logs").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingLog ? "Log updated" : "Hours logged" });
      resetForm();
      setDialogOpen(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSelectedTask("");
    setHours("");
    setDescription("");
    setBillable(true);
    setIsNonTask(false);
    setActivityType("task");
    setActivityLabel("");
    setEditingLog(null);
  };

  const handleEdit = (log: TimeLog) => {
    setEditingLog(log);
    setIsNonTask(!log.task_id);
    setSelectedTask(log.task_id || "");
    setHours(String(log.hours));
    setDescription(log.description || "");
    setBillable(log.billable);
    setActivityType(log.activity_type || "task");
    setActivityLabel(log.activity_label || "");
    setDialogOpen(true);
  };

  const handleDelete = async (logId: string) => {
    const { error } = await supabase.from("time_logs").delete().eq("id", logId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Log deleted" });
      fetchData();
    }
  };

  const handleParseDictation = async () => {
    if (!dictationText.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-time-dictation", {
        body: { text: dictationText, tasks: tasks.map((t) => ({ id: t.id, name: t.name })) },
      });
      if (error) throw error;
      const entries = (data?.entries || []) as ParsedEntry[];
      // Fuzzy match tasks
      entries.forEach((e) => {
        if (e.task_name_hint) {
          const match = tasks.find((t) => t.name.toLowerCase().includes(e.task_name_hint.toLowerCase()) || e.task_name_hint.toLowerCase().includes(t.name.toLowerCase()));
          if (match) e.matched_task_id = match.id;
        }
      });
      setParsedEntries(entries);
    } catch (err: any) {
      toast({ title: "Parse error", description: err.message || "Failed to parse", variant: "destructive" });
    }
    setParsing(false);
  };

  const handleBulkSubmit = async () => {
    if (!user || parsedEntries.length === 0) return;
    setBulkSubmitting(true);
    const inserts = parsedEntries.map((e) => ({
      specialist_id: user.id,
      task_id: e.matched_task_id || null,
      hours: e.hours,
      description: e.description,
      billable: e.billable,
      activity_type: e.activity_type || "task",
      activity_label: !e.matched_task_id ? e.task_name_hint : null,
    }));

    const { error } = await supabase.from("time_logs").insert(inserts);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "All entries logged", description: `${inserts.length} time log(s) created.` });
      setDictateOpen(false);
      setDictationText("");
      setParsedEntries([]);
      fetchData();
    }
    setBulkSubmitting(false);
  };

  const totalBillable = logs.filter((l) => l.billable).reduce((sum, l) => sum + l.hours, 0);
  const totalNonBillable = logs.filter((l) => !l.billable).reduce((sum, l) => sum + l.hours, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Time Logs</h1>
          <p className="text-sm text-muted-foreground">Track your billable and non-billable hours</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dictateOpen} onOpenChange={setDictateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Mic className="h-4 w-4" /> Dictate</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>AI Dictation — Log Multiple Entries</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Textarea
                  placeholder="Tell us what you worked on today, e.g. 'I spent 2 hours on the funnel task for Client X, then 1.5 hours on pipeline automation, and 30 minutes doing a GHL course'"
                  value={dictationText}
                  onChange={(e) => setDictationText(e.target.value)}
                  rows={4}
                />
                <Button onClick={handleParseDictation} disabled={parsing || !dictationText.trim()} className="gap-2">
                  {parsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : "Parse with AI"}
                </Button>

                {parsedEntries.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Parsed entries — review and confirm:</p>
                    {parsedEntries.map((entry, i) => (
                      <Card key={i}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Select
                              value={entry.matched_task_id || "__non_task__"}
                              onValueChange={(v) => {
                                const updated = [...parsedEntries];
                                updated[i].matched_task_id = v === "__non_task__" ? undefined : v;
                                setParsedEntries(updated);
                              }}
                            >
                              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__non_task__">Non-task activity</SelectItem>
                                {tasks.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.25"
                              className="w-20"
                              value={entry.hours}
                              onChange={(e) => {
                                const updated = [...parsedEntries];
                                updated[i].hours = parseFloat(e.target.value) || 0;
                                setParsedEntries(updated);
                              }}
                            />
                            <Button size="sm" variant="ghost" onClick={() => setParsedEntries(parsedEntries.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">{entry.description}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={entry.billable ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                              {entry.billable ? "Billable" : "Non-billable"}
                            </Badge>
                            <Badge variant="secondary">{entry.activity_type}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button onClick={handleBulkSubmit} disabled={bulkSubmitting} className="w-full">
                      {bulkSubmitting ? "Submitting…" : `Log ${parsedEntries.length} entries`}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Log Hours</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingLog ? "Edit Log Entry" : "Log Hours"}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="non-task-toggle" className="cursor-pointer">Non-task activity</Label>
                  <Switch id="non-task-toggle" checked={isNonTask} onCheckedChange={(v) => { setIsNonTask(v); if (v) { setBillable(false); setSelectedTask(""); } }} />
                </div>

                {isNonTask ? (
                  <>
                    <div className="space-y-2">
                      <Label>Activity type</Label>
                      <Select value={activityType} onValueChange={setActivityType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {activityTypes.filter((a) => a.value !== "task").map((a) => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Activity label</Label>
                      <Input value={activityLabel} onChange={(e) => setActivityLabel(e.target.value)} placeholder="e.g. GHL certification course" />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Task</Label>
                    <Select value={selectedTask} onValueChange={setSelectedTask}>
                      <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                      <SelectContent>
                        {tasks.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input type="number" step="0.25" min="0.25" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 2.5" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you work on?" />
                </div>
                {!isNonTask && (
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <Label htmlFor="billable-toggle" className="cursor-pointer">Billable</Label>
                    <Switch id="billable-toggle" checked={billable} onCheckedChange={setBillable} />
                  </div>
                )}
                <Button onClick={handleSubmit} disabled={submitting || (!isNonTask && !selectedTask) || !hours} className="w-full">
                  {submitting ? "Saving…" : editingLog ? "Update entry" : "Log hours"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-foreground">{(totalBillable + totalNonBillable).toFixed(1)}h</p>
          <p className="text-sm text-muted-foreground">Total logged</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-success">{totalBillable.toFixed(1)}h</p>
          <p className="text-sm text-muted-foreground">Billable</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-warning">{totalNonBillable.toFixed(1)}h</p>
          <p className="text-sm text-muted-foreground">Non-billable</p>
        </CardContent></Card>
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No hours logged yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {log.task_name || log.activity_label || `${log.activity_type} activity`}
                  </p>
                  {log.description && <p className="mt-0.5 text-sm text-muted-foreground truncate">{log.description}</p>}
                  <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                    <span>{new Date(log.logged_at).toLocaleDateString()}</span>
                    {log.activity_type !== "task" && <Badge variant="secondary" className="text-[10px]">{log.activity_type}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-foreground">{log.hours}h</span>
                  <Badge variant="secondary" className={log.billable ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                    {log.billable ? "Billable" : "Non-billable"}
                  </Badge>
                  {log.specialist_id === user?.id && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(log)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(log.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
