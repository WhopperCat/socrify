# Socrify

Socratic AI tutoring platform. A single-page React app served by a Cloudflare Worker that proxies Anthropic's API and talks to Supabase for auth, persistence, and usage gating. 

## Stack

- **Frontend:** React + Babel Standalone (in-browser JSX, no build step), loaded from CDNs
- **Backend:** Cloudflare Worker (`worker.js` + `functions/chat.js`)
- **AI:** Anthropic Claude (Haiku for tutor mode, Sonnet w/ extended thinking + web search for research mode), with prompt caching
- **Data:** Supabase (auth, profiles, subscriptions, conversation history, usage logs)
- **Billing:** Stripe Checkout + Billing Portal + webhook

## Quickstart

```bash
# Copy and fill in local secrets
cp .dev.vars.example .dev.vars

# Run the Worker + static assets at http://localhost:8787
npx wrangler dev

# Deploy worker, then push secrets from env vars
./deploy.sh

# Tail production logs
npx wrangler tail
```

There is no build, no linter, and no test suite. JSX is transpiled in the browser.

## Routes

| Path | Purpose |
| --- | --- |
| `POST /chat` | Anthropic proxy (`tutor` and `research` modes) |
| `GET/POST /history` | Fetch / upsert a user's conversations |
| `POST /session/start` | Gate a new conversation against daily tier caps |
| `GET /usage` | Current tier + today's session counts |
| `POST /dev/set-tier` | Dev-only tier flip |
| `POST /stripe/checkout` | Create Stripe Checkout Session |
| `POST /stripe/portal` | Create Stripe Billing Portal session |
| `POST /stripe/webhook` | Stripe event handler (verifies signature) |
| `GET /config.js` | Emits `window.__SOCRIFY_CONFIG__` (public keys only) |

Everything else falls through to `env.ASSETS.fetch` and serves the SPA.

## Rate limits

Enforced server-side via `usage_logs`, keyed by `user_id` (auth'd) or hashed IP (guest):

- **Hourly `ai_call` cap** on every `/chat` — guest 15, free 60, pro 500
- **Daily `session_start` cap** — guest `{tutor:2, research:0}`, free `{tutor:5, research:1}`, pro `{tutor:30, research:5}`

`profiles.is_dev = true` users bypass both caps.

## Required secrets

Pushed by `deploy.sh`:

`ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `IP_HASH_SALT`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`.

Any new env var read by the Worker must be added to `deploy.sh` or it'll be empty in prod.

## Supabase setup

- Apply migrations from `supabase/migrations/` (SQL editor or `supabase db push`).
- Authentication → Providers → Email → turn **off** "Confirm email" for beta signups.
- `handle_new_user` trigger auto-creates a `profiles` row and a free `subscriptions` row on signup.
- `subscriptions.tier='pro' AND status='active'` is the only thing that promotes a user to Pro.

## Repo layout

```
worker.js           # Cloudflare Worker entrypoint
functions/chat.js   # /chat, /history, /session/start, /usage, /stripe/*
index.html          # SPA entry; loads .jsx files as <script type="text/babel">
src/                # JSX (no imports — top-level fns become globals)
supabase/migrations # SQL migrations
.assetsignore       # Keeps worker.js, functions/, etc. out of public assets
```

See `CLAUDE.md` for deeper architecture notes (prompt caching, tier resolution, history sync, conventions).
