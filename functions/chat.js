// Socrify — Anthropic API proxy + Stripe billing (Cloudflare Worker)
// Env vars expected (set via: wrangler secret put <NAME>):
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   IP_HASH_SALT            (optional)
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   STRIPE_PRO_PRICE_ID     (price_1TZcx5H8M5NDocU6W9hPIOrA)

import { createClient } from '@supabase/supabase-js';

const TUTOR_MODEL = 'claude-haiku-4-5-20251001';
const RESEARCH_MODEL = 'claude-sonnet-4-6';
const TUTOR_MAX_TOKENS = 1024;
const RESEARCH_THINKING_BUDGET = 3000;
const RESEARCH_MAX_TOKENS = 10000;
const RESEARCH_WEB_SEARCH_MAX_USES = 5;

// Per-hour ai_call safety net (per message, not per conversation).
// Pro is effectively unlimited — the real ceiling is Anthropic spend.
const HOURLY_AI_CALL_CAPS = {
  guest: 15,
  free: 60,
  pro: 500,
};

// Per-day session_start caps — the primary gate. 1 session = 1 new conversation.
const SESSION_CAPS = {
  guest: { tutor: 2, research: 0 },
  free:  { tutor: 5, research: 1 },
  pro:   { tutor: 30, research: 5 },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode((salt || 'socrify-beta-salt') + (ip || ''));
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function makeSupa(url, key) {
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.error('Supabase client init failed:', err.message);
    return null;
  }
}

async function checkHourlyAiCall(supa, { userId, ipHash, tier }) {
  if (!supa) return { ok: true, skipped: true };
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const cap = HOURLY_AI_CALL_CAPS[tier] ?? HOURLY_AI_CALL_CAPS.guest;
  let q = supa
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'ai_call')
    .gte('created_at', oneHourAgo);
  if (userId) q = q.eq('user_id', userId);
  else q = q.eq('ip_hash', ipHash);
  const { count, error } = await q;
  if (error) {
    console.error('Hourly ai_call query failed:', error);
    return { ok: true, errored: true };
  }
  return { ok: (count || 0) < cap, used: count || 0, cap };
}

async function countDailySessionStarts(supa, { userId, ipHash, mode }) {
  if (!supa) return 0;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let q = supa
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'session_start')
    .eq('mode', mode)
    .gte('created_at', oneDayAgo);
  if (userId) q = q.eq('user_id', userId);
  else q = q.eq('ip_hash', ipHash);
  const { count, error } = await q;
  if (error) {
    console.error('Session-count query failed:', error);
    return 0;
  }
  return count || 0;
}

async function logCall(supa, { userId, ipHash, mode, subject }) {
  if (!supa) return;
  const { error } = await supa.from('usage_logs').insert({
    user_id: userId || null,
    ip_hash: ipHash,
    event_type: 'ai_call',
    mode: mode || null,
    subject: subject || null,
  });
  if (error) console.error('usage_logs insert failed:', error);
}

