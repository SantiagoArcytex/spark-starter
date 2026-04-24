# Arcytex Portal — Backend, Database & Integrations System Design

**Version:** 1.0  
**Last updated:** 2026-04-24  
**Owner:** Arcytex Engineering  
**Stack:** React 18 + Vite + TypeScript (frontend) · Supabase (Postgres + Auth + Storage + Edge Functions) via Lovable Cloud · Stripe (payments) · Lovable AI Gateway (LLM)

---

## 1. System Overview

The Arcytex Portal is a multi-tenant operations portal ("Business OS") that supports three primary user surfaces — **Client**, **Specialist**, and **Admin** — sharing a single Postgres database governed by Row-Level Security (RLS). All privileged or third-party-credentialed work runs in Supabase Edge Functions.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      Browser (React / Vite SPA)                      │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ ClientLayout │  │ SpecialistLayout │  │     AdminLayout        │  │
│  └──────┬───────┘  └────────┬─────────┘  └───────────┬────────────┘  │
│         └───────── @supabase/supabase-js ────────────┘                │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS (JWT)
        ┌────────────────────┴─────────────────────┐
        ▼                                          ▼
┌───────────────┐                       ┌────────────────────────┐
│  Supabase     │  ── RLS ──►  Postgres │   Edge Functions       │
│  Auth (GoTrue)│                       │  (Deno, server-only)   │
│  Storage      │                       │                        │
└───────────────┘                       └─────────┬──────────────┘
                                                  │
                                ┌─────────────────┼─────────────────┐
                                ▼                 ▼                 ▼
                            Stripe API     Lovable AI Gateway   Supabase
                                                                Service Role
```

---

## 2. Authentication & Authorization

### 2.1 Authentication
- **Provider:** Supabase Auth (GoTrue), JWT-based.
- **Client SDK:** `src/integrations/supabase/client.ts` (auto-generated; never edited).
- **Session storage:** `localStorage`, with `autoRefreshToken: true` and `persistSession: true`.
- **Sign-in flows:** email + password. New client and specialist accounts are provisioned by admins via Edge Functions (`create-client`, `create-specialist`); end users complete password setup via Supabase recovery link.
- **Hook:** `src/hooks/useAuth.tsx` exposes `user`, `session`, `roles`, and helpers.
- **Route guard:** `src/components/ProtectedRoute.tsx` enforces auth + role checks before rendering any portal layout.

### 2.2 Authorization (RBAC)
Roles are stored in a dedicated `user_roles` table (never on `profiles`) using the `app_role` enum:

| Role | Purpose |
|---|---|
| `client` | End customer; can submit tasks, approve work, manage own credentials, purchase hours |
| `specialist` | Performs assigned tasks, logs time, uploads deliverables |
| `tech_lead` | Read-only across most tables + can update tasks and assign specialists |
| `admin` | Full CRUD across operational tables |
| `super_admin` | Full CRUD including roles, billing, and credits |

Authorization is enforced exclusively via the SECURITY DEFINER function:

```sql
public.has_role(_user_id uuid, _role app_role) RETURNS boolean
```

This function bypasses RLS to prevent recursive policy evaluation when checking roles inside policies. Every protected table policy invokes `has_role(auth.uid(), '<role>')`.

### 2.3 Role Preview
Admins/Super Admins use `RolePreviewSwitcher` to render Client/Specialist surfaces using their own JWT. The preview is **UI-only** — RLS still authorizes against the real `auth.uid()`, so admins see the data they're already permitted to see.

---

## 3. Data Layer

### 3.1 Schema Map

```text
auth.users (managed by Supabase)
   │ 1:1 (via user_id, no FK)
   ├── profiles
   ├── user_roles  (M:N user↔role)
   └── client_accounts ── 1:N ─► hour_blocks
                       ── 1:N ─► hour_credits
                       ── 1:N ─► invoices
                       ── 1:1 ─► client_onboarding
                       ── 1:N ─► client_specialists
                       ── 1:N ─► tasks
                                    ├── task_specialists
                                    ├── task_credentials
                                    ├── task_deliverables
                                    ├── task_approvals
                                    ├── task_activity_log
                                    ├── messages
                                    └── time_logs
