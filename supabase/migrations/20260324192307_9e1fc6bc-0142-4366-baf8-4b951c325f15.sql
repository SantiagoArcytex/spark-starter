
-- Add subtasks column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks jsonb DEFAULT NULL;

-- Activity log table
CREATE TABLE IF NOT EXISTS task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage activity_log" ON task_activity_log FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Super admins can manage activity_log" ON task_activity_log FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Tech leads can view activity_log" ON task_activity_log FOR SELECT USING (has_role(auth.uid(), 'tech_lead'::app_role));
CREATE POLICY "Clients can view own task activity" ON task_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM tasks t JOIN client_accounts ca ON ca.id = t.client_account_id WHERE t.id = task_activity_log.task_id AND ca.user_id = auth.uid())
);
CREATE POLICY "Specialists can view assigned task activity" ON task_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_activity_log.task_id AND (t.assigned_specialist_id = auth.uid() OR EXISTS (SELECT 1 FROM task_specialists ts WHERE ts.task_id = t.id AND ts.specialist_id = auth.uid())))
);
CREATE POLICY "Authenticated can insert activity" ON task_activity_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
