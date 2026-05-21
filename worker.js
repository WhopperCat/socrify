import { onRequest, getHistory, upsertConversation, startSession, getUsage, setDevTier } from './functions/chat.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/chat') {
      return onRequest({ request, env, ctx });
    }

    if (url.pathname === '/history') {
      if (request.method === 'OPTIONS') return preflight();
      if (request.method === 'GET')  return getHistory({ request, env, ctx });
      if (request.method === 'POST') return upsertConversation({ request, env, ctx });
    }

    if (url.pathname === '/session/start') {
      if (request.method === 'OPTIONS') return preflight();
      if (request.method === 'POST') return startSession({ request, env, ctx });
    }

    if (url.pathname === '/usage') {
      if (request.method === 'OPTIONS') return preflight();
      if (request.method === 'GET') return getUsage({ request, env, ctx });
    }

    if (url.pathname === '/dev/set-tier') {
      if (request.method === 'OPTIONS') return preflight();
      if (request.method === 'POST') return setDevTier({ request, env, ctx });
    }

    // Public bootstrap config. MUST expose the anon key only — never the service role key.
    // The frontend reads window.__SOCRIFY_CONFIG__ to boot its Supabase client.
    if (url.pathname === '/config.js') {
      const cfg = {
        supabaseUrl: env.SUPABASE_URL || '',
        supabaseAnonKey: env.SUPABASE_ANON_KEY || '',
      };
      return new Response(
        `window.__SOCRIFY_CONFIG__ = ${JSON.stringify(cfg)};`,
        {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