profiles ── 1:N ─► specialist_milestones
notifications (per-user inbox, optional task_id link)
```

> **Important:** there are no FK constraints to `auth.users` (per Supabase guidance). All user references use `uuid` columns named `user_id`, `specialist_id`, `sender_id`, `actor_id`, etc., and rely on RLS + application logic for integrity.

### 3.2 Core Domain Tables

#### 3.2.1 `profiles`
Public-facing user metadata (one row per `auth.users`).
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid (NOT NULL) | mirrors `auth.users.id` |
| `email`, `full_name`, `company`, `avatar_url` | text | |
| `specialist_bio`, `specialist_certification` | text | specialist-only fields |
| `salary`, `health_score`, `start_date` | numeric / int / timestamptz | internal HR/perf |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by `update_updated_at_column()` trigger pattern |

Auto-populated on signup by the `handle_new_user()` trigger function:
```sql
INSERT INTO public.profiles (user_id, email, full_name)
VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
```

**RLS:** users see/update their own row; admins, super_admins, tech_leads, specialists can SELECT; admin/super_admin can UPDATE all. No DELETE policy (intentional).

#### 3.2.2 `user_roles`
Privilege store. Composite uniqueness on `(user_id, role)`.
**RLS:** users can read their own; admins/super_admins manage; tech_leads read-only.

#### 3.2.3 `client_accounts`
The tenant root for clients. One row per client user.
| Column | Type | Default | Purpose |
|---|---|---|---|
| `user_id` | uuid | — | links to `auth.users` |
| `hours_purchased` | numeric | 0 | total hours ever credited |
| `hours_used` | numeric | 0 | total hours consumed by `time_logs` |
| `current_rate` | numeric | 100 | last $/hr tier paid |
| `monthly_allocation` | numeric | 10 | retainer-style monthly hours |
| `rollover_hours` | numeric | 0 | unused hours rolled to next month |
| `assigned_pm_id`, `assigned_specialist_id` | uuid | — | default routing |
| `health_status` | text | 'healthy' | account health (CSM signal) |
| `alert_70_sent`, `alert_90_sent` | bool | false | usage-tracking flags |
| `stripe_customer_id` | text | — | Stripe Customer linkage |
| `client_since`, `onboarding_date` | timestamptz | now() / null | |
| `admin_notes` | text | — | internal CRM notes |

**Balance formula:** `available = hours_purchased - hours_used + rollover_hours + Σ(hour_credits.hours)`

**RLS:** clients read own; admin/super_admin manage; tech_lead read.

#### 3.2.4 `client_onboarding`
1:1 with `client_accounts.id`. Captures the multi-step wizard answers (business_name, industry, CRM platform, acquisition channels, landing pages, pain_points, goals).

#### 3.2.5 `client_specialists`
Assignment join table. A specialist can only see clients they're explicitly assigned to (drives data isolation in the specialist surface).

#### 3.2.6 `tasks`
The unit of work.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `client_account_id` | uuid | tenant key |
| `name`, `description` | text | |
| `category` | text | default `'other'` |
| `status` | enum `task_status` | default `'submitted'` (submitted → in_progress → ready_for_review → approved/closed) |
| `priority` | text | `'low' / 'medium' / 'high'` |
| `is_urgent`, `at_risk` | bool | flags |
| `estimated_hours`, `actual_hours` | numeric | AI estimator + rollup of `time_logs` |
| `assigned_specialist_id` | uuid | primary owner |
| `subtasks` | jsonb | embedded checklist `[ {id,label,done} ]` |
| `requested_by`, `created_by` | uuid | client and creator (often same) |

**RLS highlights:**
- Clients SELECT/INSERT tasks for their own `client_account_id`.
- Specialists SELECT/UPDATE tasks where `assigned_specialist_id = auth.uid()` **OR** they appear in `task_specialists`.
- Tech leads SELECT/UPDATE all; admins/super_admins manage all.

Supporting per-task tables:
- **`task_specialists`** — multi-specialist contributors (`role` text, default `'contributor'`).
- **`task_credentials`** — encrypted-at-rest secrets the client provides for the task. Specialists can SELECT only when assigned.
- **`task_deliverables`** — files in the `deliverables` storage bucket; rows reference public/signed URLs. `type` is an enum (deliverable type).
- **`task_approvals`** — client decisions (`action` enum: approve/request_changes/reject) with optional comment.
- **`task_activity_log`** — append-only audit (`actor_id`, `action`, `details jsonb`). Insert allowed to authenticated users where `actor_id = auth.uid()`.
- **`messages`** — per-task chat thread. Both client and assigned specialist can INSERT/SELECT scoped to their task.

#### 3.2.7 `time_logs`
Specialist-authored billable/non-billable hours.
| Column | Notes |
|---|---|
| `specialist_id` | who logged |
| `task_id` | nullable — non-task time still tracked |
| `hours`, `description`, `logged_at` | core fields |
| `billable` | bool, default true |
| `activity_type`, `activity_label` | classifies non-task time (training, internal, etc.) |

**RLS:** specialists manage their own; clients SELECT logs on their own tasks; tech_leads SELECT all; admins/super_admins manage all.

> **Decrement convention:** `client_accounts.hours_used` is updated by application logic (Edge Function or trigger) when billable `time_logs` are inserted. (Trigger not yet present in DB; currently driven from application code.)

#### 3.2.8 Billing tables
- **`hour_blocks`** — purchased Stripe blocks (hours, rate, total_amount, `stripe_payment_id` for idempotency).
- **`hour_credits`** — manual credits by an admin (`credited_by`, `reason`, `hours`).
- **`invoices`** — minimal invoice record (`status`, `total_amount`, `stripe_invoice_id`).

### 3.3 Database Functions & Triggers

| Function | Type | Purpose |
|---|---|---|
| `has_role(uuid, app_role)` | SECURITY DEFINER, STABLE | non-recursive role check used in every privileged RLS policy |
| `update_updated_at_column()` | trigger function | sets `NEW.updated_at = now()` (attached on `BEFORE UPDATE` where used) |
| `handle_new_user()` | SECURITY DEFINER trigger function | seeds a `profiles` row from `auth.users.raw_user_meta_data` on insert |

> The schema currently reports **no triggers**. `handle_new_user` is intended as an `AFTER INSERT ON auth.users` trigger and `update_updated_at_column` as a `BEFORE UPDATE` trigger on tables with `updated_at`. Verify these are wired in production.

### 3.4 Storage Buckets

| Bucket | Public | Used by |
|---|---|---|
| `avatars` | yes | `AvatarUpload.tsx` — profile photos |
| `deliverables` | yes | `TaskDeliverables.tsx` — files attached to tasks |

> Both are public read. Sensitive content should not be placed here; use signed URLs + a private bucket if confidentiality is required (currently a known limitation).

### 3.5 Realtime
Realtime broadcasts are not currently enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE …`. The portal polls or refetches via TanStack Query on user actions. Adding `messages`, `tasks`, and `notifications` to the realtime publication is a planned enhancement.

