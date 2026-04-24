# Arcytex Portal — API & Edge Functions Reference

**Version:** 1.0  
**Base URL (functions):** `https://vpbvfendqquvkvekttez.supabase.co/functions/v1/`  
**Auth:** All requests should include `Authorization: Bearer <supabase_jwt>` (the SDK adds this automatically via `supabase.functions.invoke`). Functions are configured with `verify_jwt = false` so they parse the JWT manually using the anon client.  
**CORS:** `Access-Control-Allow-Origin: *` on every function.

---

## 1. `POST /create-checkout`

Creates a Stripe Checkout Session for a one-off hour block purchase.

### Request
```http
POST /functions/v1/create-checkout
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "priceId": "price_1T7iocA59zIOlwLqDVJx1Ckz"
}
```

### Body parameters
| Field | Type | Required | Description |
|---|---|---|---|
| `priceId` | string | yes | Stripe Price ID. Must be one of the four configured tiers. |

### Valid `priceId` values
| Price ID | Hours | Rate | Total |
|---|---|---|---|
| `price_1T7iocA59zIOlwLqDVJx1Ckz` | 10 | $100/h | $1,000 |
| `price_1T7ipLA59zIOlwLqMCayYsJZ` | 30 | $90/h | $2,700 |
| `price_1T7ipXA59zIOlwLq7sj6RgVQ` | 50 | $85/h | $4,250 |
| `price_1T7ipzA59zIOlwLqdAJbCSTa` | 60 | $80/h | $4,800 |

