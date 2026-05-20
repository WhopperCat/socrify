// Server-side signup — uses the service role key so GoTrue's email
// DNS validation never runs on the browser client.
//
// Env vars (same as chat.js):
//   SUPABASE_DATABASE_URL  OR  SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supaAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function usernameToEmail(u) {
  return `u-${(u || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')}@socrify.pro`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!supaAdmin) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { username, password, recovery_email } = body;

  if (!username || !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Username: 3–20 chars, letters/numbers/_/- only.' }) };
  }
  if (!password || password.length < 6) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Password must be at least 6 characters.' }) };
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
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
