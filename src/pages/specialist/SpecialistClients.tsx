import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClientGroup {
  accountId: string;
  clientName: string;
  company: string | null;
  taskCount: number;
  activeCount: number;
}

export default function SpecialistClients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchClients = async () => {
      // Get assigned client account IDs from client_specialists table
      const { data: assignments } = await supabase
        .from("client_specialists")
        .select("client_account_id")
        .eq("specialist_id", user.id);

      const assignedAccountIds = (assignments || []).map(a => a.client_account_id);

      // Also get client account IDs from directly assigned tasks (backward compat)
      const { data: tasks } = await supabase
        .from("tasks")
        .select("client_account_id, status")
        .eq("assigned_specialist_id", user.id);

      const taskAccountIds = [...new Set((tasks || []).map(t => t.client_account_id))];
      const allAccountIds = [...new Set([...assignedAccountIds, ...taskAccountIds])];

      if (allAccountIds.length === 0) {
        setLoading(false);
        return;
      }

      // Count tasks per account
      const grouped: Record<string, { total: number; active: number }> = {};
      for (const id of allAccountIds) grouped[id] = { total: 0, active: 0 };
      for (const t of tasks || []) {
        if (!grouped[t.client_account_id]) grouped[t.client_account_id] = { total: 0, active: 0 };
        grouped[t.client_account_id].total++;
        if (!["completed", "declined"].includes(t.status)) grouped[t.client_account_id].active++;
      }

      const { data: accounts } = await supabase
        .from("client_accounts")
        .select("id, user_id")
        .in("id", allAccountIds);

      if (accounts) {
        const userIds = accounts.map(a => a.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, company")
          .in("user_id", userIds);

        const profileMap = Object.fromEntries(
          (profiles || []).map(p => [p.user_id, p])
        );

        setClients(
          accounts.map(a => ({
            accountId: a.id,
            clientName: profileMap[a.user_id]?.full_name || "Unknown",
            company: profileMap[a.user_id]?.company || null,
            taskCount: grouped[a.id]?.total || 0,
            activeCount: grouped[a.id]?.active || 0,
          }))
        );
      }
      setLoading(false);
    };
    fetchClients();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Clients</h1>
        <p className="text-sm text-muted-foreground">Your assigned clients and their task summaries</p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No clients assigned yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(client => (
            <Card
              key={client.accountId}
              className="cursor-pointer transition-colors hover:border-primary/30"
              onClick={() => navigate(`/specialist/tasks?client=${client.accountId}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{client.clientName}</CardTitle>
                {client.company && <CardDescription>{client.company}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary">{client.taskCount} tasks</Badge>
                  {client.activeCount > 0 && (
                    <Badge className="bg-primary/10 text-primary" variant="secondary">
                      {client.activeCount} active
                    </Badge>
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
