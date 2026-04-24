

# Implementation Plan: Business OS Dashboard, Task Creation & Task Detail Enhancements

## What Exists vs. What's Missing

### Admin Dashboard — Currently Missing
The admin has no unified "home" dashboard. They land on the Clients page. There is no single view showing week-over-week / month-over-month business performance.

### Task Creation (Client) — Partially Done
`SubmitTaskDialog` already has: category, name, description, Loom URL, file upload, credentials, scope toggle, priority. **Missing**: subtasks field, document upload (separate from screenshot), and the dialog trigger is only in the header — not prominently accessible from the task list area.

### Task Detail View — Missing Fields
- **Client view**: No visibility into who the specialist is (name, avatar), no task timeline/history, no subtasks
- **Specialist view**: No client context (company name, contact), no task creation date context, no subtask checklist
- **Both views**: No activity log / task history (status changes, approvals, time logs as a timeline)

---

## Implementation Steps

### Step 1: Admin Home Dashboard (New Page)

Create `src/pages/admin/AdminDashboard.tsx` — a new landing page at `/admin` with:

**KPI Cards (top row):**
- New tasks this week / this month (with week-over-week delta)
- Clients onboarded this month
- Monthly recurring revenue (sum of all client `monthly_allocation * current_rate`)
- Total billed revenue this month (from time_logs)

**Actionable Sections:**
- "Clients Needing Attention" — cards for clients with `health_status != 'healthy'` or usage > 90% or 0 active tasks in 30 days
- "At Risk Tasks" — list of tasks with `at_risk = true`
- "Pending Approvals" — tasks in `submitted` or `ready_for_review` status
- Quick trend: tasks created per week for last 4 weeks (simple bar or numbers)

**Route change:** Update `AdminLayout.tsx` nav to add "Dashboard" as first item at `/admin/dashboard`. Add route in `App.tsx`.

### Step 2: Task Creation Enhancements

Update `SubmitTaskDialog.tsx`:

- **Add subtasks field**: A simple repeater — "Add subtask" button that appends text inputs. Store as JSON in a new `subtasks` column on `tasks` table (jsonb, nullable, default null). Each subtask is `{ title: string, completed: boolean }`.
- **Separate document upload**: Allow multiple file uploads (not just one). Change from single `file` state to `files: File[]` array. Upload each to storage and create `task_deliverables` entries.
- **Make "Submit Task" more prominent on Dashboard**: Add a floating action button or a prominent CTA card at the top of the empty task list.

**DB migration:** Add `subtasks jsonb DEFAULT NULL` column to `tasks` table.

### Step 3: Task Detail — Activity Timeline

Add a new tab "Activity" to `TaskDetail.tsx` alongside Messages and Deliverables:

- Query `task_approvals` for approval/rejection events
- Query `time_logs` for hour log events
- Query task status changes (derive from `updated_at` or add a `task_activity_log` table)
- Display as a chronological timeline with icons per event type

**New table: `task_activity_log`**
- `id uuid PK`, `task_id uuid NOT NULL`, `actor_id uuid NOT NULL`, `action text NOT NULL` (e.g. 'status_change', 'hours_logged', 'estimate_submitted'), `details jsonb`, `created_at timestamptz DEFAULT now()`
- RLS: same as tasks (admin ALL, client SELECT own, specialist SELECT assigned)

**Auto-log activities:** When status changes, hours are logged, or estimates submitted — insert into `task_activity_log`. This is done in the existing handlers in `TaskDetail.tsx`.

### Step 4: Task Detail — Subtask Checklist

On `TaskDetail.tsx`, if `task.subtasks` is not null:
- Render a checklist of subtasks
- Specialists can toggle completion
- Clients can view progress (X of Y completed)
- Update the `tasks.subtasks` jsonb column on toggle

### Step 5: Task Detail — Missing Context Fields

**Client view additions:**
- Show assigned specialist name + avatar (already exists via `SpecialistProfileCard` but only for non-admin — verify it renders for clients)
- Show task category badge
- Show creation date prominently

**Specialist view additions:**
- Show client name + company at top of task (query from `client_accounts` + `profiles`)
- Show task category
- Show other specialists assigned (from `task_specialists`)

### Step 6: Dashboard Task Creation Prominence

On `Dashboard.tsx`:
- Move the `SubmitTaskDialog` trigger to also appear as a large CTA card when there are fewer than 3 active tasks, or always show a "+" floating button in the bottom-right corner on mobile
- Add the submit button inside the "Active Tasks" card header area (already exists in top bar, but add secondary placement)

---

## Database Migration

Single migration:
```sql
-- Add subtasks column to tasks
ALTER TABLE tasks ADD COLUMN subtasks jsonb DEFAULT NULL;

-- Activity log table
CREATE TABLE task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_activity_log
CREATE POLICY "Admins can manage activity_log" ON task_activity_log FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admins can manage activity_log" ON task_activity_log FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tech leads can view activity_log" ON task_activity_log FOR SELECT USING (has_role(auth.uid(), 'tech_lead'));
CREATE POLICY "Clients can view own task activity" ON task_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM tasks t JOIN client_accounts ca ON ca.id = t.client_account_id WHERE t.id = task_activity_log.task_id AND ca.user_id = auth.uid())
);
CREATE POLICY "Specialists can view assigned task activity" ON task_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_activity_log.task_id AND t.assigned_specialist_id = auth.uid())
);
CREATE POLICY "Authenticated can insert activity" ON task_activity_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
```

## Files to Create/Edit

| Action | File |
|--------|------|
| Create | `src/pages/admin/AdminDashboard.tsx` |
| Edit | `src/components/layouts/AdminLayout.tsx` — add Dashboard nav item |
| Edit | `src/App.tsx` — add `/admin/dashboard` route |
| Edit | `src/components/SubmitTaskDialog.tsx` — add subtasks + multi-file |
| Edit | `src/pages/TaskDetail.tsx` — add Activity tab, subtask checklist, client/specialist context |
| Edit | `src/pages/Dashboard.tsx` — prominent task creation CTA |

## Implementation Order

```text
Step 1: DB migration (subtasks column + task_activity_log table)
Step 2: Admin Dashboard page + routing
Step 3: SubmitTaskDialog — subtasks + multi-file uploads
Step 4: TaskDetail — activity timeline tab
Step 5: TaskDetail — subtask checklist + missing context
Step 6: Dashboard — prominent task creation CTA
```

