import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, TrendingUp, Clock, DollarSign, AlertTriangle, UserPlus } from "lucide-react";

interface ClientRow {
  id: string;
  user_id: string;
  hours_purchased: number;
  hours_used: number;
  current_rate: number;
  health_status?: string;
  rollover_hours?: number;
  client_since?: string;
  profile?: { full_name: string | null; email: string | null; company: string | null };
}

const healthColors: Record<string, string> = {
  healthy: "bg-success/10 text-success",
  at_risk: "bg-warning/10 text-warning",
  unhappy: "bg-destructive/10 text-destructive",
};

export default function AdminClients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [allocation, setAllocation] = useState("10");
  const [rate, setRate] = useState("100");
  const [creating, setCreating] = useState(false);

  const fetchClients = async () => {
    const { data: accounts } = await supabase.from("client_accounts").select("*");
    if (!accounts) { setLoading(false); return; }
    const userIds = accounts.map((a) => a.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, company").in("user_id", userIds);
    const merged = accounts.map((a) => ({
      ...a,
      profile: profiles?.find((p) => p.user_id === a.user_id) || undefined,
    }));
    setClients(merged);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleAddClient = async () => {
    if (!email || !fullName) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-client", {
        body: { email, full_name: fullName, company, monthly_allocation: parseFloat(allocation), rate: parseFloat(rate) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Client created", description: `${fullName} has been added. A password reset email was sent.` });
      setDialogOpen(false);
      setEmail(""); setFullName(""); setCompany(""); setAllocation("10"); setRate("100");
      fetchClients();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // KPI calculations
  const totalClients = clients.length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = clients.filter((c) => c.client_since && new Date(c.client_since) >= startOfMonth).length;
  const totalHoursBilled = clients.reduce((sum, c) => sum + (c.hours_used || 0), 0);
  const totalRevenue = clients.reduce((sum, c) => sum + (c.hours_used || 0) * (c.current_rate || 0), 0);
  const attentionNeeded = clients.filter((c) => {
    if (c.health_status === "at_risk" || c.health_status === "unhappy") return true;
    const remaining = (c.hours_purchased || 0) - (c.hours_used || 0) + (c.rollover_hours || 0);
    const pct = c.hours_purchased > 0 ? (c.hours_used / c.hours_purchased) * 100 : 0;
    return pct >= 90 || remaining <= 2;
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Client Accounts</h1>
          <p className="text-sm text-muted-foreground">Overview of all client balances and usage</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>Create a client account. They'll receive a password reset email.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="client@company.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Monthly Hours</Label>
                  <Input type="number" value={allocation} onChange={e => setAllocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rate ($/hr)</Label>
                  <Input type="number" value={rate} onChange={e => setRate(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAddClient} disabled={creating || !email || !fullName} className="w-full">
                {creating ? "Creating…" : "Create Client"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Users className="h-4 w-4" /> Total Clients</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> New This Month</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{newThisMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Clock className="h-4 w-4" /> Total Hours Billed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalHoursBilled.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><DollarSign className="h-4 w-4" /> Total Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">${totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={attentionNeeded > 0 ? "border-warning/30" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Needs Attention</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${attentionNeeded > 0 ? "text-warning" : "text-foreground"}`}>{attentionNeeded}</p>
          </CardContent>
        </Card>
      </div>

      {clients.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No client accounts yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const remaining = client.hours_purchased - client.hours_used + (client.rollover_hours || 0);
            const pct = client.hours_purchased > 0 ? (client.hours_used / client.hours_purchased) * 100 : 0;
            return (
              <Card
                key={client.id}
                className="cursor-pointer transition-all hover:border-primary/20 hover:shadow-lg"
                onClick={() => navigate(`/admin/clients/${client.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{client.profile?.full_name || "Unnamed"}</CardTitle>
                    {client.health_status && client.health_status !== "healthy" && (
                      <Badge className={healthColors[client.health_status]} variant="secondary">
                        {client.health_status === "at_risk" ? "At Risk" : "Unhappy"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{client.profile?.company || client.profile?.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-semibold">{remaining.toFixed(1)}h remaining</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{client.hours_used}h used</span>
                    <span>${client.current_rate}/hr</span>
                  </div>
                  {pct >= 90 && <Badge variant="destructive">Low balance</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
