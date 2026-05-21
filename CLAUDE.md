# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code review

When a `github-webhook-activity` event arrives containing a comment from `gemini-code-assist[bot]`, read it and address any actionable feedback — fix the issue, commit, and push. Do this automatically without waiting to be asked.

## What this is

Socrify Beta — a Socratic AI tutoring platform. A single-page React app served by a Cloudflare Worker that also proxies Anthropic's API and talks to Supabase for auth, persistence, and usage gating.

There is **no build step**. JSX files are transpiled in-browser by `@babel/standalone`. React, Supabase, marked, DOMPurify, and highlight.js are all loaded from CDNs in `index.html`. `package.json` exists only because `functions/chat.js` imports `@supabase/supabase-js` (bundled into the Worker by wrangler).

## Commands

```bash
# Local dev (Cloudflare Worker + static assets, http://localhost:8787)
# Requires .dev.vars (copy from .dev.vars.example and fill in)
npx wrangler dev

# Deploy: deploys the worker first, then pushes secrets from env vars.
# Wrangler refuses to set secrets while there's an undeployed version pending,
# so the ordering in deploy.sh matters — don't reorder it.
./deploy.sh

# Set a single secret manually
npx wrangler secret put ANTHROPIC_API_KEY    # also: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                                              # SUPABASE_ANON_KEY, IP_HASH_SALT

# Tail production logs
npx wrangler tail

# Supabase migrations live in supabase/migrations/. Apply via the Supabase
# dashboard SQL editor or `supabase db push` if the CLI is set up.
```

There are no tests, no linter, and no typechecker configured.

## Architecture

### Request flow

`worker.js` is the entrypoint (`main` in `wrangler.toml`). It routes a small set of paths to handlers exported from `functions/chat.js`; everything else falls through to `env.ASSETS.fetch(request)`, which serves the static SPA from the repo root (`not_found_handling = "single-page-application"`).

Routes:
- `POST /chat` — Anthropic proxy. Two modes: `tutor` (`claude-haiku-4-5-20251001`) and `research` (`claude-sonnet-4-6` + extended thinking + `web_search_20250305` tool).
- `GET/POST /history` — fetch/upsert a user's conversations (auth required).
- `POST /session/start` — gates each new conversation against daily per-tier caps. **Must be called before launching a new session.**
- `GET /usage` — current tier + today's session counts.
- `POST /dev/set-tier` — dev-only tier flip (no Stripe yet).
- `GET /config.js` — emits `window.__SOCRIFY_CONFIG__` with `supabaseUrl` and `supabaseAnonKey`. **Never include the service role key here.**

### Two-layer rate limiting (`functions/chat.js`)

Both layers are enforced server-side using `usage_logs`. Identity is `user_id` when authed, else a hash of the client IP (`CF-Connecting-IP` + `IP_HASH_SALT`).

1. **Hourly `ai_call` cap** — safety net on every `/chat` request. Caps: guest 15, free 60, pro 500.
2. **Daily `session_start` cap** — the primary gate. Caps: guest `{tutor: 2, research: 0}`, free `{tutor: 5, research: 1}`, pro `{tutor: 30, research: 5}`. `startSession` inserts the log row first then counts; if over cap it deletes the row it just wrote and returns 429. This avoids a TOCTOU race under concurrent requests.

Users with `profiles.is_dev = true` bypass both caps (verified server-side; the dashboard "Dev" toggle calls `/dev/set-tier`).

When the DB client can't be constructed, `startSession` fails closed (500) so we never silently grant unlimited access. `/chat` instead allows the call through (`skipped: true`) — there's a tradeoff documented inline.

### Prompt caching

Every `/chat` call wraps the system prompt as a single text block with `cache_control: { type: 'ephemeral' }` and adds the same breakpoint to the last content block of the last message. The `prompt-caching-2024-07-31` beta header is always set; `pdfs-2024-09-25` is added only when a `document` block with `application/pdf` is present. If you change message-construction logic, preserve these cache breakpoints — losing them inflates Anthropic spend dramatically across multi-turn conversations.

### Frontend (script-tag globals, not modules)

`index.html` loads each `.jsx` file as `<script type="text/babel">`. They share a single global scope — there are no `import`/`export` statements in the JSX files. Helpers cross files via `window` (e.g. `useAuthSession`, `authSignIn`, `apiStartSession` from `auth.jsx`; `SparkMark` etc. from `logo.jsx`; `TweaksPanel`, `useTweaks` from `tweaks-panel.jsx`).