---

## 4. Edge Functions (Deno)

All Edge Functions live under `supabase/functions/` and are deployed automatically. CORS is permitted from any origin (`*`) with the standard Supabase headers.

### 4.1 `create-checkout`  (`verify_jwt = false`)
**Purpose:** Build a Stripe Checkout Session for an hour block.
- Reads `Authorization: Bearer <jwt>`, calls `auth.getUser(token)` with the **anon** client to identify the user.
- Looks up an existing Stripe Customer by email; otherwise lets Stripe create one.
- Creates a `mode: "payment"` Checkout Session with the supplied `priceId` and a `success_url` of `/payment-success?session_id={CHECKOUT_SESSION_ID}`.
- Returns `{ url }`. Frontend (`src/pages/Billing.tsx`) redirects via `window.location.href`.
- **Metadata:** `{ user_id: user.id }` for downstream attribution.

### 4.2 `verify-payment`  (`verify_jwt = false`)
**Purpose:** Idempotently confirm payment, credit hours, and write invoice.
- Auth: anon client validates JWT (informational); writes use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
- Retrieves the Checkout Session with `expand: ["line_items"]`.
- Maps `priceId → { hours, rate, total }` via the in-function `PRICE_MAP`:
  - `price_…1Ckz` → 10h @ $100
  - `price_…YsJZ` → 30h @ $90
  - `price_…RgVQ` → 50h @ $85
  - `price_…CSTa` → 60h @ $80
