import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Plus, Zap, Clock, Video, Upload, KeyRound, ChevronDown, X, ListChecks } from "lucide-react";

const TASK_CATEGORIES = [
  { value: "automation", label: "Automation", placeholder: "Describe the workflow to automate…" },
  { value: "funnel", label: "Funnel Build", placeholder: "Describe the funnel pages, offers, and flow…" },
  { value: "pipeline", label: "Pipeline Setup", placeholder: "Describe the pipeline stages and automation…" },
  { value: "website", label: "Website / Landing Page", placeholder: "Describe the page layout, copy, and goal…" },
  { value: "integration", label: "Integration", placeholder: "Describe the systems to connect and data flow…" },
  { value: "reporting", label: "Reporting / Dashboard", placeholder: "Describe the metrics and data sources…" },
  { value: "other", label: "Other", placeholder: "Describe the scope of work, goals, and context…" },
];

interface SubmitTaskDialogProps {
  clientAccountId: string;
  onTaskCreated?: () => void;
}

export default function SubmitTaskDialog({ clientAccountId, onTaskCreated }: SubmitTaskDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("other");
  const [isUrgent, setIsUrgent] = useState(false);
  const [creating, setCreating] = useState(false);

  // Attachments
  const [loomUrl, setLoomUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credLabel, setCredLabel] = useState("");
  const [credValue, setCredValue] = useState("");

  // Subtasks
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const selectedCategory = TASK_CATEGORIES.find((c) => c.value === category);

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, newSubtask.trim()]);
      setNewSubtask("");
    }
  };

  const removeSubtask = (idx: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);

    const subtasksJson = subtasks.length > 0
      ? subtasks.map((t) => ({ title: t, completed: false }))
      : null;

    const { data: taskData, error } = await supabase.from("tasks").insert({
      name: name.trim(),
      description: description.trim() || null,
      client_account_id: clientAccountId,
      created_by: user.id,
      requested_by: user.id,
      priority,
      category,
      is_urgent: isUrgent,
      status: isUrgent ? "in_review" : "submitted",
      subtasks: subtasksJson,
    } as any).select("id").single();

    if (error || !taskData) {
      toast({ title: "Error", description: error?.message || "Failed to create task", variant: "destructive" });
      setCreating(false);
      return;
    }

    const taskId = taskData.id;

    // Upload files
    for (const file of files) {
      const filePath = `${taskId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("deliverables").upload(filePath, file);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("deliverables").getPublicUrl(filePath);
        await supabase.from("task_deliverables").insert({
          task_id: taskId,
          uploaded_by: user.id,
          type: "file" as any,
          url: urlData.publicUrl,
          file_name: file.name,
        });
      }
    }

    // Add Loom URL
    if (loomUrl.trim()) {
      await supabase.from("task_deliverables").insert({
        task_id: taskId,
        uploaded_by: user.id,
        type: "loom" as any,
        url: loomUrl.trim(),
        file_name: "Loom Recording",
      });
    }

    // Add credentials
    if (credLabel.trim() && credValue.trim()) {
      await supabase.from("task_credentials").insert({
        task_id: taskId,
        client_id: user.id,
        label: credLabel.trim(),
        credential_value: credValue.trim(),
      });
    }

    toast({
      title: "Task submitted",
      description: isUrgent
        ? "Marked as urgent — work will begin immediately."
        : "Your specialist will prepare a scope for your review.",
    });
    setOpen(false);
    resetForm();
    onTaskCreated?.();
    setCreating(false);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPriority("medium");
    setCategory("other");
    setIsUrgent(false);
    setLoomUrl("");
    setFiles([]);
    setCredentialsOpen(false);
    setCredLabel("");
    setCredValue("");
    setSubtasks([]);
    setNewSubtask("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Submit Task Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Task Request</DialogTitle>
          <DialogDescription>Choose a category and describe what you need.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Category selector */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-name">Task name</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Automate onboarding emails"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={selectedCategory?.placeholder}
              rows={4}
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Subtasks
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            {subtasks.length > 0 && (
              <div className="space-y-1.5">
                {subtasks.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                    <span className="flex-1">{st}</span>
                    <button onClick={() => removeSubtask(idx)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add a subtask…"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addSubtask} disabled={!newSubtask.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Loom Video URL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Video className="h-4 w-4" /> Loom Video URL
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
            />
          </div>

          {/* File/Screenshot upload — multi-file */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" /> Screenshots or Files
              <span className="text-xs text-muted-foreground">(optional, multiple)</span>
            </Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
              multiple
              className="cursor-pointer"
            />
            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                    <span className="truncate flex-1">{f.name}</span>
                    <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-foreground ml-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scope toggle */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                <Label htmlFor="urgent-toggle" className="font-medium cursor-pointer">
                  Start building immediately
                </Label>
              </div>
              <Switch id="urgent-toggle" checked={isUrgent} onCheckedChange={setIsUrgent} />
            </div>
            <p className="text-xs text-muted-foreground">
              {isUrgent ? (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-warning" /> Work begins immediately — no scope review needed.
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Your specialist will prepare a scope for your approval first.
                </span>
              )}
            </p>
          </div>

          {/* Optional credentials */}
          <Collapsible open={credentialsOpen} onOpenChange={setCredentialsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 w-full justify-start text-muted-foreground">
                <KeyRound className="h-4 w-4" /> Share login credentials
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${credentialsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2 pl-1">
              <p className="text-xs text-muted-foreground">Credentials are stored securely and only visible to your assigned specialist.</p>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={credLabel} onChange={(e) => setCredLabel(e.target.value)} placeholder="e.g. GHL Admin Login" />
              </div>
              <div className="space-y-2">
                <Label>Credentials</Label>
                <Textarea value={credValue} onChange={(e) => setCredValue(e.target.value)} placeholder={"email: …\npassword: …"} rows={3} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button onClick={handleSubmit} disabled={creating || !name.trim()} className="w-full">
            {creating ? "Submitting…" : isUrgent ? "Submit & start immediately" : "Submit for scope review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