Load order matters and is set in `index.html`:
1. `/config.js` (worker-emitted) → 2. supabase UMD → 3. `tweaks-panel.jsx` → 4. `logo.jsx` → 5. `auth.jsx` → 6. `popovers.jsx` → 7. `landing.jsx` → 8. `app-shell.jsx` → 9. `app.jsx` (which calls `ReactDOM.createRoot(...).render(<Root />)`).

File responsibilities:
- `app.jsx` — `Root`, owns view state (`landing | auth | onboarding | dashboard`) and global theming (dark mode, dyslexic font, font size, reduce-motion, accent hue).
- `app-shell.jsx` — `AppShell` (the post-auth surface), `SUBJECTS`/`TEACHING_STYLES`/`DIFFICULTIES`, `buildSystemPrompt`, `buildApiMessages`, `callChatApi`, file-attachment handling, TXT/HTML export, localStorage history.
- `landing.jsx` — marketing page, `Auth`, `Onboarding`.
- `popovers.jsx` — portal-based popover shell + Settings/Account UI.
- `auth.jsx` — Supabase client boot, `useAuthSession`, `apiStartSession`, `apiGetUsage`, `apiSetDevTier`.
- `logo.jsx` — the four logo marks (`SparkMark`, `BloomMark`, `QuillMark`, `InquiryMark`); switchable via the Tweaks panel.
- `tweaks-panel.jsx` — generic dev tweak shell (slider, radio, color, toggle). Implements an `__activate_edit_mode`/`__edit_mode_set_keys` postMessage protocol; tweak values are read/written between `/*EDITMODE-BEGIN*/.../*EDITMODE-END*/` markers in source.

### Auth + tier resolution

Frontend uses the Supabase JS client (`window.sb`) with the anon key. On session change `useAuthSession` fetches `profiles` (for `is_dev`) and `subscriptions` (for `tier`/`status`) in parallel; a user is `pro` only when `status='active' AND tier='pro'`, else `free`. Guests have `tier='guest'`.

Server-side, `verifyUser` in `functions/chat.js` re-derives the same tier from the same tables using the service role key — never trust a tier value sent from the client.

Authed requests pass `Authorization: Bearer <access_token>` to `/chat`, `/history`, `/session/start`, `/usage`, `/dev/set-tier`. Use `authedFetch` from `auth.jsx`.

### History storage

Guests get localStorage only (`socrify_history`). Authed users sync via `POST /history`, which upserts the conversation row and **deletes-then-reinserts all messages** for that conversation — so the message list sent must be complete. Frontend roles are `student`/`tutor`; DB roles are `user`/`assistant`; mapping happens in `upsertConversation` and `getHistory`.

### Supabase schema

Two migrations in `supabase/migrations/`:
- `conversations`, `messages` — RLS owner-only.
- `profiles`, `subscriptions`, `usage_logs` — RLS owner-read on profiles/subscriptions; `usage_logs` has RLS enabled with **no policies**, so anon/auth roles can't see it. The chat function reads it via the service role key, which bypasses RLS.
- `handle_new_user` trigger on `auth.users` insert auto-creates a `profiles` row and a free `subscriptions` row.

**Supabase dashboard setup:** Authentication → Providers → Email → turn **off** "Confirm email" so beta signups work without an inbox round-trip (noted in `wrangler.toml`).

### Static asset gotcha

`.assetsignore` is load-bearing: it prevents `worker.js`, `functions/`, `package.json`, `wrangler.toml`, `Socrify_Full_Product_Plan_v3.html`, etc. from being served as public static files. Any new server-only file added to the repo root must be added to `.assetsignore`.

## Conventions worth knowing

- **No `.jsx` imports** — define top-level functions and they become globals. Be wary of name collisions across files.
- **Styling** uses CSS variables from `tokens.css` (`--accent`, `--surface`, `--text`, etc., all in `oklch()`). Dark mode toggles `html.dark`. Accent hue is a runtime CSS variable (`--accent-hue`) set from the Tweaks panel.
- **Conversation IDs** are client-generated: `conv_<timestamp>_<random>`. They're the primary key in `conversations` and must be passed to `/session/start` so the gate row references the session it gated.
- **Message length cap**: `/chat` rejects conversations with more than 60 messages (`functions/chat.js:165`).
- **Attachment cap**: 10 MB per file (`MAX_ATTACH_BYTES` in `app-shell.jsx`). Images → base64 `image` block, PDFs → base64 `document` block, other files → inline as text.
- **Branch policy**: this session is on `claude/claude-md-docs-AR6z5` per task instructions. Develop, commit, and push there.
