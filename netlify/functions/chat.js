// Socrify Beta — Anthropic API proxy
// All client AI calls route through here.
// - Holds API key server-side (env: ANTHROPIC_API_KEY)
// - Enforces hourly rate limits via Supabase
// - Tutor uses Haiku 4.5 (fast back-and-forth)
// - Research uses Sonnet 4.6 with extended thinking (deeper, slower)
//
// Env vars expected on Netlify:
//   ANTHROPIC_API_KEY          (manually added)
//   SUPABASE_URL               (Supabase extension auto-injects)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase extension auto-injects)

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TUTOR_MODEL = 'claude-haiku-4-5-20251001';
const RESEARCH_MODEL = 'claude-sonnet-4-6';
const TUTOR_MAX_TOKENS = 1024;
// Research: extended thinking budget + room for a thorough response.
// max_tokens must be strictly greater than thinking budget.
const RESEARCH_THINKING_BUDGET = 8000;
const RESEARCH_MAX_TOKENS = 12000;

// Rate limit policy (hourly windows)
const LIMITS = {
  guest: 15,   // per IP
  free:  60,   // per user
};

// Research mode is expensive (Sonnet + extended thinking). Cap at 1 call per
// 24h per user/IP — one deep dive per day.
const RESEARCH_DAILY_LIMIT = 1;

let supa = null;
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
} catch (err) {
  console.error('Supabase client init failed:', err.message);
  // supa stays null; rate limiting is skipped (fail open)
}

function hashIp(ip) {
  // Hash with a stable salt so we don't store raw IPs.
  const salt = process.env.IP_HASH_SALT || 'socrify-beta-salt';
  return crypto.createHash('sha256').update(salt + (ip || '')).digest('hex').slice(0, 32);
}

function getClientIp(event) {
  const fwd = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  if (fwd) return fwd.split(',')[0].trim();
  return event.headers['client-ip'] || event.headers['x-real-ip'] || 'unknown';
}

async function checkRateLimit({ userId, ipHash, isGuest }) {
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
    // Fail open on infra errors — don't block a real user because of a Supabase blip.
    return { ok: true, errored: true };
  }
  return { ok: (count || 0) < cap, used: count || 0, cap };
}

async function checkResearchDailyLimit({ userId, ipHash }) {
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

async function logCall({ userId, ipHash, mode, subject }) {
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

async function verifyUser(authHeader) {
  // Verifies the Supabase JWT the client sent. Returns { id, is_dev } or null.
  if (!authHeader || !authHeader.startsWith('Bearer ') || !supa) return null;
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

exports.handler = async (event) => {
  // CORS / method gate
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server missing ANTHROPIC_API_KEY' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { messages, system, mode, subject } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages[] required' }) };
  }
  if (typeof system !== 'string' || system.length < 20) {
    return { statusCode: 400, body: JSON.stringify({ error: 'system prompt required' }) };
  }
  // Hard cap message history size — prevent abuse / runaway costs
  if (messages.length > 60) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Conversation too long' }) };
  }

  // Identify caller: authenticated user via JWT, otherwise guest by IP
  const user = await verifyUser(event.headers.authorization || event.headers.Authorization);
  const ip = getClientIp(event);
  const ipHash = hashIp(ip);
  const isGuest = !user;
  const isDev = !!user?.is_dev;

  // Rate limit (dev bypass)
  if (!isDev) {
    const rl = await checkRateLimit({ userId: user?.id, ipHash, isGuest });
    if (!rl.ok) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'rate_limited',
          message: `Hourly limit reached (${rl.used}/${rl.cap}). Try again in a bit.`,
          used: rl.used,
          cap: rl.cap,
        }),
      };
    }

    // Extra cap for research — only 1 deep dive per 24h.
    if (mode === 'research') {
      const rdl = await checkResearchDailyLimit({ userId: user?.id, ipHash });
      if (!rdl.ok) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'research_daily_limit',
            message: `Research mode is limited to ${rdl.cap} deep dive per day. Try again in 24 hours, or use Tutor mode in the meantime.`,
            used: rdl.used,
            cap: rdl.cap,
          }),
        };
      }
    }
  }

  // Pick model + token budget by mode. Research runs Sonnet with extended thinking
  // so it can do real exploration; Tutor runs Haiku for snappy back-and-forth.
  const isResearch = mode === 'research';
  const requestBody = {
    model: isResearch ? RESEARCH_MODEL : TUTOR_MODEL,
    max_tokens: isResearch ? RESEARCH_MAX_TOKENS : TUTOR_MAX_TOKENS,
    system,
    messages,
  };
  if (isResearch) {
    requestBody.thinking = { type: 'enabled', budget_tokens: RESEARCH_THINKING_BUDGET };
  }

  // Call Anthropic
  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.error('Anthropic error:', data);
      return {
        statusCode: apiRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'upstream_error', detail: data?.error?.message || 'Unknown' }),
      };
    }

    // Log AFTER successful call so failed calls don't burn quota
    await logCall({ userId: user?.id, ipHash, mode, subject });

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        stop_reason: data.stop_reason,
        usage: data.usage,
      }),
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'proxy_failure', detail: String(err.message || err) }),
    };
  }
};
