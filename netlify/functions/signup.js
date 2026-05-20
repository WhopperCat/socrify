// Server-side signup — uses the service role key so GoTrue's email
// DNS validation never runs on the browser client.
//
// Env vars required on Netlify:
//   SUPABASE_URL              (Supabase project URL, e.g. https://xxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY (service role key — never expose to the client)

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supaAdmin = null;
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
} catch (err) {
  console.error('Supabase client init failed:', err.message);
  // supaAdmin stays null; handler returns 500 "Server configuration error"
}

const SIGNUP_LIMIT_PER_HOUR = 10;

// Only allow requests from the production domain and Netlify preview deploys.
const ALLOWED_ORIGIN_RE = /^https:\/\/(socrify\.pro|[a-z0-9-]+\.netlify\.app)$/;

function corsHeaders(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowed = ALLOWED_ORIGIN_RE.test(origin) ? origin : 'https://socrify.pro';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function getClientIp(event) {
  const fwd = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  if (fwd) return fwd.split(',')[0].trim();
  return event.headers['client-ip'] || event.headers['x-real-ip'] || 'unknown';
}

function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || 'socrify-beta-salt';
  return crypto.createHash('sha256').update(salt + (ip || '')).digest('hex').slice(0, 32);
}

async function checkSignupRateLimit(ipHash) {
  if (!supaAdmin) return { ok: true };
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supaAdmin
    .from('usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'signup')
    .eq('ip_hash', ipHash)
    .gte('created_at', oneHourAgo);
  if (error) return { ok: true }; // fail open on infra errors
  return { ok: (count || 0) < SIGNUP_LIMIT_PER_HOUR, used: count || 0 };
}

async function logSignup(ipHash) {
  if (!supaAdmin) return;
  await supaAdmin.from('usage_logs').insert({ ip_hash: ipHash, event_type: 'signup' });
}

function usernameToEmail(u) {
  return `u-${(u || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')}@socrify.pro`;
}

exports.handler = async (event) => {
  const cors = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!supaAdmin) {
    console.error(
      'Supabase client not initialised.',
      'SUPABASE_URL set:', !!process.env.SUPABASE_URL,
      'SUPABASE_SERVICE_ROLE_KEY set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  try {
    const ipHash = hashIp(getClientIp(event));
    const rl = await checkSignupRateLimit(ipHash);
    if (!rl.ok) {
      return {
        statusCode: 429,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Too many signup attempts. Please try again later.' }),
      };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { username, password, recovery_email } = body;

    if (!username || !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Username: 3–20 chars, letters/numbers/_/- only.' }) };
    }
    if (!password || password.length < 6) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Password must be at least 6 characters.' }) };
    }

    const { error } = await supaAdmin.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
      user_metadata: {
        username,
        recovery_email: recovery_email || null,
      },
    });

    if (error) {
      return {
        statusCode: error.status || 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message }),
      };
    }

    await logSignup(ipHash);

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Signup failed. Please try again.' }),
    };
  }
};
