
-- Phase B: Credentials vault table
CREATE TABLE public.task_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  label text NOT NULL,
  credential_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_credentials ENABLE ROW LEVEL SECURITY;

-- Clients can insert & view credentials on their own tasks
CREATE POLICY "Clients can add credentials to own tasks"
  ON public.task_credentials FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN client_accounts ca ON ca.id = t.client_account_id
      WHERE t.id = task_credentials.task_id AND ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own task credentials"
  ON public.task_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN client_accounts ca ON ca.id = t.client_account_id
      WHERE t.id = task_credentials.task_id AND ca.user_id = auth.uid()
    )
  );

-- Specialists can view credentials on assigned tasks
CREATE POLICY "Specialists can view assigned task credentials"
  ON public.task_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_credentials.task_id AND t.assigned_specialist_id = auth.uid()
    )
    AND has_role(auth.uid(), 'specialist'::app_role)
  );

-- Admins can manage all credentials
CREATE POLICY "Admins can manage all credentials"
  ON public.task_credentials FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can delete their own credentials
CREATE POLICY "Clients can delete own credentials"
  ON public.task_credentials FOR DELETE
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN client_accounts ca ON ca.id = t.client_account_id
      WHERE t.id = task_credentials.task_id AND ca.user_id = auth.uid()
    )
  );
