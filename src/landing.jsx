/* =========================================================
   Socrify · Marketing + Auth screens
   Landing, Auth (sign-in / sign-up), Onboarding (5-step)
   ========================================================= */

const { useState, useEffect, useRef } = React;

/* ---------- Shared chrome ---------- */
function TopNav({ inkLogo = false, right, variant }) {
  return (
    <header className="r-topnav" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 40px', position: 'relative', zIndex: 5,
    }}>
      <SocrifyLogo variant={variant} size={26} showWord showBeta inkColor={inkLogo} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{right}</div>
    </header>
  );
}

function FooterFineprint() {
  return (
    <footer className="r-footer" style={{
      padding: '32px 40px 28px', display: 'flex', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 16, borderTop: '1px solid var(--border)',
      fontSize: 13, color: 'var(--text-muted)',
    }}>
      <div className="r-footer-meta" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          © Socrify 2026
        </span>
        <span>Beta — Tutor & Research modes.</span>
      </div>
      <div className="r-footer-links" style={{ display: 'flex', gap: 22 }}>
        <a href="#" style={linkStyle}>Privacy</a>
        <a href="#" style={linkStyle}>Terms</a>
        <a href="#" style={linkStyle}>Contact</a>
      </div>
    </footer>
  );
}
const linkStyle = { color: 'var(--text-muted)', textDecoration: 'none' };

/* ===========================================================
   LANDING
   =========================================================== */