### Response 200
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
```
Frontend redirects via `window.location.href = url`.

### Response 500
```json
{ "error": "User not authenticated" }
```

### Side effects
- Looks up Stripe customer by email; reuses existing or lets Stripe create one.
- Embeds `metadata.user_id` on the Checkout Session for downstream attribution.
- `success_url` = `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url` = `${origin}/billing`

### Frontend usage
```ts
const { data, error } = await supabase.functions.invoke("create-checkout", {
  body: { priceId },
});
if (data?.url) window.location.href = data.url;
```

---

## 2. `POST /verify-payment`

Idempotently confirms a Stripe Checkout Session, credits hours to the client, and writes invoice + hour_block records.

### Request
```http
POST /functions/v1/verify-payment
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "sessionId": "cs_test_a1b2c3..."
}
```

### Behavior
1. Validates JWT via the **anon** client.
2. Retrieves the Checkout Session from Stripe with `expand: ["line_items"]`.
3. If `payment_status !== "paid"`, returns the current status without writing.
4. Looks up the price in the in-function `PRICE_MAP`. Unknown price → 500.
5. Resolves the `client_accounts` row by `user_id` (creates one if missing — service role).
6. Idempotency: queries `hour_blocks` for `stripe_payment_id = session.payment_intent`. If found, returns early.
7. Inserts: `hour_blocks`, updates `client_accounts.hours_purchased` and `current_rate`, inserts `invoices`.

### Response 200 (paid, processed)
```json
{
  "status": "paid",
  "hours_added": 30,
  "new_balance": 32.5
}
```

### Response 200 (already processed)
```json
{ "status": "paid", "already_processed": true }
```

### Response 200 (unpaid)
```json
{ "status": "unpaid" }
```

### Response 500
```json
{ "error": "Unknown price ID: price_xyz" }
```

### Frontend usage
Called automatically from `src/pages/PaymentSuccess.tsx` on mount with the `session_id` query param.

---

## 3. `POST /create-client`

Admin-only provisioning of a new client (auth user + profile + role + client_account).

### Authorization
Caller must have `admin`, `super_admin`, or `tech_lead` in `user_roles`. Verified via service-role lookup before any write.

### Request
```http
POST /functions/v1/create-client
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{
  "email": "client@example.com",
  "full_name": "Jane Doe",
  "company": "Acme Co",
  "monthly_allocation": 10,
  "rate": 100
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `email` | string | yes | — | Becomes the auth login. |
| `full_name` | string | yes | — | Stored on `profiles.full_name`. |
| `company` | string | no | null | Stored on `profiles.company`. |
| `monthly_allocation` | number | no | 10 | Hours/month retainer; also seeds `hours_purchased`. |
| `rate` | number | no | 100 | Initial `current_rate`. |

### Side effects
- `auth.admin.createUser({ email, password: <random uuid>, email_confirm: true })`
- Parallel inserts to `profiles`, `user_roles` (`'client'`), `client_accounts`.
- Generates a Supabase password recovery link so the new user sets their own password.

### Response 200
```json
{ "user_id": "5b8f...uuid", "email": "client@example.com" }
```

### Response 400
```json
{ "error": "Admin access required" }
```

---

## 4. `POST /create-specialist`

Same shape as `create-client` but seeds `user_roles` with `'specialist'` and additional profile fields.

### Request
```http
POST /functions/v1/create-specialist
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{
  "email": "specialist@arcytex.com",
  "full_name": "John Smith",
  "specialist_bio": "GHL automation expert",
  "specialist_certification": "GHL Certified Admin",
  "salary": 65000,
  "start_date": "2026-01-15"
}
```

### Response 200
```json
{ "user_id": "9c2a...uuid", "email": "specialist@arcytex.com" }
```

---

## 5. `POST /parse-time-dictation`

Converts a natural-language description of work into a structured time-log payload using the Lovable AI Gateway.

### Request
```http
POST /functions/v1/parse-time-dictation
Authorization: Bearer <specialist_jwt>
Content-Type: application/json

{
  "transcript": "Spent about 45 minutes on the Smith account fixing their pipeline automation, then 20 min internal training."
}
```

### Response 200 (typical shape)
```json
{
  "entries": [
    {
      "task_hint": "Smith account pipeline automation fix",
      "hours": 0.75,
      "description": "Fixed pipeline automation",
      "billable": true,
      "activity_type": "task"
    },
    {
      "task_hint": null,
      "hours": 0.33,
      "description": "Internal training",
      "billable": false,
      "activity_type": "training"
    }
  ]
}
```
The frontend (specialist Quick Log widget) presents these as editable rows the user confirms before insertion into `time_logs`.

---

## 6. Direct Database Access (Supabase JS)

All non-privileged operations go through `supabase-js` directly, with RLS enforcing access. Below are the canonical query patterns used by each surface.

### 6.1 Client surface

**List my tasks**
```ts
const { data } = await supabase
  .from("tasks")
  .select("*, assigned_specialist:profiles!tasks_assigned_specialist_id_fkey(full_name, avatar_url)")
  .order("created_at", { ascending: false });
// RLS filters to my client_account automatically.
```

**Submit a task**
```ts
await supabase.from("tasks").insert({
  client_account_id: myAccountId, // checked by RLS WITH CHECK
  name, description, priority, category, is_urgent,
  requested_by: user.id, created_by: user.id,
});
```

**Send a message**
```ts
await supabase.from("messages").insert({
  task_id, sender_id: user.id, content,
});
```

**Approve a task**
```ts
await supabase.from("task_approvals").insert({
  task_id, acted_by: user.id, action: "approve", comment,
});
```

**Add a credential**
```ts
await supabase.from("task_credentials").insert({
  task_id, client_id: user.id, label, credential_value,
});
```

**Upload a deliverable**
```ts
const { data: upload } = await supabase.storage
  .from("deliverables")
  .upload(`${task_id}/${file.name}`, file);
const { data: { publicUrl } } = supabase.storage
  .from("deliverables")
  .getPublicUrl(upload.path);
await supabase.from("task_deliverables").insert({
  task_id, uploaded_by: user.id, file_name: file.name, url: publicUrl, type: "client_asset",
});
```

### 6.2 Specialist surface

**My queue**
```ts
const { data } = await supabase
  .from("tasks")
  .select("*, client:client_accounts(user_id, profiles:profiles!inner(full_name, company))")
  .order("priority", { ascending: false });
// RLS shows tasks where assigned_specialist_id = me OR I am in task_specialists.
```

**Log time**
```ts
await supabase.from("time_logs").insert({
  specialist_id: user.id,
  task_id,
  hours,
  description,
  billable: true,
  activity_type: "task",
  logged_at: new Date().toISOString(),
});
```

**Mark task ready for review**
```ts
await supabase
  .from("tasks")
  .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
  .eq("id", task_id);
```

### 6.3 Admin / Tech-lead surface

**List all clients with usage rollup**
```ts
const { data: accounts } = await supabase
  .from("client_accounts")
  .select(`
    *,
    profile:profiles!client_accounts_user_id_fkey(full_name, email, company),
    hour_blocks(hours, total_amount, created_at),
    hour_credits(hours, reason, created_at)
  `);
```

**Assign a specialist to a client**
```ts
await supabase.from("client_specialists").insert({
  client_account_id, specialist_id, assigned_by: user.id,
});
```

**Credit hours**
```ts
await supabase.from("hour_credits").insert({
  client_account_id, hours, reason, credited_by: user.id,
});
```

---

## 7. Realtime (planned, not yet enabled)

To enable per-table realtime, run in a migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
```
Then subscribe from the client:
```ts
const channel = supabase
  .channel("task-thread")
  .on("postgres_changes",
    { event: "INSERT", schema: "public", table: "messages", filter: `task_id=eq.${taskId}` },
    payload => append(payload.new))
  .subscribe();
```

---

## 8. Error Conventions

| Layer | Shape |
|---|---|
| Edge function | `{ "error": "<message>" }` with HTTP 4xx/5xx |
| Postgres / RLS | `PostgrestError` with `code`, `message`, `details`, `hint` (returned by supabase-js) |
| Storage | `StorageError` with `message`, `statusCode` |

Common Postgres codes seen in this project:
- `42501` — RLS violation (user lacks role/ownership for the requested row)
- `23505` — unique violation (e.g., duplicate `(user_id, role)` in `user_roles`)
- `23503` — foreign key violation (rare here; few FKs are declared)

---

## 9. Rate Limits & Idempotency

- **Stripe Checkout / Verify:** Only `verify-payment` is idempotent (via `stripe_payment_id` lookup). `create-checkout` is safe to retry — it just creates new sessions.
- **Provisioning:** `create-client` / `create-specialist` are not idempotent. Calling twice with the same email yields a Supabase Auth error on the second call (`User already registered`).
- **No platform rate limits configured.** Stripe and the Lovable AI Gateway enforce their own.
