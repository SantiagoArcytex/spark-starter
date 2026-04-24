-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('client', 'specialist', 'admin');

-- Create enum for task status
CREATE TYPE public.task_status AS ENUM (
  'submitted', 'in_review', 'in_progress', 'awaiting_input', 'completed', 'declined'
);

-- Create enum for approval action
CREATE TYPE public.approval_action AS ENUM ('approved', 'declined', 'changes_requested');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Client accounts table
CREATE TABLE public.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hours_purchased NUMERIC(10,2) NOT NULL DEFAULT 0,
  hours_used NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_rate NUMERIC(10,2) NOT NULL DEFAULT 100,
  alert_70_sent BOOLEAN NOT NULL DEFAULT false,
  alert_90_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  assigned_specialist_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'submitted',
  estimated_hours NUMERIC(10,2),
  actual_hours NUMERIC(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Task approvals audit log
CREATE TABLE public.task_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  comment TEXT,
  acted_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_approvals ENABLE ROW LEVEL SECURITY;

-- Hour blocks (purchase history)
CREATE TABLE public.hour_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  hours NUMERIC(10,2) NOT NULL,
  rate NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hour_blocks ENABLE ROW LEVEL SECURITY;

-- Time logs
CREATE TABLE public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES auth.users(id),
  hours NUMERIC(10,2) NOT NULL,
  description TEXT,
  billable BOOLEAN NOT NULL DEFAULT true,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  hour_block_id UUID REFERENCES public.hour_blocks(id),
  total_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_accounts_updated_at BEFORE UPDATE ON public.client_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Client accounts
CREATE POLICY "Clients can view own account" ON public.client_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all accounts" ON public.client_accounts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tasks
CREATE POLICY "Clients can view own tasks" ON public.tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_account_id AND ca.user_id = auth.uid()));
CREATE POLICY "Admins can manage all tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Specialists can view assigned tasks" ON public.tasks FOR SELECT
  USING (assigned_specialist_id = auth.uid() AND public.has_role(auth.uid(), 'specialist'));
CREATE POLICY "Specialists can update assigned tasks" ON public.tasks FOR UPDATE
  USING (assigned_specialist_id = auth.uid() AND public.has_role(auth.uid(), 'specialist'));

-- Task approvals
CREATE POLICY "Clients can view own approvals" ON public.task_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.client_accounts ca ON ca.id = t.client_account_id
    WHERE t.id = task_id AND ca.user_id = auth.uid()
  ));
CREATE POLICY "Clients can create approvals" ON public.task_approvals FOR INSERT
  WITH CHECK (acted_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.client_accounts ca ON ca.id = t.client_account_id
    WHERE t.id = task_id AND ca.user_id = auth.uid()
  ));
CREATE POLICY "Admins can manage all approvals" ON public.task_approvals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Hour blocks
CREATE POLICY "Clients can view own blocks" ON public.hour_blocks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_account_id AND ca.user_id = auth.uid()));
CREATE POLICY "Admins can manage all blocks" ON public.hour_blocks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Time logs
CREATE POLICY "Specialists can manage own logs" ON public.time_logs FOR ALL USING (specialist_id = auth.uid() AND public.has_role(auth.uid(), 'specialist'));
CREATE POLICY "Admins can manage all logs" ON public.time_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients can view own task logs" ON public.time_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.client_accounts ca ON ca.id = t.client_account_id
    WHERE t.id = task_id AND ca.user_id = auth.uid()
  ));

-- Invoices
CREATE POLICY "Clients can view own invoices" ON public.invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_account_id AND ca.user_id = auth.uid()));
CREATE POLICY "Admins can manage all invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));