async function verifyUser(supa, authHeader) {
  if (!authHeader?.startsWith('Bearer ') || !supa) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  const [{ data: profile }, { data: sub }] = await Promise.all([
    supa.from('profiles').select('is_dev').eq('id', data.user.id).maybeSingle(),
    supa.from('subscriptions').select('tier,status').eq('user_id', data.user.id).maybeSingle(),
  ]);
  const tier = sub && sub.status === 'active' && sub.tier === 'pro' ? 'pro' : 'free';
  return { id: data.user.id, email: data.user.email || null, is_dev: !!profile?.is_dev, tier };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'Server missing ANTHROPIC_API_KEY' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { messages, system, mode, subject } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages[] required' }, 400);
  }
  if ((typeof system !== 'string' || system.length < 20) && !Array.isArray(system)) {
    return json({ error: 'system prompt required' }, 400);
  }
  if (messages.length > 60) {
    return json({ error: 'Conversation too long' }, 400);
  }

  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const tier = user ? user.tier : 'guest';
  const isDev = !!user?.is_dev;

  if (!isDev) {
    const rl = await checkHourlyAiCall(supa, { userId: user?.id, ipHash, tier });
    if (!rl.ok) {
      return json({
        error: 'rate_limited',
        message: `Hourly message limit reached (${rl.used}/${rl.cap}). Try again in a bit.`,
        used: rl.used,
        cap: rl.cap,
      }, 429);
    }
  }

  const isResearch = mode === 'research';

  // Wrap system prompt as array with cache breakpoint so the (typically large)
  // system prompt is cached across turns for the same user session.
  const systemBlock = Array.isArray(system)
    ? system
    : [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];

  // Add a cache breakpoint on the last content block of the last message so
  // the growing conversation prefix is cached on each multi-turn request.
  const cachedMessages = messages.map((msg, idx) => {
    if (idx !== messages.length - 1) return msg;
    const content = Array.isArray(msg.content)
      ? msg.content.map((block, bi, arr) =>
          bi === arr.length - 1
            ? { ...block, cache_control: { type: 'ephemeral' } }
            : block
        )
      : [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }];
    return { ...msg, content };
  });

  const requestBody = {
    model: isResearch ? RESEARCH_MODEL : TUTOR_MODEL,
    max_tokens: isResearch ? RESEARCH_MAX_TOKENS : TUTOR_MAX_TOKENS,
    system: systemBlock,
    messages: cachedMessages,
  };
  if (isResearch) {
    requestBody.thinking = { type: 'enabled', budget_tokens: RESEARCH_THINKING_BUDGET };
    requestBody.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: RESEARCH_WEB_SEARCH_MAX_USES,
    }];
  }

  // Include the PDF beta header only when the conversation contains PDF documents
  const hasPdf = messages.some(m =>
    Array.isArray(m.content) &&
    m.content.some(b => b.type === 'document' && b.source?.media_type === 'application/pdf')
  );
  const betaFlags = ['prompt-caching-2024-07-31'];
  if (hasPdf) betaFlags.push('pdfs-2024-09-25');

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': betaFlags.join(','),
      },
      body: JSON.stringify(requestBody),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.error('Anthropic error:', data);
      return json({ error: 'upstream_error', detail: data?.error?.message || 'Unknown' }, apiRes.status);
    }

    await logCall(supa, { userId: user?.id, ipHash, mode, subject });

    const blocks = data.content || [];
    const text = blocks
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const citationsByUrl = new Map();
    for (const b of blocks) {
      if (b.type !== 'text' || !Array.isArray(b.citations)) continue;
      for (const c of b.citations) {
        if (c?.type !== 'web_search_result_location' || !c.url) continue;
        if (!citationsByUrl.has(c.url)) {
          citationsByUrl.set(c.url, { url: c.url, title: c.title || c.url });
        }
      }
    }
    const citations = Array.from(citationsByUrl.values());
    const searchCount = data?.usage?.server_tool_use?.web_search_requests || 0;

    return json({ text, citations, searchCount, stop_reason: data.stop_reason, usage: data.usage });
  } catch (err) {
    console.error('Proxy error:', err);
    return json({ error: 'proxy_failure', detail: String(err.message || err) }, 500);
  }
}

/* ===========================================================
   GET /history — fetch saved conversations for an auth'd user
   =========================================================== */