- **Idempotency:** queries `hour_blocks` for an existing `stripe_payment_id` (the PaymentIntent id) before inserting.
- Upserts `client_accounts`, inserts `hour_blocks`, increments `hours_purchased`, updates `current_rate`, and writes an `invoices` row with `status = 'paid'`.
- Returns `{ status, hours_added, new_balance }`.

> **Hardening backlog:** move `PRICE_MAP` to a DB table or env var; verify Stripe signature via webhook (currently a polled `verify-payment` call from `/payment-success`); reject session ids whose `metadata.user_id` does not match the JWT user.

### 4.3 `create-client`  (`verify_jwt = false`)
Admin-only provisioning for a new client account.
- Uses service-role client; verifies caller via `Authorization` header and a `user_roles` lookup against `['admin','super_admin','tech_lead']`.
- `auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true })`.
- Parallel writes: `profiles` upsert, `user_roles` insert (`'client'`), `client_accounts` insert with `monthly_allocation` and seeded `hours_purchased`.
- Triggers a Supabase password recovery link so the new user sets their own password.

### 4.4 `create-specialist`  (`verify_jwt = false`)
Same pattern as `create-client` but seeds `user_roles` with `'specialist'` and the corresponding profile fields (bio, certification, salary, start_date).

### 4.5 `parse-time-dictation`  (`verify_jwt = false`)
AI-powered natural-language → structured time entry.
- Calls the **Lovable AI Gateway** (no API key required) with a Gemini/GPT model.
- Returns `{ task_hint, hours, description, billable, activity_type }` for the specialist UI to confirm and persist.
- Feeds the inline "Quick Log" widget on the specialist task queue.

---

## 5. Frontend ↔ Backend Contract

### 5.1 Supabase JS client
- Singleton at `src/integrations/supabase/client.ts`, typed via auto-generated `Database` from `src/integrations/supabase/types.ts`. **Never edit** either file.
- All reads/writes go through the typed client; RLS provides the authorization boundary so the same query "does the right thing" per role.

### 5.2 Function invocation
```ts
const { data, error } = await supabase.functions.invoke("create-checkout", {
  body: { priceId },
});
```
The SDK automatically attaches `Authorization: Bearer <jwt>` from the persisted session.

### 5.3 Environment variables (frontend)
Provided automatically in `.env`; **do not edit manually**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon public key — safe in the bundle)
- `VITE_SUPABASE_PROJECT_ID`

### 5.4 Server-side secrets (Edge Functions)
| Secret | Source | Used by |
|---|---|---|
| `SUPABASE_URL` | platform | all functions |
| `SUPABASE_ANON_KEY` | platform | JWT validation in checkout/verify |
| `SUPABASE_SERVICE_ROLE_KEY` | platform | privileged writes in `verify-payment`, `create-client`, `create-specialist` |
| `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEY` | platform | reserved |
| `STRIPE_SECRET_KEY` | manually set | all Stripe calls |
| `LOVABLE_API_KEY` | platform (rotatable) | Lovable AI Gateway calls (`parse-time-dictation`) |

---

## 6. Integrations

### 6.1 Stripe
- **Mode:** one-off Checkout (no subscriptions yet; retainer flow planned).
- **Pricing tiers** (progressive, hard-coded in Stripe and mirrored in `verify-payment.PRICE_MAP`): 10h / 30h / 50h / 60h with descending hourly rate.
- **Customer linkage:** by email lookup on each checkout; `client_accounts.stripe_customer_id` is reserved for future caching.
- **Webhooks:** *not currently used.* Verification is performed on the success-page round trip via `verify-payment`. Adding a `stripe-webhook` Edge Function with signature verification (`stripe.webhooks.constructEvent`) is the recommended hardening step.
- **API version pinned:** `2025-08-27.basil`.

