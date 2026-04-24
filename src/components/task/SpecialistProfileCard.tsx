import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  specialist_certification: string | null;
  specialist_bio: string | null;
}

export default function SpecialistProfileCard({ specialistId }: { specialistId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("full_name, avatar_url, specialist_certification, specialist_bio")
      .eq("user_id", specialistId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as any);
      });
  }, [specialistId]);

  if (!profile) return null;

  const initials = (profile.full_name || "S")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <Avatar className="h-12 w-12 border border-border">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            {initials || <User className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{profile.full_name || "Specialist"}</p>
          {profile.specialist_certification && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {profile.specialist_certification}
            </Badge>
          )}
          {profile.specialist_bio && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {profile.specialist_bio}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
