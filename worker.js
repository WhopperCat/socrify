import { onRequest } from './functions/chat.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/chat') {
      return onRequest({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
