import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ArrowLeft, Sparkles, Globe, Target, Megaphone } from "lucide-react";

const ACQUISITION_OPTIONS = [
  "Paid Ads (Google, Meta)",
  "SEO / Organic",
  "Referrals",
  "Social Media",
  "Email Marketing",
  "Cold Outreach",
  "Other",
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1: Business Info
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [hasCrm, setHasCrm] = useState(false);
  const [crmPlatform, setCrmPlatform] = useState("");

  // Step 2: Online Presence
  const [homepage, setHomepage] = useState("");
  const [landingPages, setLandingPages] = useState<string[]>([""]);

  // Step 3: Acquisition
  const [channels, setChannels] = useState<string[]>([]);

  // Step 4: Pain Points & Goals
  const [painPoints, setPainPoints] = useState("");
  const [goals, setGoals] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: acc } = await supabase
        .from("client_accounts")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!acc) { navigate("/dashboard"); return; }
      setAccountId(acc.id);

      const { data: onb } = await supabase
        .from("client_onboarding")
        .select("completed_at")
        .eq("client_account_id", acc.id)
        .single();
      if (onb?.completed_at) { navigate("/dashboard"); return; }
      setLoading(false);
    };
    check();
  }, [user, navigate]);

  const saveAndComplete = async () => {
    if (!accountId || !user) return;
    setSaving(true);
    const filteredPages = landingPages.filter(p => p.trim());
    const payload = {
      client_account_id: accountId,
      business_name: businessName || null,
      industry: industry || null,
      has_existing_crm: hasCrm,
      crm_platform: crmPlatform || null,
      primary_homepage: homepage || null,
      landing_pages: filteredPages.length > 0 ? filteredPages : null,
      acquisition_channels: channels.length > 0 ? channels : null,
      pain_points: painPoints || null,
      goals: goals || null,
      completed_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("client_onboarding")
      .select("id")
      .eq("client_account_id", accountId)
      .single();

    if (existing) {
      await supabase.from("client_onboarding").update(payload).eq("client_account_id", accountId);
    } else {
      await supabase.from("client_onboarding").insert(payload);
    }
    setSaving(false);
    navigate("/dashboard");
  };

  const skipAll = async () => {
    if (!accountId) return;
    setSaving(true);
    const { data: existing } = await supabase
      .from("client_onboarding")
      .select("id")
      .eq("client_account_id", accountId)
      .single();

    if (existing) {
      await supabase.from("client_onboarding").update({ completed_at: new Date().toISOString() }).eq("client_account_id", accountId);
    } else {
      await supabase.from("client_onboarding").insert({ client_account_id: accountId, completed_at: new Date().toISOString() });
    }
    setSaving(false);
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const steps = [
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "Business Info",
      desc: "Tell us about your business",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. SaaS, E-commerce, Real Estate" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="cursor-pointer">Do you have an existing CRM?</Label>
            <Switch checked={hasCrm} onCheckedChange={setHasCrm} />
          </div>
          {hasCrm && (
            <div className="space-y-2">
              <Label>Which CRM platform?</Label>
              <Input value={crmPlatform} onChange={e => setCrmPlatform(e.target.value)} placeholder="e.g. HubSpot, Salesforce, GoHighLevel" />
            </div>
          )}
        </div>
      ),
    },
    {
      icon: <Globe className="h-5 w-5" />,
      title: "Online Presence",
      desc: "Share your website and landing pages",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Homepage URL</Label>
            <Input value={homepage} onChange={e => setHomepage(e.target.value)} placeholder="https://yoursite.com" />
          </div>
          <div className="space-y-2">
            <Label>Main Landing Pages</Label>
            {landingPages.map((lp, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={lp}
                  onChange={e => {
                    const copy = [...landingPages];
                    copy[i] = e.target.value;
                    setLandingPages(copy);
                  }}
                  placeholder={`Landing page URL ${i + 1}`}
                />
                {landingPages.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setLandingPages(landingPages.filter((_, j) => j !== i))}>×</Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLandingPages([...landingPages, ""])}>+ Add another</Button>
          </div>
        </div>
      ),
    },
    {
      icon: <Megaphone className="h-5 w-5" />,
      title: "Acquisition & Growth",
      desc: "How do you currently acquire customers?",
      content: (
        <div className="space-y-3">
          {ACQUISITION_OPTIONS.map(opt => (
            <label key={opt} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer transition-colors hover:border-primary/30">
              <Checkbox
                checked={channels.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) setChannels([...channels, opt]);
                  else setChannels(channels.filter(c => c !== opt));
                }}
              />
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      ),
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: "Pain Points & Goals",
      desc: "What challenges are you facing and where do you want to be?",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Pain Points</Label>
            <Textarea value={painPoints} onChange={e => setPainPoints(e.target.value)} placeholder="What's not working or frustrating you right now?" rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Goals with Arcytex</Label>
            <Textarea value={goals} onChange={e => setGoals(e.target.value)} placeholder="What do you want to achieve in the next 3-6 months?" rows={4} />
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={skipAll} disabled={saving} className="text-muted-foreground text-xs">
            Skip all
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">{currentStep.icon}</div>
            <CardTitle className="text-xl">{currentStep.title}</CardTitle>
            <CardDescription>{currentStep.desc}</CardDescription>
          </CardHeader>
          <CardContent>{currentStep.content}</CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => isLast ? saveAndComplete() : setStep(s => s + 1)} className="text-muted-foreground">
              Skip
            </Button>
            {isLast ? (
              <Button onClick={saveAndComplete} disabled={saving}>
                {saving ? "Saving…" : "Complete Setup"} <Sparkles className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep(s => s + 1)}>
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
