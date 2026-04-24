
-- New columns on client_accounts
ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS onboarding_date timestamptz,
  ADD COLUMN IF NOT EXISTS client_since timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'healthy',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS assigned_specialist_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_pm_id uuid,
  ADD COLUMN IF NOT EXISTS rollover_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_allocation numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- New columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS salary numeric,
  ADD COLUMN IF NOT EXISTS health_score integer;

-- Specialist milestones table
CREATE TABLE IF NOT EXISTS public.specialist_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL,
  title text NOT NULL,
  achieved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.specialist_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage milestones" ON public.specialist_milestones FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Hour credits table
CREATE TABLE IF NOT EXISTS public.hour_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  hours numeric NOT NULL,
  reason text NOT NULL,
  credited_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hour_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage hour_credits" ON public.hour_credits FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Clients can view own credits" ON public.hour_credits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM client_accounts ca WHERE ca.id = hour_credits.client_account_id AND ca.user_id = auth.uid()
  )
);