### 6.2 Lovable AI Gateway
- Provides hosted access to Gemini and GPT models without per-tenant API keys.
- Used for `parse-time-dictation` and earmarked for the AI hour estimator on task submission.
- Key rotation: `ai_gateway--rotate_lovable_api_key` (never `update_secret`).

### 6.3 Email / Notifications
- Auth emails (signup confirmation, password recovery) are sent by Supabase Auth using the default sender. Custom domain + branded templates are not configured.
- In-app notifications: `notifications` table polled by `useNotificationCounts`; usage alerts at 70% / 90% (`alert_70_sent`, `alert_90_sent` flags) are written by application code.

### 6.4 Standard Connectors
None linked to this project at present (no Slack, Resend, Google Workspace, etc.). Adding any connector requires (a) linking via the Connectors UI, (b) deploying an Edge Function that proxies through the Lovable Connector Gateway with `LOVABLE_API_KEY` + the connector-specific API key.

---

## 7. Cross-cutting Concerns

### 7.1 Security model
- **Single source of truth:** RLS policies. The frontend never decides authorization on its own; it simply renders what the API returns.
- **Service-role key** is confined to server-side Edge Functions and never exposed to the browser.
- **Role checks** always go through `has_role()` (SECURITY DEFINER, `SET search_path = public`). No policy queries `user_roles` directly to avoid recursion.
- **PII / Secrets:** `task_credentials` stores credentials as plaintext today; encryption-at-rest column or Vault integration is a known follow-up.

### 7.2 Idempotency & data integrity
- Payment processing keys off `stripe_payment_id` uniqueness check before insert.
- `task_activity_log` is append-only (no UPDATE/DELETE policy outside admin).
- `subtasks` lives as `jsonb` on `tasks` — schema-flexible but no DB-level validation; validated in the form layer.

### 7.3 Observability
- Supabase function logs accessible via Lovable Cloud → Edge Function logs.
- Postgres logs/analytics via `supabase--analytics_query`.
- No external APM (Sentry/Datadog) wired up.

### 7.4 Backups & DR
- Managed by Supabase (daily backups on the platform plan). Point-in-time recovery depends on the underlying Supabase tier.

---

## 8. Known Gaps & Roadmap

| Area | Gap | Recommended next step |
|---|---|---|
| Stripe | No webhook signature verification | Add `stripe-webhook` Edge Function; treat `verify-payment` as fallback |
| Triggers | `handle_new_user` and `update_updated_at_column` not attached in current schema | Create migration to wire triggers explicitly |
| Realtime | Disabled | Add `messages`, `notifications`, `tasks` to `supabase_realtime` publication |
| Storage | `deliverables` is public | Move to private bucket + signed URLs |
| Credentials vault | Plaintext storage | Use `pgcrypto` or Supabase Vault for `task_credentials.credential_value` |
| Hour decrement | App-side only | Postgres trigger on `time_logs` insert to update `client_accounts.hours_used` |
| Pricing | Hard-coded `PRICE_MAP` | Move to `pricing_tiers` table sourced from Stripe |
| Email | Default sender | Configure custom domain + branded transactional templates |

---

## Appendix A — Enums
- `app_role`: `client`, `specialist`, `tech_lead`, `admin`, `super_admin`
- `task_status`: submitted → in_progress → ready_for_review → approved/closed (USER-DEFINED)
- `task_approvals.action`: approve / request_changes / reject (USER-DEFINED)
- `task_deliverables.type`: deliverable type enum (USER-DEFINED)

## Appendix B — File Map
- `src/integrations/supabase/client.ts` — SDK singleton (auto-generated)
- `src/integrations/supabase/types.ts` — DB types (auto-generated)
- `src/hooks/useAuth.tsx` — session + roles
- `src/components/ProtectedRoute.tsx` — route guard
- `supabase/config.toml` — function configs (`verify_jwt = false` on all current functions)
- `supabase/functions/*` — Edge Functions described in §4
