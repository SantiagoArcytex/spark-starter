import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, MessageSquare, CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  estimated_hours: number | null;
  created_at: string;
  assigned_specialist_id: string | null;
}

export default function Approvals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .in("status", ["submitted", "awaiting_input", "ready_for_review"])
      .order("created_at", { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleAction = async (taskId: string, action: "approved" | "declined" | "changes_requested") => {
    if (!user) return;
    setActionLoading(taskId);

    const newStatus = action === "approved" ? "in_review" : action === "declined" ? "declined" : "submitted";

    await supabase.from("task_approvals").insert({
      task_id: taskId,
      action,
      comment: commentMap[taskId] || null,
      acted_by: user.id,
    });

    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);

    toast({
      title: action === "approved" ? "Task approved" : action === "declined" ? "Task declined" : "Changes requested",
      description: action === "approved" ? "Work will begin shortly." : undefined,
    });

    setActionLoading(null);
    setShowCommentFor(null);
    fetchTasks();
  };

  const handleSignOff = async (taskId: string) => {
    if (!user) return;
    setActionLoading(taskId);
    await supabase.from("tasks").update({ status: "completed" as any }).eq("id", taskId);
    await supabase.from("task_approvals").insert({
      task_id: taskId,
      action: "approved" as any,
      acted_by: user.id,
      comment: "Client signed off on completed task",
    });
    toast({ title: "Task signed off", description: "This task is now marked as completed." });
    setActionLoading(null);
    fetchTasks();
  };

  const handleRequestRevisions = async (task: Task) => {
    if (!user) return;
    setActionLoading(task.id);
    await supabase.from("tasks").update({ status: "in_progress" as any }).eq("id", task.id);
    await supabase.from("task_approvals").insert({
      task_id: task.id,
      action: "changes_requested" as any,
      acted_by: user.id,
      comment: commentMap[task.id] || "Client requested revisions",
    });

    if (task.assigned_specialist_id) {
      await supabase.from("notifications").insert({
        user_id: task.assigned_specialist_id,
        title: "Revisions Requested",
        message: `Client has requested revisions on "${task.name}".`,
        type: "approval",
        task_id: task.id,
      });
    }

    toast({ title: "Revisions requested" });
    setActionLoading(null);
    setShowCommentFor(null);
    fetchTasks();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const estimateTasks = tasks.filter((t) => t.status === "submitted" || t.status === "awaiting_input");
  const reviewTasks = tasks.filter((t) => t.status === "ready_for_review");

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Task Approvals</h1>
        <p className="text-sm text-muted-foreground">Review estimates and sign off on completed work</p>
      </div>

      {/* Ready for Review / Sign-off section */}
      {reviewTasks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Ready for Sign-off ({reviewTasks.length})
          </h2>
          {reviewTasks.map((task) => (
            <Card key={task.id} className="border-2 border-success/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg cursor-pointer hover:underline" onClick={() => navigate(`/tasks/${task.id}`)}>{task.name}</CardTitle>
                    <CardDescription className="mt-1">{task.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-success/10 text-success">Ready for Review</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Estimated hours</span>
                    <p className="font-semibold text-foreground">{task.estimated_hours || "—"}h</p>
                  </div>
                </div>

                {showCommentFor === task.id && (
                  <Textarea
                    placeholder="Add a note about what needs to change…"
                    value={commentMap[task.id] || ""}
                    onChange={(e) => setCommentMap((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleSignOff(task.id)} disabled={actionLoading === task.id} className="gap-2">
                    <CheckCircle className="h-4 w-4" /> Sign Off & Complete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (showCommentFor === task.id) {
                        handleRequestRevisions(task);
                      } else {
                        setShowCommentFor(task.id);
                      }
                    }}
                    disabled={actionLoading === task.id}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" /> Request Revisions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Estimate approvals section */}
      {estimateTasks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Pending Estimate Approvals ({estimateTasks.length})</h2>
          {estimateTasks.map((task) => (
            <Card key={task.id} className="border-2 border-warning/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg cursor-pointer hover:underline" onClick={() => navigate(`/tasks/${task.id}`)}>{task.name}</CardTitle>
                    <CardDescription className="mt-1">{task.description}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-warning/10 text-warning">
                    {task.status === "awaiting_input" ? "Re-approval needed" : "Pending"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Estimated hours</span>
                    <p className="font-semibold text-foreground">{task.estimated_hours || "—"}h</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted</span>
                    <p className="font-semibold text-foreground">{new Date(task.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {showCommentFor === task.id && (
                  <Textarea
                    placeholder="Add a comment about requested changes…"
                    value={commentMap[task.id] || ""}
                    onChange={(e) => setCommentMap((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleAction(task.id, "approved")} disabled={actionLoading === task.id} className="gap-2">
                    <CheckCircle className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (showCommentFor === task.id) {
                        handleAction(task.id, "changes_requested");
                      } else {
                        setShowCommentFor(task.id);
                      }
                    }}
                    disabled={actionLoading === task.id}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" /> Request Changes
                  </Button>
                  <Button variant="destructive" onClick={() => handleAction(task.id, "declined")} disabled={actionLoading === task.id} className="gap-2">
                    <XCircle className="h-4 w-4" /> Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-success/40" />
            <p className="font-medium text-foreground">No pending approvals</p>
            <p className="mt-1 text-sm text-muted-foreground">You're all caught up. New tasks will appear here for your review.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