export async function getHistory({ request, env }) {
  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: conversations, error } = await supa
    .from('conversations')
    .select(`
      id, subject_id, mode, title, created_at,
      messages ( id, role, content, citations, created_at )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return json({ error: error.message }, 500);

  // Shape matches the localStorage format so the frontend can use either source
  const shaped = conversations.map(c => ({
    id: c.id,
    subjectId: c.subject_id,
    subjectLabel: c.subject_label || c.subject_id,
    mode: c.mode,
    title: c.title,
    startedAt: c.created_at,
    messages: (c.messages || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(m => ({
        id: m.id,
        role: m.role === 'user' ? 'student' : 'tutor',
        content: m.content,
        citations: m.citations || [],
      })),
  }));

  return json({ conversations: shaped });
}

/* ===========================================================
   POST /history — upsert a conversation + its messages
   =========================================================== */
export async function upsertConversation({ request, env }) {
  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  if (!user) return json({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { id, subjectId, subjectLabel, mode, title, messages, startedAt } = body;
  if (!id || !subjectId || !mode || !title) return json({ error: 'Missing required fields' }, 400);

  const { error: convErr } = await supa
    .from('conversations')
    .upsert({
      id,
      user_id: user.id,
      subject_id: subjectId,
      subject_label: subjectLabel || subjectId,
      mode,
      title,
      created_at: startedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (convErr) return json({ error: convErr.message }, 500);

  if (Array.isArray(messages) && messages.length > 0) {
    await supa.from('messages').delete().eq('conversation_id', id);
    const rows = messages.map((m, idx) => ({
      conversation_id: id,
      role: m.role === 'student' ? 'user' : 'assistant',
      content: m.content,
      citations: m.citations?.length ? m.citations : null,
      sort_order: idx,
    }));
    const { error: msgErr } = await supa.from('messages').insert(rows);
    if (msgErr) return json({ error: msgErr.message }, 500);
  }

  return json({ ok: true });
}

/* ===========================================================
   POST /session/start — gate new conversations by daily caps
   =========================================================== */
export async function startSession({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const mode = body?.mode === 'research' ? 'research' : 'tutor';
  const subject = typeof body?.subject === 'string' ? body.subject : null;
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null;

  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const tier = user ? user.tier : 'guest';
  const cap = SESSION_CAPS[tier][mode];
  const isDev = !!user?.is_dev;

  // Dev users bypass caps (matches the pattern in /chat).
  if (isDev) {
    if (supa) {
      await supa.from('usage_logs').insert({
        user_id: user.id, ip_hash: ipHash, event_type: 'session_start',
        mode, subject, conversation_id: conversationId,
      });
    }
    return json({ ok: true, used: 0, cap, tier, dev: true });
  }

  if (!supa) {
    // Can't enforce without DB. Fail-closed for safety so this branch never silently allows unlimited.
    return json({ error: 'server_misconfigured' }, 500);
  }

  // Insert first, then count — if over cap, delete the row we just wrote.
  const { data: inserted, error: insErr } = await supa
    .from('usage_logs')
    .insert({
      user_id: user?.id || null,
      ip_hash: ipHash,
      event_type: 'session_start',
      mode,
      subject,
      conversation_id: conversationId,
    })
    .select('id')
    .single();

  if (insErr) {
    console.error('session_start insert failed:', insErr);
    return json({ error: 'log_failed' }, 500);
  }

  const used = await countDailySessionStarts(supa, { userId: user?.id, ipHash, mode });

  if (used > cap) {
    await supa.from('usage_logs').delete().eq('id', inserted.id);
    return json({
      error: 'session_limit',
      message: tier === 'guest'
        ? `Guests get ${cap} ${mode} sessions per day. Sign up free for more.`
        : tier === 'free'
          ? `Free plan: ${cap} ${mode} ${cap === 1 ? 'session' : 'sessions'}/day. Upgrade to Pro for ${SESSION_CAPS.pro[mode]}/day.`
          : `Pro plan: ${cap} ${mode} sessions/day. Try again tomorrow.`,
      used: used - 1,
      cap,
      tier,
    }, 429);
  }

  return json({ ok: true, used, cap, tier });
}

/* ===========================================================
   GET /usage — current tier + today's session counts
   =========================================================== */
export async function getUsage({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const tier = user ? user.tier : 'guest';
  const caps = SESSION_CAPS[tier];

  const [tutorUsed, researchUsed] = supa
    ? await Promise.all([
        countDailySessionStarts(supa, { userId: user?.id, ipHash, mode: 'tutor' }),
        countDailySessionStarts(supa, { userId: user?.id, ipHash, mode: 'research' }),
      ])
    : [0, 0];

  return json({
    tier,
    is_dev: !!user?.is_dev,
    tutor:    { used: tutorUsed,    cap: caps.tutor },
    research: { used: researchUsed, cap: caps.research },
  });
}

/* ===========================================================
   POST /dev/set-tier — dev-only tier flip (no Stripe yet)
   Body: { tier: 'free' | 'pro' }
   =========================================================== */
export async function setDevTier({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  if (!user) return json({ error: 'Unauthorized' }, 401);
  if (!user.is_dev) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const tier = body?.tier === 'pro' ? 'pro' : 'free';

  const { error } = await supa
    .from('subscriptions')
    .upsert({ user_id: user.id, tier, status: 'active', updated_at: new Date().toISOString() },
            { onConflict: 'user_id' });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, tier });
}

/* ===========================================================
   Stripe helpers
   =========================================================== */

// Flatten a JS object into Stripe's bracket-encoded form params.
// e.g. { line_items: [{ price: 'p_x', quantity: 1 }] }
//   → "line_items[0][price]=p_x&line_items[0][quantity]=1"
function buildStripeParams(obj) {
  const params = new URLSearchParams();
  function flatten(o, prefix) {
    for (const [k, v] of Object.entries(o)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        v.forEach((item, i) => {
          if (item !== null && typeof item === 'object') flatten(item, `${key}[${i}]`);
          else params.append(`${key}[${i}]`, item);
        });
      } else if (typeof v === 'object') {
        flatten(v, key);
      } else {
        params.append(key, v);
      }
    }
  }
  flatten(obj, '');
  return params;
}

async function stripeReq(path, method, data, key) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data ? buildStripeParams(data).toString() : undefined,
  });
  return res.json();
}

// Verify Stripe-Signature header using HMAC-SHA256.
// Returns true if valid; false if tampered or too old (>5 min).
async function verifyStripeSignature(rawBody, sigHeader, secret) {
  const entries = Object.fromEntries(sigHeader.split(',').map(s => s.split('=', 2)));
  const timestamp = entries.t;
  const claimed = sigHeader.split(',').filter(s => s.startsWith('v1=')).map(s => s.slice(3));
  if (!timestamp || claimed.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

  const keyBytes = new TextEncoder().encode(secret);
  const msgBytes = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return claimed.some(s => s === hex);
}

/* ===========================================================
   POST /stripe/checkout — create a Checkout Session
   =========================================================== */
export async function createStripeCheckout({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  if (!user) return json({ error: 'Unauthorized' }, 401);

  if (!env.STRIPE_SECRET_KEY)   return json({ error: 'stripe_not_configured' }, 500);
  if (!env.STRIPE_PRO_PRICE_ID) return json({ error: 'stripe_price_not_configured' }, 500);

  const { data: sub } = await supa
    .from('subscriptions')
    .select('stripe_customer_id, tier, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (sub?.tier === 'pro' && sub?.status === 'active') {
    return json({ error: 'already_subscribed' }, 400);
  }

  const origin = new URL(request.url).origin;
  const params = {
    mode: 'subscription',
    line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/?checkout=success`,
    cancel_url: `${origin}/?checkout=canceled`,
    client_reference_id: user.id,
    ...(sub?.stripe_customer_id
      ? { customer: sub.stripe_customer_id }
      : { customer_email: user.email || undefined }),
  };

  const session = await stripeReq('checkout/sessions', 'POST', params, env.STRIPE_SECRET_KEY);
  if (!session.url) {
    console.error('Stripe checkout error:', session);
    return json({ error: 'stripe_error', detail: session.error?.message }, 500);
  }

  return json({ url: session.url });
}

