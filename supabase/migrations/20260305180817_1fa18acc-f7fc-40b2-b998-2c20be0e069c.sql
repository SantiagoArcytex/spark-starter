
-- Add priority, is_urgent, requested_by columns to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requested_by uuid;

-- Create deliverable_type enum
CREATE TYPE public.deliverable_type AS ENUM ('file', 'link', 'loom');

-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages RLS: participants can view (client who owns the task, assigned specialist, admins)
CREATE POLICY "Clients can view own task messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN client_accounts ca ON ca.id = t.client_account_id
      WHERE t.id = messages.task_id AND ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can view assigned task messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = messages.task_id AND t.assigned_specialist_id = auth.uid()
    ) AND has_role(auth.uid(), 'specialist')
  );

CREATE POLICY "Admins can manage all messages" ON public.messages
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can send messages on own tasks" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN client_accounts ca ON ca.id = t.client_account_id
      WHERE t.id = messages.task_id AND ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can send messages on assigned tasks" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = messages.task_id AND t.assigned_specialist_id = auth.uid()
    ) AND has_role(auth.uid(), 'specialist')
  );

-- Create task_deliverables table
CREATE TABLE public.task_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  type deliverable_type NOT NULL,
  url text NOT NULL,
  file_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.task_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own task deliverables" ON public.task_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN client_accounts ca ON ca.id = t.client_account_id
      WHERE t.id = task_deliverables.task_id AND ca.user_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can view assigned task deliverables" ON public.task_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_deliverables.task_id AND t.assigned_specialist_id = auth.uid()
    ) AND has_role(auth.uid(), 'specialist')
  );

CREATE POLICY "Specialists can add deliverables to assigned tasks" ON public.task_deliverables
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_deliverables.task_id AND t.assigned_specialist_id = auth.uid()
    ) AND has_role(auth.uid(), 'specialist')
  );

CREATE POLICY "Admins can manage all deliverables" ON public.task_deliverables
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create storage bucket for deliverables
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverables', 'deliverables', true);

-- Storage RLS for deliverables bucket
CREATE POLICY "Authenticated users can upload deliverables" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'deliverables' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view deliverables" ON storage.objects
  FOR SELECT USING (bucket_id = 'deliverables');

-- Enable realtime on messages and tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add RLS for clients to insert tasks (task submission)
CREATE POLICY "Clients can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_accounts ca
      WHERE ca.id = tasks.client_account_id AND ca.user_id = auth.uid()
    )
  );

-- Allow specialists to view profiles (for messaging display names)
CREATE POLICY "Specialists can view profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'specialist'));
