import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Video, FileText, Link2, Upload, Image as ImageIcon } from "lucide-react";

interface Deliverable {
  id: string;
  type: string;
  url: string;
  file_name: string | null;
  created_at: string;
}

interface TaskDeliverablesProps {
  taskId: string;
}

function isLoomUrl(url: string) {
  return /loom\.com\/(share|embed)\//.test(url);
}

function getLoomEmbedUrl(url: string) {
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  return match ? `https://www.loom.com/embed/${match[1]}` : null;
}

function isImageUrl(url: string) {
  return /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);
}

export default function TaskDeliverables({ taskId }: TaskDeliverablesProps) {
  const { user, isSpecialist, isClient } = useAuth();
  const { toast } = useToast();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableType, setDeliverableType] = useState<"link" | "loom" | "file">("link");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canUpload = isSpecialist || isClient;

  const fetchDeliverables = async () => {
    const { data } = await supabase
      .from("task_deliverables")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (data) setDeliverables(data as any);
  };

  useEffect(() => { fetchDeliverables(); }, [taskId]);

  const submitDeliverable = async () => {
    if (!user || !deliverableUrl.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("task_deliverables").insert({
      task_id: taskId,
      uploaded_by: user.id,
      type: deliverableType as any,
      url: deliverableUrl.trim(),
      file_name: deliverableType === "loom" ? "Loom Recording" : deliverableUrl.trim().split("/").pop() || "Link",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deliverable added" });
      setDeliverableUrl("");
      fetchDeliverables();
    }
    setSubmitting(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const filePath = `${taskId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("deliverables").upload(filePath, file);

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("deliverables").getPublicUrl(filePath);

    const { error } = await supabase.from("task_deliverables").insert({
      task_id: taskId,
      uploaded_by: user.id,
      type: "file" as any,
      url: urlData.publicUrl,
      file_name: file.name,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "File uploaded" });
      fetchDeliverables();
    }
    setUploading(false);
    e.target.value = "";
  };

  const renderDeliverable = (d: Deliverable) => {
    if (d.type === "loom" && isLoomUrl(d.url)) {
      const embedUrl = getLoomEmbedUrl(d.url);
      return (
        <div key={d.id} className="space-y-2">
          {embedUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
              <iframe src={embedUrl} className="h-full w-full" allowFullScreen title={d.file_name || "Loom video"} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{d.file_name || "Loom Recording"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      );
    }

    if (d.type === "file" && isImageUrl(d.url)) {
      return (
        <div key={d.id} className="space-y-2">
          <a href={d.url} target="_blank" rel="noopener noreferrer">
            <img src={d.url} alt={d.file_name || "Screenshot"} className="max-h-64 w-full rounded-lg border border-border object-contain" />
          </a>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{d.file_name || "Image"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
        {d.type === "file" ? <FileText className="h-5 w-5 text-primary" /> : d.type === "loom" ? <Video className="h-5 w-5 text-primary" /> : <Link2 className="h-5 w-5 text-primary" />}
        <div className="min-w-0 flex-1">
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline">{d.file_name || d.url}</a>
          <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</p>
        </div>
        <Badge variant="secondary" className="capitalize">{d.type}</Badge>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {deliverables.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No deliverables shared yet.</p>
        ) : (
          <div className="space-y-4">{deliverables.map(renderDeliverable)}</div>
        )}

        {canUpload && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              {isClient ? "Share a file or link" : "Add deliverable"}
            </p>
            <div className="flex gap-2">
              <Button variant={deliverableType === "link" ? "default" : "outline"} size="sm" onClick={() => setDeliverableType("link")}>
                <Link2 className="mr-1 h-3.5 w-3.5" /> Link
              </Button>
              <Button variant={deliverableType === "loom" ? "default" : "outline"} size="sm" onClick={() => setDeliverableType("loom")}>
                <Video className="mr-1 h-3.5 w-3.5" /> Loom
              </Button>
              <label>
                <Button variant={deliverableType === "file" ? "default" : "outline"} size="sm" onClick={() => setDeliverableType("file")} asChild>
                  <span><Upload className="mr-1 h-3.5 w-3.5" /> File</span>
                </Button>
              </label>
            </div>

            {deliverableType === "file" ? (
              <div>
                <Input type="file" onChange={handleFileUpload} disabled={uploading} className="cursor-pointer" />
                {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder={deliverableType === "loom" ? "Paste Loom URL…" : "Paste URL…"}
                />
                <Button onClick={submitDeliverable} disabled={submitting || !deliverableUrl.trim()}>
                  <Upload className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
