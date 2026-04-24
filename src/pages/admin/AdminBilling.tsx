import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, DollarSign, Clock, TrendingUp } from "lucide-react";

interface ClientBilling {
  id: string;
  name: string;
  company: string | null;
  hours_purchased: number;
  hours_used: number;
  rollover_hours: number;
  current_rate: number;
  billable_hours: number;
  non_billable_hours: number;
  amount_billed: number;
}

export default function AdminBilling() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientBilling[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: accounts } = await supabase.from("client_accounts").select("*");
      if (!accounts) { setLoading(false); return; }

      const userIds = accounts.map(a => a.user_id);
      const [profilesRes, logsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, company").in("user_id", userIds),
        supabase.from("time_logs").select("task_id, hours, billable"),
      ]);

      // Map tasks to client accounts
      const accountIds = accounts.map(a => a.id);
      const { data: tasks } = await supabase.from("tasks").select("id, client_account_id").in("client_account_id", accountIds);
      const taskToAccount: Record<string, string> = {};
      (tasks || []).forEach(t => { taskToAccount[t.id] = t.client_account_id; });

      const result: ClientBilling[] = accounts.map(a => {
        const profile = (profilesRes.data || []).find(p => p.user_id === a.user_id);
        const accountTaskIds = (tasks || []).filter(t => t.client_account_id === a.id).map(t => t.id);
        const accountLogs = (logsRes.data || []).filter(l => accountTaskIds.includes(l.task_id));
        const billable_hours = accountLogs.filter(l => l.billable).reduce((s, l) => s + l.hours, 0);
        const non_billable_hours = accountLogs.filter(l => !l.billable).reduce((s, l) => s + l.hours, 0);

        return {
          id: a.id,
          name: profile?.full_name || "Unnamed",
          company: profile?.company || null,
          hours_purchased: a.hours_purchased,
          hours_used: a.hours_used,
          rollover_hours: a.rollover_hours || 0,
          current_rate: a.current_rate,
          billable_hours,
          non_billable_hours,
          amount_billed: billable_hours * a.current_rate,
        };
      });

      setClients(result);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const totalRevenue = clients.reduce((s, c) => s + c.amount_billed, 0);
  const totalBillable = clients.reduce((s, c) => s + c.billable_hours, 0);
  const totalHours = clients.reduce((s, c) => s + c.hours_used, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Billing Control</h1>
        <p className="text-sm text-muted-foreground">Per-client billing breakdown and revenue overview</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><DollarSign className="h-4 w-4" />Total Revenue</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" />Billable Hours</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{totalBillable.toFixed(1)}h</p><p className="text-xs text-muted-foreground">of {totalHours.toFixed(1)}h total</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingUp className="h-4 w-4" />Clients</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-foreground">{clients.length}</p></CardContent>
        </Card>
      </div>

      {/* Per-client table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Client Billing Breakdown</CardTitle></CardHeader>
        <CardContent>
          {clients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2">Client</th>
                    <th className="pb-2">Purchased</th>
                    <th className="pb-2">Used</th>
                    <th className="pb-2">Billable</th>
                    <th className="pb-2">Non-Billable</th>
                    <th className="pb-2">Rate</th>
                    <th className="pb-2">Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr
                      key={c.id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => navigate(`/admin/clients/${c.id}`)}
                    >
                      <td className="py-3">
                        <p className="font-medium text-foreground">{c.name}</p>
                        {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                      </td>
                      <td className="py-3 text-muted-foreground">{c.hours_purchased}h</td>
                      <td className="py-3 text-muted-foreground">{c.hours_used}h</td>
                      <td className="py-3 text-success">{c.billable_hours.toFixed(1)}h</td>
                      <td className="py-3 text-warning">{c.non_billable_hours.toFixed(1)}h</td>
                      <td className="py-3 text-muted-foreground">${c.current_rate}/hr</td>
                      <td className="py-3 font-semibold text-foreground">${c.amount_billed.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No billing data yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
