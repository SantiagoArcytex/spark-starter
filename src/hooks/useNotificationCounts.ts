import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NotificationCounts {
  pendingApprovals: number;
  unreadTasks: number; // tasks with status changes (awaiting_input)
}

export function useNotificationCounts() {
  const { user, isClient, isSpecialist } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ pendingApprovals: 0, unreadTasks: 0 });

  const fetchCounts = async () => {
    if (!user) return;

    if (isClient) {
      // Count tasks needing client action
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status")
        .in("status", ["submitted", "awaiting_input"]);

      setCounts({
        pendingApprovals: tasks?.filter((t) => t.status === "submitted").length || 0,
        unreadTasks: tasks?.filter((t) => t.status === "awaiting_input").length || 0,
      });
    }

    if (isSpecialist) {
      // Count tasks needing specialist action (submitted = needs estimate, in_progress = active)
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status")
        .eq("assigned_specialist_id", user.id);

      setCounts({
        pendingApprovals: tasks?.filter((t) => t.status === "submitted").length || 0,
        unreadTasks: tasks?.filter((t) => t.status === "in_progress" || t.status === "awaiting_input").length || 0,
      });
    }
  };

  useEffect(() => {
    fetchCounts();

    // Subscribe to task changes for live updates
    const channel = supabase
      .channel("notification-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchCounts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isClient, isSpecialist]);

  return counts;
}
