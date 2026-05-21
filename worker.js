import { onRequest, getHistory, upsertConversation } from './functions/chat.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/chat') {
      return onRequest({ request, env, ctx });
    }
    if (url.pathname === '/history') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }
      if (request.method === 'GET') return getHistory({ request, env, ctx });
      if (request.method === 'POST') return upsertConversation({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
