# Arcytex Clarity

Multi-tenant client portal for Arcytex. Clients submit and track tasks, specialists log time and upload deliverables, admins manage accounts and billing.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + shadcn/ui + Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Payments:** Stripe
- **Infra management:** Claude Code + Supabase MCP

## Local Development

```sh
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env  # or set manually

# Start dev server
npm run dev
```

The app runs at `http://localhost:8080`.

## Environment Variables

Create a `.env` file at the project root:

```
VITE_SUPABASE_URL=https://dsoernssqhsjsugwlfgs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=dsoernssqhsjsugwlfgs
```

## Supabase Project

**Project:** `arcytex-internal-main-app` (`dsoernssqhsjsugwlfgs`)

All schema migrations live in `supabase/migrations/`. Apply them via the Supabase MCP or CLI:

```sh
SUPABASE_ACCESS_TOKEN=<pat> supabase db push --project-ref dsoernssqhsjsugwlfgs
```

## Edge Functions

Five functions in `supabase/functions/`:

| Function | Purpose |
|---|---|
| `create-checkout` | Creates a Stripe Checkout session for hour-block purchase |
| `verify-payment` | Confirms payment and credits hours to the client account |
| `create-client` | Admin-only: provisions a new client auth user + account |
| `create-specialist` | Admin-only: provisions a new specialist auth user |
| `parse-time-dictation` | Converts natural language to structured time log entries (OpenAI) |

Required secrets (set via `supabase secrets set --project-ref dsoernssqhsjsugwlfgs`):

```sh
STRIPE_SECRET_KEY=sk_live_...
OPENAI_API_KEY=sk-...
```

## User Roles

`client` · `specialist` · `tech_lead` · `admin` · `super_admin`

All authorization is enforced via Postgres RLS using the `has_role()` SECURITY DEFINER function.