/* ===========================================================
   POST /stripe/portal — open Billing Portal for a subscriber
   =========================================================== */
export async function createStripePortal({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  if (!user) return json({ error: 'Unauthorized' }, 401);

  if (!env.STRIPE_SECRET_KEY) return json({ error: 'stripe_not_configured' }, 500);

  const { data: sub } = await supa
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return json({ error: 'no_stripe_customer', message: 'No billing account found.' }, 404);
  }

  const origin = new URL(request.url).origin;
  const portal = await stripeReq('billing_portal/sessions', 'POST', {
    customer: sub.stripe_customer_id,
    return_url: `${origin}/`,
  }, env.STRIPE_SECRET_KEY);

  if (!portal.url) {
    console.error('Stripe portal error:', portal);
    return json({ error: 'stripe_error', detail: portal.error?.message }, 500);
  }

  return json({ url: portal.url });
}

/* ===========================================================
   POST /stripe/webhook — handle Stripe events
   Subscribed events: checkout.session.completed,
     customer.subscription.created, customer.subscription.updated,
     customer.subscription.deleted
   =========================================================== */
export async function handleStripeWebhook({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    return json({ error: 'stripe_not_configured' }, 500);
  }

  const rawBody = await request.text();
  const sig = request.headers.get('Stripe-Signature') || '';

  if (!(await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'invalid_signature' }, 400);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400); }

  const supa = makeSupa(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supa) return json({ error: 'server_misconfigured' }, 500);

  const obj = event.data?.object;
  const now = new Date().toISOString();

  if (event.type === 'checkout.session.completed') {
    const userId = obj.client_reference_id;
    const customerId = obj.customer;
    const subscriptionId = obj.subscription;
    if (userId && customerId) {
      await supa.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId || null,
        tier: 'pro',
        status: 'active',
        updated_at: now,
      }, { onConflict: 'user_id' });
    }
  } else if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const customerId = obj.customer;
    const stripeStatus = obj.status; // active | trialing | past_due | canceled | unpaid
    const isPro = stripeStatus === 'active' || stripeStatus === 'trialing' || stripeStatus === 'past_due';
    const periodEnd = obj.current_period_end
      ? new Date(obj.current_period_end * 1000).toISOString()
      : null;

    const { data: existing } = await supa
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (existing?.user_id) {
      await supa.from('subscriptions').update({
        stripe_subscription_id: obj.id,
        tier: isPro ? 'pro' : 'free',
        status: 'active',
        current_period_end: periodEnd,
        updated_at: now,
      }).eq('user_id', existing.user_id);
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const customerId = obj.customer;
    const { data: existing } = await supa
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (existing?.user_id) {
      await supa.from('subscriptions').update({
        tier: 'free',
        status: 'active',
        current_period_end: null,
        updated_at: now,
      }).eq('user_id', existing.user_id);
    }
  }

  return json({ received: true });
}
