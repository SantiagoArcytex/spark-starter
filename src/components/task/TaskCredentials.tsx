import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Eye, EyeOff, Trash2, KeyRound } from "lucide-react";

interface Credential {
  id: string;
  label: string;
  credential_value: string;
  created_at: string;
}

interface TaskCredentialsProps {
  taskId: string;
}

export default function TaskCredentials({ taskId }: TaskCredentialsProps) {
  const { user, isClient, isSpecialist } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCredentials = async () => {
    const { data } = await supabase
      .from("task_credentials")
      .select("id, label, credential_value, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (data) setCredentials(data);
  };

  useEffect(() => {
    fetchCredentials();
  }, [taskId]);

  const handleAdd = async () => {
    if (!user || !label.trim() || !value.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("task_credentials").insert({
      task_id: taskId,
      client_id: user.id,
      label: label.trim(),
      credential_value: value.trim(),
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Credential added securely" });
      setLabel("");
      setValue("");
      setAdding(false);
      fetchCredentials();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("task_credentials").delete().eq("id", id);
    fetchCredentials();
  };

  const toggleShow = (id: string) => {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (credentials.length === 0 && !isClient) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Login Credentials
        </CardTitle>
        <CardDescription>
          {isClient
            ? "Securely share login details with your specialist."
            : "Credentials shared by the client for this task."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {credentials.length > 0 && (
          <div className="space-y-2">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{cred.label}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {showValues[cred.id] ? cred.credential_value : "••••••••••"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => toggleShow(cred.id)}>
                  {showValues[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {isClient && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cred.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isClient && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add credential
          </Button>
        )}

        {isClient && adding && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. WordPress Admin, Hosting SSH"
              />
            </div>
            <div className="space-y-1">
              <Label>Value (username, password, URL, etc.)</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. admin / P@ssw0rd123"
                type="password"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={submitting || !label.trim() || !value.trim()}>
                {submitting ? "Saving…" : "Save credential"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isSpecialist && credentials.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            No credentials shared yet. The client can add them from this page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
