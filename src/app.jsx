/* =========================================================
   Socrify · Root app — navigation between views + Tweaks
   ========================================================= */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "logoVariant": "spark",
  "accentHue": 255,
  "startView": "landing"
}/*EDITMODE-END*/;

const VIEW_TO_PATH = {
  landing: '/',
  auth: '/auth',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
};
const PATH_TO_VIEW = {
  '/': 'landing',
  '/auth': 'auth',
  '/onboarding': 'onboarding',
  '/dashboard': 'dashboard',
};
function viewFromLocation() {
  return PATH_TO_VIEW[window.location.pathname] || 'landing';
}

function Root() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Live-apply accent hue
  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent-hue', tweaks.accentHue);
  }, [tweaks.accentHue]);

  const [view, setViewState] = React.useState(viewFromLocation);
  const navigate = React.useCallback((nextView) => {
    const path = VIEW_TO_PATH[nextView] || '/';
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path + window.location.search + window.location.hash);
    }
    setViewState(nextView);
  }, []);
  // Canonicalise unknown initial paths (e.g. /foo) to /.
  React.useEffect(() => {
    if (!PATH_TO_VIEW[window.location.pathname]) {
      window.history.replaceState(null, '', '/' + window.location.search + window.location.hash);
    }
  }, []);
  React.useEffect(() => {
    const onPop = () => setViewState(viewFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('socrify_theme') || 'light');
  const [dyslexic, setDyslexic] = React.useState(() => localStorage.getItem('socrify_dyslexic') === '1');
  const [fontSize, setFontSize] = React.useState(() => Number(localStorage.getItem('socrify_fontsize')) || 100);
  const [reduceMotion, setReduceMotion] = React.useState(() => localStorage.getItem('socrify_reducemotion') === '1');
  const [isGuest, setIsGuest] = React.useState(false);

  const auth = useAuthSession();
  const profile = auth.user
    ? { first_name: auth.profile?.first_name || auth.user.email?.split('@')[0] || 'friend', email: auth.user.email }
    : (isGuest ? { first_name: 'Guest' } : null);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('socrify_theme', theme);
  }, [theme]);
  React.useEffect(() => {
    document.body.classList.toggle('dyslexic', dyslexic);
    localStorage.setItem('socrify_dyslexic', dyslexic ? '1' : '0');
  }, [dyslexic]);
  React.useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
    localStorage.setItem('socrify_fontsize', String(fontSize));
  }, [fontSize]);
  React.useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    localStorage.setItem('socrify_reducemotion', reduceMotion ? '1' : '0');
  }, [reduceMotion]);

  const settingsProps = { theme, setTheme, dyslexic, setDyslexic, fontSize, setFontSize, reduceMotion, setReduceMotion };

  const goLanding   = () => { setIsGuest(false); navigate('landing'); };
  const goAuth      = () => navigate('auth');
  const goGuest     = () => { setIsGuest(true); navigate('dashboard'); };
  // After signup we send users through onboarding; after signin straight to dashboard.
  const onAuthOk    = (mode) => { setIsGuest(false); navigate(mode === 'signup' ? 'onboarding' : 'dashboard'); };
  const onOnboarded = () => {
    if (auth.user) localStorage.setItem('socrify_onboarded_' + auth.user.id, '1');
    navigate('dashboard');
  };
  const logout      = async () => {
    await authSignOut();
    setIsGuest(false);
    navigate('landing');
  };

  // When a session appears (returning user, or email confirmation redirect), route appropriately.
  // New users (account < 1 hour old) who haven't finished onboarding go there first.
  React.useEffect(() => {
    if (!auth.ready) return;
    if (auth.user && (view === 'landing' || view === 'auth')) {
      const hasOnboarded = localStorage.getItem('socrify_onboarded_' + auth.user.id);
      const accountAgeMs = Date.now() - new Date(auth.user.created_at).getTime();
      const isNewUser = accountAgeMs < 60 * 60 * 1000;
      navigate(hasOnboarded || !isNewUser ? 'dashboard' : 'onboarding');
    }
  }, [auth.ready, auth.user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Stripe redirect — show a brief banner and refresh tier state.
  const [checkoutBanner, setCheckoutBanner] = React.useState(() => {
    const p = new URLSearchParams(window.location.search).get('checkout');
    if (p) {
      // Clean the URL without a reload.
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
    return p || null;
  });
  React.useEffect(() => {
    if (checkoutBanner === 'success') auth.refresh();
    if (checkoutBanner) {
      const t = setTimeout(() => setCheckoutBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, [checkoutBanner]); // eslint-disable-line react-hooks/exhaustive-deps

  const variant = tweaks.logoVariant;

  let screen;
  if (view === 'landing') {
    screen = <Landing
      variant={variant}
      onSignIn={goAuth}
      onGuest={goGuest}
      settingsProps={settingsProps}
    />;
  } else if (view === 'auth') {
    screen = <Auth variant={variant} onBack={goLanding} onSuccess={onAuthOk} settingsProps={settingsProps} />;
  } else if (view === 'onboarding') {
    screen = <Onboarding variant={variant} onDone={onOnboarded} settingsProps={settingsProps} />;
  } else {
    screen = <AppShell
      variant={variant}
      profile={profile}
      isGuest={isGuest}
      tier={isGuest ? 'guest' : auth.tier}
      isDev={auth.isDev}
      accessToken={auth.accessToken}
      onTierChange={auth.refresh}
      onLogout={logout}
      onGuestExit={goLanding}
      onGoAuth={goAuth}
      settingsProps={settingsProps}
      fontSize={fontSize}
      setFontSize={setFontSize}
      reduceMotion={reduceMotion}
      setReduceMotion={setReduceMotion}
    />;
  }

  return (
    <>
      {checkoutBanner && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, padding: '10px 20px', borderRadius: 999,
          background: checkoutBanner === 'success' ? 'var(--accent)' : 'var(--surface-2)',
          color: checkoutBanner === 'success' ? '#fff' : 'var(--text-2)',
          border: '1px solid ' + (checkoutBanner === 'success' ? 'transparent' : 'var(--border)'),
          fontSize: 14, fontWeight: 500, boxShadow: 'var(--shadow-lg)',
          animation: 'fadeInUp .2s ease',
          whiteSpace: 'nowrap',
        }}>
          {checkoutBanner === 'success'
            ? 'Welcome to Pro! Your account has been upgraded.'
            : 'Checkout canceled — you have not been charged.'}
        </div>
      )}
      {screen}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Logo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 6 }}>
            {[
              { id: 'spark',   Mark: SparkMark,   label: 'Spark' },
              { id: 'bloom',   Mark: BloomMark,   label: 'Bloom' },
              { id: 'quill',   Mark: QuillMark,   label: 'Quill' },
              { id: 'inquiry', Mark: InquiryMark, label: 'Inquiry' },
            ].map(({ id, Mark, label }) => (
              <button key={id} onClick={() => setTweak('logoVariant', id)} style={{
                padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: tweaks.logoVariant === id ? 'var(--accent-soft)' : 'var(--surface-2)',
                border: '1px solid ' + (tweaks.logoVariant === id ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 10, cursor: 'pointer', transition: 'all .12s ease',
              }}>
                <Mark size={28} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}>
            All four are original Socrify marks. Spark is the recommended primary.
          </div>
        </TweakSection>

        <TweakSection label="Accent hue">
          <TweakSlider
            label="Hue (oklch)"
            min={0} max={360} step={1}
            value={tweaks.accentHue}
            onChange={(v) => setTweak('accentHue', v)}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {[
              { name: 'Blue (default)', h: 255 },
              { name: 'Violet', h: 295 },
              { name: 'Teal', h: 195 },
              { name: 'Sage', h: 155 },
              { name: 'Plum', h: 335 },
              { name: 'Amber', h: 60 },
            ].map(p => (
              <button key={p.name} onClick={() => setTweak('accentHue', p.h)} style={{
                padding: '6px 10px', fontSize: 11.5, borderRadius: 999,
                border: '1px solid var(--border)',
                background: tweaks.accentHue === p.h ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: tweaks.accentHue === p.h ? 'var(--accent-ink)' : 'var(--text-2)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: `oklch(0.55 0.18 ${p.h})`,
                }} />
                {p.name}
              </button>
            ))}
          </div>
        </TweakSection>

        <TweakSection label="Jump to screen">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {[
              { id: 'landing',    label: 'Landing' },
              { id: 'auth',       label: 'Auth' },
              { id: 'onboarding', label: 'Onboarding' },
              { id: 'dashboard',  label: 'Dashboard' },
            ].map(s => (
              <button key={s.id} onClick={() => navigate(s.id)} style={{
                padding: '8px 10px', borderRadius: 8,
                background: view === s.id ? 'var(--accent-soft)' : 'var(--surface-2)',
                border: '1px solid ' + (view === s.id ? 'var(--accent)' : 'var(--border)'),
                color: view === s.id ? 'var(--accent-ink)' : 'var(--text-2)',
                fontSize: 12.5, fontFamily: 'var(--font-sans)', fontWeight: 500,
                cursor: 'pointer',
              }}>{s.label}</button>
            ))}
          </div>
        </TweakSection>

        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={theme}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            onChange={(v) => setTheme(v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