function Landing({ onSignIn, onGuest, settingsProps, variant }) {
  return (
    <div className="bg-paper grain" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopNav
        variant={variant}
        right={
          <>
            <SettingsCluster {...settingsProps} compact />
            <button className="btn btn-bare btn-sm" onClick={onSignIn}>Sign in</button>
            <button className="btn btn-primary btn-sm" onClick={onSignIn}>Get started</button>
          </>
        }
      />

      {/* Decorative oversized mark in corner */}
      <div aria-hidden="true" className="r-hero-decor" style={{
        position: 'absolute', right: '-180px', top: '40px',
        opacity: 0.06, pointerEvents: 'none',
        color: 'var(--accent)',
      }}>
        <SparkMark size={620} />
      </div>

      <main className="r-pad-page" style={{ flex: 1, padding: '60px 40px 80px', maxWidth: 1180, margin: '0 auto', width: '100%', position: 'relative', zIndex: 2 }}>
        {/* Hero */}
        <section className="r-cols-1" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 80, alignItems: 'center' }}>
          <div className="fade-in-up">
            <div className="eyebrow" style={{ marginBottom: 22 }}>
              <span style={{ color: 'var(--accent-ink)' }}>●</span>&nbsp;&nbsp;Socratic tutoring, reimagined
            </div>
            <h1 className="display" style={{
              fontSize: 'clamp(48px, 6.5vw, 88px)',
              margin: '0 0 26px',
              maxWidth: '14ch',
            }}>
              The tutor that <em style={{ color: 'var(--accent)' }}>never gives</em> you the answer.
            </h1>
            <p style={{
              fontSize: 19, lineHeight: 1.5, color: 'var(--text-2)',
              maxWidth: '46ch', margin: '0 0 36px',
            }}>
              Socrify asks the right questions so you actually understand —
              instead of pasting a chatbot's homework. Personalized to your level, your interests, your pace.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={onSignIn} className="btn btn-accent btn-lg">
                Start learning <span aria-hidden="true">→</span>
              </button>
              <button onClick={onGuest} className="btn btn-ghost btn-lg">Try as guest</button>
            </div>
            <div className="r-hero-bullets" style={{ marginTop: 32, display: 'flex', gap: 28, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>✓ &nbsp;Free forever</span>
              <span>✓ &nbsp;No email required</span>
              <span>✓ &nbsp;Dyslexia-friendly</span>
            </div>
          </div>

          {/* Mock dialogue card */}
          <div className="fade-in-up" style={{ animationDelay: '0.12s' }}>
            <DialoguePreview />
          </div>
        </section>

        {/* Pillars */}
        <section style={{ marginTop: 120 }}>
          <div className="eyebrow" style={{ marginBottom: 18 }}>What makes it different</div>
          <h2 className="display" style={{ fontSize: 'clamp(32px, 3.6vw, 44px)', margin: '0 0 48px', maxWidth: '24ch' }}>
            Three principles. <em>One</em> very stubborn AI.
          </h2>

          <div className="stagger r-cols-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            <PillarCard
              num="01"
              title="Socratic, by default"
              body="Questions, not answers. Roleplay tricks, 'just verify this', emotional pressure — none of it works."
            />
            <PillarCard
              num="02"
              title="Personalized"
              body="Pulls analogies from your interests. A gamer learning cell respiration hears about energy economies."
            />
            <PillarCard
              num="03"
              title="Two modes"
              body="Tutor for guided learning. Research for going deep on a topic with cited sources."
            />
          </div>
        </section>

        {/* Modes preview */}
        <section className="r-cols-1" style={{ marginTop: 120, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <ModePreviewCard
            kind="tutor"
            label="Tutor mode"
            line="“What do you already know about photosynthesis?”"
            sub="Guided · Socratic · Direct teaching styles"
          />
          <ModePreviewCard
            kind="research"
            label="Research mode"
            line="Deep-research with cited sources, written for your grade."
            sub="~20–25s · 1 per day · web search included"
          />
        </section>

        {/* Quote */}
        <section style={{ marginTop: 140, padding: '60px 0', textAlign: 'center', position: 'relative' }}>
          <span className="q-glyph r-quote-glyph" style={{ fontSize: 180, position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', opacity: 0.12 }}>&ldquo;</span>
          <blockquote style={{ position: 'relative' }}>
            <p className="display" style={{
              fontSize: 'clamp(28px, 3.4vw, 42px)', lineHeight: 1.25,
              margin: '0 auto', maxWidth: '22ch',
            }}>
              <em>I cannot teach anybody anything. I can only make them think.</em>
            </p>
            <footer className="eyebrow" style={{ marginTop: 18 }}>— Socrates, allegedly</footer>
          </blockquote>
        </section>
      </main>

      <FooterFineprint />
    </div>
  );
}

function PillarCard({ num, title, body }) {
  return (
    <div className="card-lg" style={{ padding: 32 }}>
      <div className="mono" style={{ fontSize: 12, color: 'var(--accent-ink)', marginBottom: 36, letterSpacing: '0.1em' }}>{num}</div>
      <h3 className="display" style={{ fontSize: 26, margin: '0 0 12px' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)' }}>{body}</p>
    </div>
  );
}

function ModePreviewCard({ kind, label, line, sub }) {
  const isResearch = kind === 'research';
  return (
    <div className="card-lg" style={{
      padding: 32, position: 'relative', overflow: 'hidden',
      background: isResearch ? 'var(--accent-softer)' : 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: 'var(--accent)',
        }} />
        <span className="eyebrow">{label}</span>
      </div>
      <p style={{
        fontFamily: isResearch ? 'var(--font-display)' : 'var(--font-emph)',
        fontStyle: isResearch ? 'normal' : 'italic',
        fontWeight: isResearch ? 500 : 400,
        fontSize: 28, lineHeight: 1.25, margin: '0 0 24px', color: 'var(--text)',
      }}>
        {line}
      </p>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

/* Mock chat snippet for hero — pure visual, not interactive */
function DialoguePreview() {
  return (
    <div className="card-lg r-dialogue-preview" style={{ padding: 24, position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14,
        borderBottom: '1px solid var(--border)', marginBottom: 18,
      }}>
        <SparkMark size={20} style={{ color: 'var(--accent)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>Biology · Tutor</span>
        <span style={{ marginLeft: 'auto', fontSize: 11 }} className="mono text-muted">10th grade</span>
      </div>

      {/* student msg */}
      <div style={{
        background: 'var(--accent-soft)', borderRadius: 14, padding: '12px 14px',
        marginBottom: 14, fontSize: 14.5, lineHeight: 1.45,
        maxWidth: '85%', marginLeft: 'auto',
      }}>
        Why does my body break down sugar?
      </div>

      {/* tutor msg with quote glyph */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <span className="q-glyph" style={{ fontSize: 56, marginTop: -8, flexShrink: 0 }}>&ldquo;</span>
        <p style={{
          margin: 0, fontFamily: 'var(--font-emph)', fontStyle: 'italic',
          fontSize: 19, lineHeight: 1.4, color: 'var(--text)',
        }}>
          Good — start broad. When you play a long match of your favorite game and your hands get tired, where do you think that fatigue is actually coming from?
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        <span className="chip" style={{ fontSize: 12, padding: '5px 10px' }}>Hint, please</span>
        <span className="chip" style={{ fontSize: 12, padding: '5px 10px' }}>I'm stuck</span>
        <span className="chip" style={{ fontSize: 12, padding: '5px 10px' }}>Go simpler</span>
      </div>
    </div>
  );
}

/* ===========================================================
   AUTH
   =========================================================== */
function Auth({ onBack, onSuccess, settingsProps, variant }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'verify'
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (mode === 'signup') {
      if (!firstName || firstName.trim().length < 2) {
        setError('Please enter a first name (2+ characters).'); return;
      }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: authErr } = await authSignUp({ email: email.trim(), password, firstName: firstName.trim() });
        if (authErr) { setError(authErr.message); return; }
        if (data?.session) {
          // Email confirmation is disabled (e.g. dev env) — session is live immediately.
          onSuccess('signup');
        } else {
          // Supabase sent a confirmation email; wait for the user to click it.
          setMode('verify');
          setResendIn(60);
        }
      } else {
        const { error: authErr } = await authSignIn({ email: email.trim(), password });
        if (authErr) { setError(authErr.message); return; }
        onSuccess('signin');
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || resendBusy) return;
    setResendBusy(true);
    setError('');
    try {
      const { error: resendErr } = await authResend({ email: email.trim() });
      if (resendErr) {
        setError(resendErr.message);
      } else {
        setResendIn(60);
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setResendBusy(false);
    }
  };

  if (mode === 'verify') {
    return (
      <div className="bg-paper grain" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopNav variant={variant} right={<SettingsCluster {...settingsProps} compact />} />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div className="card-lg fade-in-up" style={{ maxWidth: 460, width: '100%', padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 20, lineHeight: 1 }}>✉️</div>
            <h1 className="display" style={{ fontSize: 'clamp(26px, 3vw, 34px)', margin: '0 0 14px', lineHeight: 1.1 }}>
              Check your inbox
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 28px' }}>
              We sent a verification link to{' '}
              <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              <br />Click it to activate your account and continue.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
              Didn't get it? Check your spam folder, or{' '}
              <button
                onClick={handleResend}
                disabled={resendIn > 0 || resendBusy}
                className="btn btn-bare btn-sm"
                style={{ padding: '0 2px', fontSize: 13, display: 'inline', verticalAlign: 'baseline' }}
              >
                {resendBusy ? 'Sending…' : resendIn > 0 ? `resend in ${resendIn}s` : 'resend'}
              </button>.
            </p>
            {error && (
              <div style={{
                background: 'oklch(0.95 0.04 25)', color: 'var(--danger)',
                padding: '10px 12px', borderRadius: 10, fontSize: 13, marginBottom: 16,
              }}>{error}</div>
            )}
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); }}
              className="btn btn-bare btn-sm"
              style={{ paddingLeft: 0 }}
            >
              ← Back to sign in
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-paper grain" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <TopNav
        variant={variant}
        right={<SettingsCluster {...settingsProps} compact />}
      />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div className="r-cols-1 r-auth-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, maxWidth: 920, width: '100%', alignItems: 'center' }}>

          {/* Editorial side */}
          <div className="fade-in-up r-auth-side" style={{ paddingRight: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 18 }}>
              {mode === 'signin' ? 'Welcome back' : 'New here'}
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)', margin: '0 0 18px', lineHeight: 1.05 }}>
              {mode === 'signin' ? (
                <>Pick up <em>where</em> you left off.</>
              ) : (
                <>A tutor that <em>actually</em> teaches.</>
              )}
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5, margin: 0, maxWidth: '36ch' }}>
              {mode === 'signin'
                ? 'Sign in with the email you used last time.'
                : 'Quick email + password. We use it for recovery, that\'s it.'}
            </p>
          </div>

          <form onSubmit={submit} className="card-lg r-card fade-in-up" style={{ padding: 32, animationDelay: '0.08s' }}>
            <button type="button" onClick={onBack} className="btn btn-bare btn-sm" style={{ marginBottom: 14, paddingLeft: 0 }}>
              ← Back
            </button>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              <div className="seg" style={{ width: '100%' }}>
                <button type="button" onClick={() => setMode('signin')} className={mode === 'signin' ? 'is-active' : ''} style={{ flex: 1 }}>Sign in</button>
                <button type="button" onClick={() => setMode('signup')} className={mode === 'signup' ? 'is-active' : ''} style={{ flex: 1 }}>Create account</button>
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <label style={labelStyle}>First name</label>
                <input className="field" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus autoComplete="given-name" placeholder="Alex" style={{ marginBottom: 14 }} />
              </>
            )}

            <label style={labelStyle}>Email</label>
            <input type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} autoFocus={mode === 'signin'} autoComplete="email" placeholder="you@example.com" style={{ marginBottom: 14 }} />

            <label style={labelStyle}>Password</label>
            <input type="password" className="field" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="••••••••" style={{ marginBottom: 14 }} />


            {error && (
              <div style={{
                background: 'oklch(0.95 0.04 25)', color: 'var(--danger)',
                padding: '10px 12px', borderRadius: 10, fontSize: 13, marginBottom: 12,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn btn-accent btn-lg" style={{ width: '100%' }}>
              {loading ? 'Working…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </button>

            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', margin: '14px 0 0' }}>
              By continuing you agree to our <a href="#" style={{ color: 'var(--accent-ink)' }}>Terms</a> and <a href="#" style={{ color: 'var(--accent-ink)' }}>Privacy Policy</a>.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' };

/* ===========================================================
   ONBOARDING (5 steps)
   =========================================================== */
const INTERESTS = ['Gaming','Music','Sports','Tech','Art','Movies','Reading','Outdoors','Cooking','Fashion','Animals','Cars'];
const STRENGTHS = ['Math','Writing','Science','History','Languages','Art','Coding','Memorization','Problem-solving','Public speaking'];
const GRADES = ['Middle School','9th Grade','10th Grade','11th Grade','12th Grade','College','Adult Learner'];
const ONBOARDING_TEACHING_STYLES = [
  { id: 'guided',   label: 'Guided',   blurb: 'Mostly questions, with explanations when I need them. A good default.' },
  { id: 'socratic', label: 'Socratic', blurb: 'Pure questions — never gives the answer. Pushes me to figure it out.' },
  { id: 'direct',   label: 'Direct',   blurb: 'Teach me clearly and fully — but don\'t do my homework for me.' },
  { id: 'teacher',  label: 'Teacher',  blurb: 'Teach the subject from scratch. Assume I know nothing and build it up.' },
];

function Onboarding({ onDone, settingsProps, variant }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    first_name: '',
    grade_level: '',
    interests: [],
    strengths: [],
    teaching_style: '',
    experiences: '',
  });

  const steps = [
    { key: 'name', title: 'What should we call you?', subtitle: 'Just a first name. Last name is optional and we don\'t ask for it.',
      render: () => (
        <input
          autoFocus className="field" style={{ fontSize: 18, padding: '14px 16px' }}
          value={data.first_name} onChange={e => setData({ ...data, first_name: e.target.value })}
          placeholder="First name"
        />
      ),
      ok: () => !!data.first_name.trim(),
    },
    { key: 'grade', title: 'What grade are you in?', subtitle: 'We adapt vocabulary and pacing to your level.',
      render: () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GRADES.map(g => (
            <button key={g} type="button"
              className={`chip ${data.grade_level === g ? 'is-selected' : ''}`}
              onClick={() => setData({ ...data, grade_level: g })}
            >{g}</button>
          ))}
        </div>
      ),
      ok: () => !!data.grade_level,
    },
    { key: 'interests', title: 'What are you into?', subtitle: 'Pick a few. We pull analogies from these so things click.',
      render: () => (
        <MultiSelect options={INTERESTS} selected={data.interests} onChange={v => setData({ ...data, interests: v })} />
      ),
      ok: () => data.interests.length > 0,
    },
    { key: 'strengths', title: 'What are you good at?', subtitle: 'Be honest. This sets the pacing.',
      render: () => (
        <MultiSelect options={STRENGTHS} selected={data.strengths} onChange={v => setData({ ...data, strengths: v })} />
      ),
      ok: () => data.strengths.length > 0,
    },
    { key: 'style', title: 'How should I teach you?', subtitle: 'Pick a default teaching style. You can change it any time from the sidebar.',
      render: () => (
        <div style={{ display: 'grid', gap: 10 }}>
          {ONBOARDING_TEACHING_STYLES.map(t => {
            const selected = data.teaching_style === t.id;
            return (
              <button key={t.id} type="button"
                onClick={() => setData({ ...data, teaching_style: t.id })}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--border)'),
                  background: selected ? 'var(--accent-soft)' : 'var(--surface)',
                  color: selected ? 'var(--accent-ink)' : 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  fontFamily: 'inherit',
                }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</span>
                <span style={{ fontSize: 13, color: selected ? 'var(--accent-ink)' : 'var(--text-2)', opacity: selected ? 0.85 : 1 }}>{t.blurb}</span>
              </button>
            );
          })}
        </div>
      ),
      ok: () => !!data.teaching_style,
    },
    { key: 'experiences', title: 'Anything else you\'ve done?', subtitle: 'Classes you\'ve taken, things you\'re learning, side projects. Optional.',
      render: () => (
        <textarea className="field" style={{ minHeight: 130 }}
          value={data.experiences} onChange={e => setData({ ...data, experiences: e.target.value })}
          placeholder="took AP Bio, learning guitar, run a small business…"
        />
      ),
      ok: () => true,
    },
  ];

  const cur = steps[step];
  const pct = ((step + 1) / steps.length) * 100;
  const finish = () => {
    try {
      const prev = JSON.parse(localStorage.getItem('socrify_prefs') || '{}');
      const nextPrefs = { ...prev };
      if (data.teaching_style) nextPrefs.teachingStyle = data.teaching_style;
      localStorage.setItem('socrify_prefs', JSON.stringify(nextPrefs));
    } catch {}
    onDone();
  };
  const next = () => { if (!cur.ok()) return; if (step < steps.length - 1) setStep(step + 1); else finish(); };
  const back = () => step > 0 && setStep(step - 1);

  return (
    <div className="bg-paper grain" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <TopNav variant={variant} right={<SettingsCluster {...settingsProps} compact />} />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 640, width: '100%' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow">Step {step + 1} of {steps.length}</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Math.round(pct)}%</div>
          </div>
          <div style={{
            height: 3, background: 'var(--surface-3)', borderRadius: 3,
            overflow: 'hidden', marginBottom: 36,
          }}>
            <div style={{
              height: '100%', width: `${pct}%`, background: 'var(--accent)',
              transition: 'width .35s cubic-bezier(.2,.7,.2,1)',
            }} />
          </div>

          <div className="card-lg r-onboard-card fade-in" key={cur.key} style={{ padding: 36 }}>
            <h2 className="display" style={{ fontSize: 'clamp(28px, 3vw, 38px)', margin: '0 0 8px', lineHeight: 1.1 }}>
              {cur.title}
            </h2>
            {cur.subtitle && <p style={{ fontSize: 15, color: 'var(--text-2)', margin: '0 0 28px' }}>{cur.subtitle}</p>}

            <div>{cur.render()}</div>

            <div className="r-onboard-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36 }}>
              <button onClick={back} className="btn btn-bare" disabled={step === 0}>← Back</button>
              <div className="r-onboard-right" style={{ display: 'flex', gap: 10 }}>
                {!cur.ok() && step < steps.length - 1 && (
                  <span style={{ fontSize: 12, color: 'var(--text-faint)', alignSelf: 'center' }}>Pick at least one to continue</span>
                )}
                <button onClick={next} className="btn btn-accent btn-lg" disabled={!cur.ok()}>
                  {step === steps.length - 1 ? 'Finish' : 'Next →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MultiSelect({ options, selected, onChange }) {
  const toggle = (o) => selected.includes(o) ? onChange(selected.filter(s => s !== o)) : onChange([...selected, o]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`chip ${selected.includes(o) ? 'is-selected' : ''}`}
        >{o}</button>
      ))}
    </div>
  );
}

/* ===========================================================
   SETTINGS CLUSTER (theme, dyslexic, etc) — shared
   =========================================================== */
function SettingsCluster({ theme, setTheme, dyslexic, setDyslexic, fontSize, setFontSize, reduceMotion, setReduceMotion, onLogout, isGuest, onGuestExit, compact }) {
  return (
    <SettingsButton
      settingsProps={{ theme, setTheme, dyslexic, setDyslexic }}
      fontSize={fontSize}
      setFontSize={setFontSize}
      reduceMotion={reduceMotion}
      setReduceMotion={setReduceMotion}
    />
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 11.5A6.5 6.5 0 0 1 8.5 4a.5.5 0 0 0-.7-.5A7 7 0 1 0 16.5 12.2a.5.5 0 0 0-.5-.7z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 1.5v2M10 16.5v2M3.5 10h-2M18.5 10h-2M4.7 4.7L3.3 3.3M16.7 16.7l-1.4-1.4M4.7 15.3l-1.4 1.4M16.7 3.3l-1.4 1.4" />
    </svg>
  );
}

Object.assign(window, {
  Landing, Auth, Onboarding, SettingsCluster, MoonIcon, SunIcon, TopNav,
});
