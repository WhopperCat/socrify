/* =========================================================
   Socrify · Supabase auth + tier state + API helpers
   ========================================================= */

// Reason for missing client, so callers can surface a useful message.
window.__SUPABASE_BOOT_ERROR__ = null;

function bootSupabase() {
  if (window.sb) return window.sb;
  const cfg = window.__SOCRIFY_CONFIG__ || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    window.__SUPABASE_BOOT_ERROR__ = !window.__SOCRIFY_CONFIG__
      ? 'config_not_loaded'
      : 'config_missing_keys';
    return null;
  }
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    window.__SUPABASE_BOOT_ERROR__ = 'sdk_not_loaded';
    return null;
  }
  window.__SUPABASE_BOOT_ERROR__ = null;
  // eslint-disable-next-line no-undef
  window.sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return window.sb;
}

function authNotReadyError() {
  bootSupabase();
  const reason = window.__SUPABASE_BOOT_ERROR__;
  const message =
    reason === 'config_not_loaded' ? 'Auth is offline — could not load app config. Please refresh the page.' :
    reason === 'config_missing_keys' ? 'Auth is not configured for this deployment. Please contact support.' :
    reason === 'sdk_not_loaded' ? 'Auth library failed to load. Check your network and refresh.' :
    'Auth is unavailable right now. Please refresh and try again.';
  console.error('[auth] supabase unavailable:', reason || 'unknown');
  return { error: { message, code: reason || 'auth_unavailable' } };
}

bootSupabase();

/* ── auth helpers ── */
async function authSignUp({ email, password, firstName }) {
  if (!bootSupabase()) return authNotReadyError();
  return window.sb.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName || null },
      emailRedirectTo: window.location.origin,
    },
  });
}

async function authSignIn({ email, password }) {
  if (!bootSupabase()) return authNotReadyError();
  return window.sb.auth.signInWithPassword({ email, password });
}

async function authSignOut() {
  if (!window.sb) return;
  await window.sb.auth.signOut();
}

async function authResend({ email }) {
  if (!bootSupabase()) return authNotReadyError();
  return window.sb.auth.resend({ type: 'signup', email });
}

async function fetchProfileBundle(userId) {
  if (!window.sb || !userId) return { profile: null, tier: 'free', isDev: false };
  const [{ data: profile }, { data: sub }] = await Promise.all([
    window.sb.from('profiles').select('first_name,email,is_dev').eq('id', userId).maybeSingle(),
    window.sb.from('subscriptions').select('tier,status,current_period_end').eq('user_id', userId).maybeSingle(),
  ]);
  const tier = sub && sub.status === 'active' && sub.tier === 'pro' ? 'pro' : 'free';
  return { profile: profile || null, sub: sub || null, tier, isDev: !!profile?.is_dev };
}

/* ── React hook: session + profile + tier ── */
function useAuthSession() {
  const [state, setState] = React.useState({
    ready: false,
    user: null,
    profile: null,
    sub: null,
    tier: 'guest',
    isDev: false,
    accessToken: null,
  });

  const refresh = React.useCallback(async () => {
    if (!window.sb) {
      setState(s => ({ ...s, ready: true }));
      return;
    }
    const { data } = await window.sb.auth.getSession();
    const session = data?.session || null;
    if (!session?.user) {
      setState({ ready: true, user: null, profile: null, sub: null, tier: 'guest', isDev: false, accessToken: null });
      return;
    }
    const bundle = await fetchProfileBundle(session.user.id);
    setState({
      ready: true,
      user: session.user,
      profile: bundle.profile,
      sub: bundle.sub,
      tier: bundle.tier,
      isDev: bundle.isDev,
      accessToken: session.access_token,
    });
  }, []);

  React.useEffect(() => {
    refresh();
    if (!window.sb) return;
    const { data: sub } = window.sb.auth.onAuthStateChange(() => { refresh(); });
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, [refresh]);

  return { ...state, refresh };
}

/* ── authed fetch (with one-shot refresh + retry on 401) ──
   If a token expires between auth-state read and request, Supabase's
   background autoRefreshToken may not have run yet. On 401 we ask Supabase
   for a fresh access token and replay the request once. */
async function authedFetch(url, { method = 'GET', body, accessToken, headers = {}, _retried = false } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (accessToken) h.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status !== 401 || _retried || !accessToken || !window.sb) return res;
  try {
    const { data, error } = await window.sb.auth.refreshSession();
    const newToken = data?.session?.access_token;
    if (error || !newToken || newToken === accessToken) return res;
    return authedFetch(url, { method, body, accessToken: newToken, headers, _retried: true });
  } catch {
    return res;
  }
}

async function apiStartSession({ accessToken, mode, subject, conversationId }) {
  const res = await authedFetch('/session/start', {
    method: 'POST',
    accessToken,
    body: { mode, subject, conversationId },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function apiGetUsage({ accessToken }) {
  const res = await authedFetch('/usage', { method: 'GET', accessToken });
  if (!res.ok) return null;
  return res.json();
}

async function apiSetDevTier({ accessToken, tier }) {
  const res = await authedFetch('/dev/set-tier', {
    method: 'POST',
    accessToken,
    body: { tier },
  });
  return res.ok;
}

// Returns { url } on success or throws.
async function apiCreateCheckoutSession({ accessToken }) {
  const res = await authedFetch('/stripe/checkout', { method: 'POST', accessToken });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'checkout_failed');
  return data;
}

// Returns { url } on success or throws.
async function apiOpenBillingPortal({ accessToken }) {
  const res = await authedFetch('/stripe/portal', { method: 'POST', accessToken });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'portal_failed');
  return data;
}

Object.assign(window, {
  authSignUp, authSignIn, authSignOut, authResend, fetchProfileBundle,
  useAuthSession, authedFetch,
  apiStartSession, apiGetUsage, apiSetDevTier,
  apiCreateCheckoutSession, apiOpenBillingPortal,
});
