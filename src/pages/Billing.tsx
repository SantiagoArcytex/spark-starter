import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const pricingTiers = [
  { range: "1–10 hrs", rate: 100, hours: 10, priceId: "price_1T7iocA59zIOlwLqDVJx1Ckz", total: 1000 },
  { range: "11–30 hrs", rate: 90, hours: 30, priceId: "price_1T7ipLA59zIOlwLqMCayYsJZ", total: 2700 },
  { range: "31–50 hrs", rate: 85, hours: 50, priceId: "price_1T7ipXA59zIOlwLq7sj6RgVQ", total: 4250, popular: true },
  { range: "50+ hrs", rate: 80, hours: 60, priceId: "price_1T7ipzA59zIOlwLqdAJbCSTa", total: 4800 },
];

interface Invoice {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchInvoices = async () => {
      const { data: account } = await supabase
        .from("client_accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (account) {
        const { data } = await supabase
          .from("invoices")
          .select("*")
          .eq("client_account_id", account.id)
          .order("created_at", { ascending: false });
        if (data) setInvoices(data);
      }
      setLoadingInvoices(false);
    };
    fetchInvoices();
  }, [user]);

  const handlePurchase = async (priceId: string) => {
    setLoadingTier(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Billing</h1>
        <p className="text-sm text-muted-foreground">Purchase hour blocks and view invoices</p>
      </div>

      {/* Pricing tiers */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground font-display">Purchase Hours</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricingTiers.map((tier) => (
            <Card key={tier.range} className={`relative overflow-hidden transition-all hover:shadow-lg ${tier.popular ? 'gradient-border' : ''}`}>
              {tier.popular && (
                <div className="absolute right-3 top-3">
                  <Badge className="bg-primary text-primary-foreground font-semibold">Popular</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {tier.range}
                </CardDescription>
                <CardTitle className="text-3xl">
                  ${tier.rate}<span className="text-base font-normal text-muted-foreground">/hr</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-1 text-sm text-muted-foreground">
                  {tier.hours} hours at ${tier.rate}/hr
                </p>
                <p className="mb-4 text-lg font-semibold text-foreground font-display">
                  ${tier.total.toLocaleString()}
                </p>
                <Button
                  className={`w-full gap-2 font-semibold ${tier.popular ? '' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                  onClick={() => handlePurchase(tier.priceId)}
                  disabled={loadingTier !== null}
                >
                  {loadingTier === tier.priceId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Purchase
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice History</CardTitle>
          <CardDescription>Your past purchases and invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:border-primary/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      ${inv.total_amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                    {inv.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No invoices yet. Purchase your first hour block to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
