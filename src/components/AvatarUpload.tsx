import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  name: string | null;
  onUploaded: (url: string) => void;
  size?: "sm" | "lg";
}

export default function AvatarUpload({ userId, currentUrl, name, onUploaded, size = "lg" }: AvatarUploadProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const filePath = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl;

    const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Avatar updated" });
      onUploaded(avatarUrl);
    }
    setUploading(false);
    e.target.value = "";
  };

  const avatarSize = size === "lg" ? "h-20 w-20" : "h-12 w-12";

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <Avatar className={avatarSize}>
          <AvatarImage src={currentUrl || undefined} alt={name || "Avatar"} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Camera className="h-5 w-5 text-foreground" />
        </button>
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : "Change photo"}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}
