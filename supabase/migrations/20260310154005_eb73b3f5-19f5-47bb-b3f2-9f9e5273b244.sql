
-- Add at_risk to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS at_risk boolean DEFAULT false;

-- Create task_specialists table
CREATE TABLE IF NOT EXISTS public.task_specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL,
  role text DEFAULT 'contributor',
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(task_id, specialist_id)
);
ALTER TABLE public.task_specialists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage task_specialists" ON public.task_specialists FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admins can manage task_specialists" ON public.task_specialists FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can manage task_specialists" ON public.task_specialists FOR ALL USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Specialists can view own task_specialists" ON public.task_specialists FOR SELECT USING (specialist_id = auth.uid());

-- Make time_logs.task_id nullable and add activity columns
ALTER TABLE public.time_logs ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS activity_type text DEFAULT 'task';
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS activity_label text;

-- RLS for new roles
CREATE POLICY "Tech leads can view all tasks" ON public.tasks FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Tech leads can update tasks" ON public.tasks FOR UPDATE USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Super admins can manage all tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tech leads can view all time_logs" ON public.time_logs FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Super admins can manage all time_logs" ON public.time_logs FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tech leads can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage all accounts" ON public.client_accounts FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can view all accounts" ON public.client_accounts FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));

CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can view roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));

CREATE POLICY "Super admins can manage notifications" ON public.notifications FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can view notifications" ON public.notifications FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));

CREATE POLICY "Super admins can manage all messages" ON public.messages FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can view all messages" ON public.messages FOR SELECT USING (public.has_role(auth.uid(), 'tech_lead'));

-- Specialists can view/update tasks via task_specialists
CREATE POLICY "Specialists can view tasks via task_specialists" ON public.tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.task_specialists ts WHERE ts.task_id = tasks.id AND ts.specialist_id = auth.uid()));
CREATE POLICY "Specialists can update tasks via task_specialists" ON public.tasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.task_specialists ts WHERE ts.task_id = tasks.id AND ts.specialist_id = auth.uid()));

-- Super admin on remaining tables
CREATE POLICY "Super admins can manage hour_credits" ON public.hour_credits FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage milestones" ON public.specialist_milestones FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage hour_blocks" ON public.hour_blocks FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage task_approvals" ON public.task_approvals FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage task_credentials" ON public.task_credentials FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage task_deliverables" ON public.task_deliverables FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
