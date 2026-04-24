
-- Table: client_specialists (many-to-many specialist-to-client mapping)
CREATE TABLE public.client_specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(client_account_id, specialist_id)
);

ALTER TABLE public.client_specialists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_specialists" ON public.client_specialists FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admins can manage client_specialists" ON public.client_specialists FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can manage client_specialists" ON public.client_specialists FOR ALL USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Specialists can view own assignments" ON public.client_specialists FOR SELECT USING (specialist_id = auth.uid());
CREATE POLICY "Clients can view own account specialists" ON public.client_specialists FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_specialists.client_account_id AND ca.user_id = auth.uid())
);

-- Table: client_onboarding (1:1 per client account)
CREATE TABLE public.client_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL UNIQUE REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  business_name text,
  industry text,
  acquisition_channels text[],
  primary_homepage text,
  landing_pages text[],
  pain_points text,
  has_existing_crm boolean DEFAULT false,
  crm_platform text,
  goals text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_onboarding" ON public.client_onboarding FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admins can manage client_onboarding" ON public.client_onboarding FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can view client_onboarding" ON public.client_onboarding FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Clients can view own onboarding" ON public.client_onboarding FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_onboarding.client_account_id AND ca.user_id = auth.uid())
);
CREATE POLICY "Clients can insert own onboarding" ON public.client_onboarding FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_onboarding.client_account_id AND ca.user_id = auth.uid())
);
CREATE POLICY "Clients can update own onboarding" ON public.client_onboarding FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_onboarding.client_account_id AND ca.user_id = auth.uid())
);
