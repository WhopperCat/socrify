// Socrify — Anthropic API proxy (Cloudflare Pages Function)
// All client AI calls route through here.
// - Holds API key server-side (env: ANTHROPIC_API_KEY)
// - Enforces hourly rate limits via Supabase
// - Tutor uses Haiku 4.5 (fast back-and-forth)
// - Research uses Sonnet 4.6 with extended thinking (deeper, slower)
//
// Env vars (set in Cloudflare Pages dashboard → Settings → Environment variables):
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   IP_HASH_SALT (optional)

import { createClient } from '@supabase/supabase-js';

const TUTOR_MODEL = 'claude-haiku-4-5-20251001';
const RESEARCH_MODEL = 'claude-sonnet-4-6';
const TUTOR_MAX_TOKENS = 1024;
const RESEARCH_THINKING_BUDGET = 3000;
const RESEARCH_MAX_TOKENS = 10000;
const RESEARCH_WEB_SEARCH_MAX_USES = 5;

const LIMITS = { guest: 15, free: 60 };
const RESEARCH_DAILY_LIMIT = 1;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function getSupaClient(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } catch (err) {
    console.error('Supabase client init failed:', err.message);
    return null;
  }
}

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode((salt || 'socrify-beta-salt') + (ip || ''));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

async function checkRateLimit(supa, { userId, ipHash, isGuest }) {
  if (!supa) return { ok: true, skipped: true };
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const cap = isGuest ? LIMITS.guest : LIMITS.free;

  let q = supa
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'ai_call')
    .gte('created_at', oneHourAgo);

  if (userId) q = q.eq('user_id', userId);
  else q = q.eq('ip_hash', ipHash);

  const { count, error } = await q;
  if (error) {
    console.error('Rate limit query failed:', error);
    return { ok: true, errored: true };
  }
  return { ok: (count || 0) < cap, used: count || 0, cap };
}

async function checkResearchDailyLimit(supa, { userId, ipHash }) {
  if (!supa) return { ok: true, skipped: true };
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let q = supa
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'ai_call')
    .eq('mode', 'research')
    .gte('created_at', oneDayAgo);

  if (userId) q = q.eq('user_id', userId);
  else q = q.eq('ip_hash', ipHash);

  const { count, error } = await q;
  if (error) {
    console.error('Research daily limit query failed:', error);
    return { ok: true, errored: true };
  }
  return { ok: (count || 0) < RESEARCH_DAILY_LIMIT, used: count || 0, cap: RESEARCH_DAILY_LIMIT };
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

  const { data: profile } = await supa
    .from('profiles')
    .select('is_dev')
    .eq('id', data.user.id)
    .maybeSingle();

  return { id: data.user.id, is_dev: !!profile?.is_dev };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'Server missing ANTHROPIC_API_KEY' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { messages, system, mode, subject } = body;

  if (!Array.isArray(messages) || messages.length === 0)
    return json({ error: 'messages[] required' }, 400);
  if (typeof system !== 'string' || system.length < 20)
    return json({ error: 'system prompt required' }, 400);
  if (messages.length > 60)
    return json({ error: 'Conversation too long' }, 400);

  const supa = getSupaClient(env);
  const user = await verifyUser(supa, request.headers.get('Authorization'));
  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const isGuest = !user;
  const isDev = !!user?.is_dev;

  if (!isDev) {
    const rl = await checkRateLimit(supa, { userId: user?.id, ipHash, isGuest });
    if (!rl.ok) {
      return json({
        error: 'rate_limited',
        message: `Hourly limit reached (${rl.used}/${rl.cap}). Try again in a bit.`,
        used: rl.used,
        cap: rl.cap,
      }, 429);
    }

    if (mode === 'research') {
      const rdl = await checkResearchDailyLimit(supa, { userId: user?.id, ipHash });
      if (!rdl.ok) {
        return json({
          error: 'research_daily_limit',
          message: `Research mode is limited to ${rdl.cap} deep dive per day. Try again in 24 hours, or use Tutor mode in the meantime.`,
          used: rdl.used,
          cap: rdl.cap,
        }, 429);
      }
    }
  }

  const isResearch = mode === 'research';
  const requestBody = {
    model: isResearch ? RESEARCH_MODEL : TUTOR_MODEL,
    max_tokens: isResearch ? RESEARCH_MAX_TOKENS : TUTOR_MAX_TOKENS,
    system,
    messages,
  };
  if (isResearch) {
    requestBody.thinking = { type: 'enabled', budget_tokens: RESEARCH_THINKING_BUDGET };
    requestBody.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: RESEARCH_WEB_SEARCH_MAX_USES,
    }];
  }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
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
    const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');

    const citationsByUrl = new Map();
    for (const b of blocks) {
      if (b.type !== 'text' || !Array.isArray(b.citations)) continue;
      for (const c of b.citations) {
        if (c?.type !== 'web_search_result_location' || !c.url) continue;
        if (!citationsByUrl.has(c.url))
          citationsByUrl.set(c.url, { url: c.url, title: c.title || c.url });
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
