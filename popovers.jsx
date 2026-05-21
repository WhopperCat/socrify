/* =========================================================
   Socrify · Popovers — Settings + Account
   ========================================================= */

/* ── popover shell — portal + position:fixed, auto-flips above/below trigger ── */
function Popover({ open, onClose, anchor = 'auto', width = 320, triggerRef, children }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const compute = () => {
      const trigger = triggerRef?.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const gap = 8, margin = 12;
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;

      // Decide vertical direction.
      // 'up'   => prefer opening above the trigger (e.g. sidebar footer)
      // 'down' => prefer opening below (e.g. top-bar buttons)
      // 'auto' => use whichever side has more room
      let openUp;
      if (anchor === 'up' || anchor === 'bottomRight') openUp = spaceAbove > 200 || spaceAbove > spaceBelow;
      else if (anchor === 'down' || anchor === 'right' || anchor === 'rightTop') openUp = false;
      else openUp = spaceAbove > spaceBelow;

      // Horizontal: align to trigger edge that keeps the popover on-screen.
      // If trigger sits on the left half of the screen, left-align; otherwise right-align.
      const triggerCenter = (rect.left + rect.right) / 2;
      let left;
      if (triggerCenter < vw / 2) {
        left = Math.max(margin, Math.min(vw - width - margin, rect.left));
      } else {
        left = Math.max(margin, Math.min(vw - width - margin, rect.right - width));
      }

      if (openUp) {
        setPos({
          left,
          bottom: Math.max(margin, vh - rect.top + gap),
          maxHeight: Math.max(200, spaceAbove - gap - margin),
        });
      } else {
        setPos({
          left,
          top: Math.max(margin, rect.bottom + gap),
          maxHeight: Math.max(200, spaceBelow - gap - margin),
        });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, anchor, width, triggerRef]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const insidePopover = ref.current && ref.current.contains(e.target);
      const insideTrigger = triggerRef?.current && triggerRef.current.contains(e.target);
      if (!insidePopover && !insideTrigger) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open || !pos) return null;

  return ReactDOM.createPortal(
    <div ref={ref} style={{
      position: 'fixed', zIndex: 1000, width,
      ...pos,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: 'var(--shadow-lg)',
      overflowY: 'auto', color: 'var(--text)',
      animation: 'fadeInUp .18s cubic-bezier(.2,.7,.2,1)',
    }} className="scroll-thin">
      {children}
    </div>,
    document.body
  );
}

function PopoverHeader({ title, subtitle, right }) {
  return (
    <div style={{
      padding: '14px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      background: 'var(--surface-2)',
    }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function PopoverSection({ label, children, hint }) {
  return (
    <div style={{ padding: '12px 16px' }}>
      {label && <div className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>{label}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{hint}</div>}
    </div>
  );
}

function PopoverDivider() {
  return <div style={{ height: 1, background: 'var(--border)' }} />;
}

/* A clickable row */
function PopoverItem({ icon, label, hint, kbd, right, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent',
      cursor: 'pointer', textAlign: 'left',
      color: danger ? 'var(--danger)' : 'var(--text)',
      fontFamily: 'var(--font-sans)', fontSize: 13.5,
      transition: 'background .12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {icon && <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-muted)' }}>{icon}</span>}
      <span style={{ flex: 1 }}>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</span>}
      </span>
      {kbd && <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{kbd}</span>}
      {right}
    </button>
  );
}

/* Toggle row (for settings) */
function ToggleRow({ icon, label, hint, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent',
      cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
      fontFamily: 'var(--font-sans)', fontSize: 13.5,
      transition: 'background .12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {icon && <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-muted)' }}>{icon}</span>}
      <span style={{ flex: 1 }}>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</span>}
      </span>
      <Switch on={value} />
    </button>
  );
}

function Switch({ on }) {
  return (
    <span style={{
      width: 32, height: 18, borderRadius: 999,
      background: on ? 'var(--accent)' : 'var(--border-strong)',
      position: 'relative', flexShrink: 0,
      transition: 'background .15s ease',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: 999, background: 'white',
        transition: 'left .15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </span>
  );
}

/* ── Settings popover ── */
function SettingsPopover({ open, onClose, settingsProps, fontSize, setFontSize, reduceMotion, setReduceMotion, triggerRef }) {
  const { theme, setTheme, dyslexic, setDyslexic } = settingsProps;
  return (
    <Popover open={open} onClose={onClose} width={300} anchor="down" triggerRef={triggerRef}>
      <PopoverHeader title="Settings" subtitle="Display & accessibility" />

      <PopoverSection label="Appearance">
        <ThemePicker value={theme} onChange={setTheme} />
      </PopoverSection>

      <PopoverSection label={<span>Accent color <ProTag /></span>}>
        <AccentSwatches />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          5 extra accent themes unlock with Socrify Pro.
        </div>
      </PopoverSection>

      <PopoverDivider />

      <PopoverSection label="Accessibility">
        <ToggleRow
          icon={<IconDx />}
          label="Dyslexia-friendly font"
          hint="Switches to OpenDyslexic"
          value={dyslexic}
          onChange={setDyslexic}
        />
        <ToggleRow
          icon={<IconMotion />}
          label="Reduce motion"
          hint="Disable transitions"
          value={!!reduceMotion}
          onChange={setReduceMotion}
        />
        <div style={{ padding: '6px 10px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Text size</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fontSize}%</span>
          </div>
          <input type="range" min="85" max="130" step="5" value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>
      </PopoverSection>

      <PopoverDivider />

      <PopoverSection>
        <PopoverItem icon={<IconKbd />} label="Keyboard shortcuts" kbd="?" />
        <PopoverItem icon={<IconInfo />} label="What's new" />
      </PopoverSection>
    </Popover>
  );
}

/* ── Pro tag ── */
function ProTag() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      marginLeft: 8, padding: '2px 6px', borderRadius: 4,
      background: 'linear-gradient(135deg, var(--accent), oklch(0.60 0.18 calc(var(--accent-hue) + 30)))',
      color: 'white',
      fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase',
      lineHeight: 1,
    }}>PRO</span>
  );
}

/* ── Accent swatches (5 locked + 1 free) ── */
function AccentSwatches() {
  const themes = [
    { name: 'Blue',   h: 255, free: true },
    { name: 'Violet', h: 295, free: false },
    { name: 'Teal',   h: 195, free: false },
    { name: 'Sage',   h: 155, free: false },
    { name: 'Plum',   h: 335, free: false },
    { name: 'Amber', h: 60,  free: false },
  ];
  const [active] = React.useState(255);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
      {themes.map(t => {
        const isActive = t.h === active && t.free;
        const locked = !t.free;
        return (
          <button key={t.name} disabled={locked} title={locked ? `${t.name} — Pro` : t.name} style={{
            padding: 6, borderRadius: 8, cursor: locked ? 'not-allowed' : 'pointer',
            border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
            background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
            opacity: locked ? 0.55 : 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            position: 'relative', transition: 'all .12s ease',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 999,
              background: `oklch(0.55 0.18 ${t.h})`,
              boxShadow: isActive ? '0 0 0 2px var(--surface)' : 'none',
              outline: isActive ? '2px solid var(--accent)' : 'none',
              filter: locked ? 'grayscale(0.3)' : 'none',
              position: 'relative',
            }}>
              {locked && (
                <svg width="10" height="10" viewBox="0 0 10 10" style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'white',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
                }} fill="currentColor">
                  <path d="M3 4.2V3a2 2 0 0 1 4 0v1.2h.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-3H3zm.8 0h2.4V3a1.2 1.2 0 0 0-2.4 0v1.2z" />
                </svg>
              )}
            </span>
            <span style={{
              fontSize: 9.5, fontWeight: 500,
              color: isActive ? 'var(--accent-ink)' : 'var(--text-2)',
              fontFamily: 'var(--font-sans)',
            }}>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Theme picker (3 cards in a row) ── */
function ThemePicker({ value, onChange }) {
  const opts = [
    { id: 'light', label: 'Light', preview: 'light' },
    { id: 'dark',  label: 'Dark',  preview: 'dark' },
    { id: 'auto',  label: 'Auto',  preview: 'split' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {opts.map(o => {
        const isActive = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id === 'auto' ? 'light' : o.id)} style={{
            padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
            border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
            borderRadius: 8, cursor: 'pointer', transition: 'all .12s',
            color: isActive ? 'var(--accent-ink)' : 'var(--text)',
            fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 500,
          }}>
            <ThemeChip kind={o.preview} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ThemeChip({ kind }) {
  if (kind === 'split') {
    return (
      <span style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', width: 44, height: 24, border: '1px solid var(--border-2)' }}>
        <span style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: 'oklch(0.22 0.02 270)' }} />
        </span>
        <span style={{ flex: 1, background: 'oklch(0.16 0.01 265)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: '#fff' }} />
        </span>
      </span>
    );
  }
  const isDark = kind === 'dark';
  return (
    <span style={{
      width: 44, height: 24, borderRadius: 6, border: '1px solid var(--border-2)',
      background: isDark ? 'oklch(0.16 0.01 265)' : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        width: 12, height: 4, borderRadius: 999,
        background: isDark ? 'oklch(0.85 0.01 90)' : 'oklch(0.22 0.02 270)',
      }} />
    </span>
  );
}

/* ── Account popover ── */
function AccountPopover({ open, onClose, profile, isGuest, onLogout, onUpgrade, onOpenScreen, notificationsOn, setNotificationsOn, triggerRef, anchor = 'auto' }) {
  const name = isGuest ? 'Guest session' : (profile?.first_name || 'Alex');
  const handle = isGuest ? '@guest' : (profile?.first_name ? `@${profile.first_name.toLowerCase()}` : '@alex');
  const go = (screen) => { onClose(); onOpenScreen(screen); };
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} width={320} triggerRef={triggerRef}>
      {/* Profile header */}
      <div style={{
        padding: 18,
        background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 999,
          background: 'var(--accent)', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
          flexShrink: 0,
        }}>{name.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{handle}</div>
        </div>
      </div>

      {/* Plan */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{
          padding: 14, borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div className="eyebrow" style={{ fontSize: 10 }}>Current plan</div>
              <div style={{ fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 500, marginTop: 2 }}>Free</div>
            </div>
            <button onClick={onUpgrade} className="btn btn-accent btn-sm">Upgrade</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <UsageBar label="Tutor sessions" used={47} cap="∞" />
            <UsageBar label="Research / day" used={0} cap={1} />
          </div>
        </div>
      </div>

      <PopoverDivider />

      <PopoverSection>
        <PopoverItem icon={<IconUser />}      label="Profile & learning preferences" onClick={() => go('prefs')} />
        <PopoverItem
          icon={<IconBell />}
          label="Notifications"
          right={<Switch on={notificationsOn} />}
          onClick={() => setNotificationsOn(!notificationsOn)}
        />
        <PopoverItem icon={<IconShield />}    label="Privacy & data"      onClick={() => go('privacy')} />
        <PopoverItem icon={<IconDownload />}  label="Export chat history" onClick={() => go('export')} />
      </PopoverSection>

      <PopoverDivider />

      <PopoverSection>
        <PopoverItem icon={<IconCard />}      label="Billing & subscription" onClick={() => go('soon-billing')} />
        <PopoverItem icon={<IconGift />}      label="Refer a friend"         hint="Earn 1 free research / week" onClick={() => go('soon-refer')} />
        <PopoverItem icon={<IconHelp />}      label="Help & support"         onClick={() => go('soon-help')} />
        <PopoverItem icon={<IconBook />}      label="Methods & sources"      hint="How Socrify teaches" onClick={() => go('soon-methods')} />
      </PopoverSection>

      <PopoverDivider />

      <PopoverSection>
        {!isGuest ? (
          <PopoverItem icon={<IconLogout />} label="Sign out" onClick={onLogout} danger />
        ) : (
          <PopoverItem icon={<IconUser />} label="Exit guest session" onClick={onLogout} />
        )}
      </PopoverSection>

      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: 'var(--text-muted)',
      }}>
        <span className="mono">v0.2.0 · BETA</span>
        <a href="#" onClick={(e) => { e.preventDefault(); go('soon-status'); }} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Status</a>
      </div>
    </Popover>
  );
}

/* ── Modal shell (centered dialog) ── */
function Modal({ open, onClose, title, subtitle, children, width = 480 }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeInUp .15s ease',
      }}
    >
      <div
        className="scroll-thin"
        style={{
          width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 32px)',
          background: 'var(--surface)', color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 16,
          boxShadow: 'var(--shadow-lg)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} className="btn btn-bare btn-icon" title="Close" aria-label="Close" style={{ flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><path d="M4 4l12 12M16 4L4 16"/></svg>
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ── Preferences (Profile & learning) ── */
const PREFS_KEY = 'socrify_prefs';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}
function savePrefs(p) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

function PreferencesModal({ open, onClose, profile, isGuest }) {
  const [prefs, setPrefs] = React.useState(() => loadPrefs());
  const [name, setName] = React.useState(() => loadPrefs().displayName || profile?.first_name || (isGuest ? 'Guest' : ''));

  React.useEffect(() => { if (open) { setPrefs(loadPrefs()); setName(loadPrefs().displayName || profile?.first_name || (isGuest ? 'Guest' : '')); } }, [open]);

  const update = (patch) => setPrefs(p => ({ ...p, ...patch }));
  const onSave = () => {
    savePrefs({ ...prefs, displayName: name });
    onClose();
  };

  const difficulty = prefs.difficulty || 'Standard';
  const style = prefs.teachingStyle || 'guided';

  return (
    <Modal open={open} onClose={onClose} title="Profile & learning preferences" subtitle="Defaults applied to new sessions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isGuest}
            placeholder={isGuest ? 'Sign in to set a name' : 'Your name'}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-sans)',
              opacity: isGuest ? 0.55 : 1,
            }}
          />
          {isGuest && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>Guest sessions use a temporary identity.</div>}
        </div>

        <div>
          <label className="eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 8 }}>Default difficulty</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {['Easier', 'Standard', 'Challenging'].map(d => {
              const active = difficulty === d;
              return (
                <button key={d} onClick={() => update({ difficulty: d })} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                  color: active ? 'var(--accent-ink)' : 'var(--text-2)',
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}>{d}</button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 8 }}>Default teaching style</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id: 'guided',   label: 'Guided',   blurb: 'Mostly questions. Explains when you need it.' },
              { id: 'socratic', label: 'Socratic', blurb: 'Pure questions. Never gives the answer.' },
              { id: 'direct',   label: 'Direct',   blurb: "Teaches normally — but won't do your homework." },
            ].map(o => {
              const active = style === o.id;
              return (
                <button key={o.id} onClick={() => update({ teachingStyle: o.id })} style={{
                  padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                  background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                  color: active ? 'var(--accent-ink)' : 'var(--text-2)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{o.label}</div>
                  <div style={{ fontSize: 11.5, color: active ? 'var(--accent-ink)' : 'var(--text-muted)', marginTop: 2 }}>{o.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={onSave} className="btn btn-accent btn-sm">Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Privacy & data ── */
function PrivacyModal({ open, onClose }) {
  const [cleared, setCleared] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => { if (open) { setCleared(false); setConfirming(false); } }, [open]);

  const clearHistory = () => {
    localStorage.removeItem('socrify_history');
    setCleared(true);
    setConfirming(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Privacy & data" subtitle="What's stored on this device">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
          Socrify stores chat history, learning preferences, and display settings in your browser's local storage. Nothing is uploaded unless you sign in.
        </div>

        <div style={{
          padding: 14, borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Chat history</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Permanently delete every conversation saved on this device.
          </div>
          {cleared ? (
            <div style={{ fontSize: 12.5, color: 'var(--accent-ink)' }}>Chat history cleared.</div>
          ) : confirming ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1 }}>This can't be undone.</span>
              <button onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={clearHistory} className="btn btn-sm" style={{ background: 'var(--danger, #d23)', color: 'white', borderColor: 'var(--danger, #d23)' }}>Delete all</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="btn btn-ghost btn-sm">Clear chat history</button>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          For full account-level data control, sign in and visit account settings.
        </div>
      </div>
    </Modal>
  );
}

/* ── Export chat history ── */
function exportHistoryAsJson() {
  const history = JSON.parse(localStorage.getItem('socrify_history') || '[]');
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url, download: `socrify-history-${Date.now()}.json`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportHistoryAsMarkdown() {
  const history = JSON.parse(localStorage.getItem('socrify_history') || '[]');
  const date = new Date().toLocaleDateString();
  let md = `# Socrify chat history\n\n_Exported ${date} · ${history.length} conversation${history.length === 1 ? '' : 's'}_\n\n---\n\n`;
  history.forEach((conv, i) => {
    md += `## ${conv.title || 'Untitled'}\n`;
    md += `_${conv.mode || 'tutor'} · ${conv.subjectId || 'general'}${conv.difficulty ? ` · ${conv.difficulty}` : ''}${conv.teachingStyle ? ` · ${conv.teachingStyle}` : ''}_\n\n`;
    const msgs = conv.messages || [];
    msgs.forEach(m => {
      const who = m.role === 'student' ? 'You' : 'Socrify';
      md += `**${who}:** ${m.content || ''}\n\n`;
    });
    if (i < history.length - 1) md += `---\n\n`;
  });
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url, download: `socrify-history-${Date.now()}.md`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExportModal({ open, onClose }) {
  const history = React.useMemo(() => {
    if (!open) return [];
    try { return JSON.parse(localStorage.getItem('socrify_history') || '[]'); } catch { return []; }
  }, [open]);
  const count = history.length;
  const empty = count === 0;

  return (
    <Modal open={open} onClose={onClose} title="Export chat history" subtitle={`${count} conversation${count === 1 ? '' : 's'} on this device`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {empty ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No conversations to export yet. Start a session, then come back here.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Download every saved conversation as a single file.
            </div>
            <button onClick={exportHistoryAsMarkdown} className="btn btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Markdown (.md)</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Human-readable. Good for sharing or archiving.</div>
              </div>
            </button>
            <button onClick={exportHistoryAsJson} className="btn btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
              <div>
                <div style={{ fontWeight: 500 }}>JSON (.json)</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Full structured data. Useful for re-import.</div>
              </div>
            </button>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Done</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Stub "coming soon" modal for the rest ── */
const COMING_SOON_COPY = {
  'soon-billing': { title: 'Billing & subscription', body: "Once Socrify Pro launches you'll manage your plan, payment method, and invoices here." },
  'soon-refer':   { title: 'Refer a friend', body: 'Earn 1 free research / week for every friend who signs up. Referral codes roll out with the Pro launch.' },
  'soon-help':    { title: 'Help & support', body: 'For now, please reach out at hello@socrify.app. A full help center is on the way.' },
  'soon-methods': { title: 'Methods & sources', body: "Socrify teaches with the Socratic method — guiding through questions rather than handing over answers. A deeper write-up is coming soon." },
  'soon-status':  { title: 'System status', body: 'All systems operational. A live status page is on the way.' },
};
function ComingSoonModal({ open, onClose, screen }) {
  const copy = COMING_SOON_COPY[screen];
  if (!copy) return null;
  return (
    <Modal open={open} onClose={onClose} title={copy.title}>
      <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>{copy.body}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
      </div>
    </Modal>
  );
}

function UsageBar({ label, used, cap }) {
  const pct = cap === '∞' ? 12 : Math.min(100, (used / cap) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-2)', marginBottom: 4 }}>
        <span>{label}</span>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>{used} / {cap}</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: cap === '∞' ? 'var(--accent)' : (used >= cap ? 'var(--warning)' : 'var(--accent)'),
        }} />
      </div>
    </div>
  );
}

/* ── tiny icons (stroke, inherit color) ── */
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
function IconGear() {
  return (<svg width="16" height="16" viewBox="0 0 20 20" {...stroke}><circle cx="10" cy="10" r="2.6"/><path d="M10 1.5v2M10 16.5v2M3.5 10h-2M18.5 10h-2M4.7 4.7L3.3 3.3M16.7 16.7l-1.4-1.4M4.7 15.3l-1.4 1.4M16.7 3.3l-1.4 1.4"/></svg>);
}
function IconUser() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c1-3.5 3.7-5 6.5-5s5.5 1.5 6.5 5"/></svg>);
}
function IconBell() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13L5 14z"/><path d="M8.5 17.5a1.5 1.5 0 0 0 3 0"/></svg>);
}
function IconShield() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><path d="M10 2.5l6 2v5c0 4-2.7 7.2-6 8-3.3-.8-6-4-6-8v-5l6-2z"/></svg>);
}
function IconDownload() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5"/><path d="M3.5 14v2.5h13V14"/></svg>);
}
function IconCard() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 8.5h15"/></svg>);
}
function IconGift() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><rect x="2.5" y="8" width="15" height="9" rx="1"/><path d="M10 8v9M2.5 12h15"/><path d="M7 8c-1.5 0-2.5-1-2.5-2.2C4.5 4.5 6 4 7 4.5c1.5.7 3 3.5 3 3.5s-1.5 0-3 0z"/><path d="M13 8c1.5 0 2.5-1 2.5-2.2C15.5 4.5 14 4 13 4.5c-1.5.7-3 3.5-3 3.5s1.5 0 3 0z"/></svg>);
}
function IconHelp() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><circle cx="10" cy="10" r="7.5"/><path d="M7.5 7.8c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5-1.5 2-2.5 2.5V12"/><circle cx="10" cy="14.5" r="0.6" fill="currentColor"/></svg>);
}
function IconBook() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><path d="M3.5 4.5h4.5c1.5 0 2 1 2 2v11c0-1-0.5-2-2-2H3.5v-11z"/><path d="M16.5 4.5H12c-1.5 0-2 1-2 2v11c0-1 0.5-2 2-2h4.5v-11z"/></svg>);
}
function IconLogout() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><path d="M9 4.5H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4"/><path d="M13 7l3 3-3 3M16 10H8"/></svg>);
}
function IconDx() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><text x="10" y="14" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">Dx</text></svg>);
}
function IconMotion() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><circle cx="10" cy="10" r="5"/><path d="M2 10c1.5-1 3-1 5 0M13 10c2-1 3.5-1 5 0"/></svg>);
}
function IconKbd() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><rect x="2.5" y="6" width="15" height="9" rx="1.5"/><path d="M5.5 9.2v0M8 9.2v0M10.5 9.2v0M13 9.2v0M15.5 9.2v0M6 12.5h8"/></svg>);
}
function IconInfo() {
  return (<svg width="14" height="14" viewBox="0 0 20 20" {...stroke}><circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.2v0"/></svg>);
}

Object.assign(window, {
  Popover, PopoverHeader, PopoverSection, PopoverDivider, PopoverItem, ToggleRow, Switch,
  SettingsPopover, AccountPopover, IconGear,
  SettingsButton, AccountButton,
});

/* ── Trigger button wrappers ── */
function SettingsButton({ settingsProps, fontSize, setFontSize, reduceMotion, setReduceMotion }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef(null);
  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={`btn btn-bare btn-icon`}
        title="Settings"
        style={{
          background: open ? 'var(--surface-2)' : 'transparent',
          color: 'var(--text)',
        }}
      >
        <IconGear />
      </button>
      <SettingsPopover
        open={open}
        onClose={() => setOpen(false)}
        settingsProps={settingsProps}
        fontSize={fontSize}
        setFontSize={setFontSize}
        reduceMotion={reduceMotion}
        setReduceMotion={setReduceMotion}
        triggerRef={triggerRef}
      />
    </>
  );
}

const NOTIFICATIONS_KEY = 'socrify_notifications';
function loadNotificationsEnabled() {
  const v = localStorage.getItem(NOTIFICATIONS_KEY);
  return v === null ? true : v === '1';
}

function AccountButton({ profile, isGuest, onLogout, onUpgrade, compact }) {
  const [open, setOpen] = React.useState(false);
  const [screen, setScreen] = React.useState(null);
  const [notificationsOn, setNotificationsOnState] = React.useState(loadNotificationsEnabled);
  const triggerRef = React.useRef(null);
  const name = isGuest ? 'Guest' : (profile?.first_name || 'Alex');
  const initial = name.charAt(0).toUpperCase();

  const setNotificationsOn = (v) => {
    setNotificationsOnState(v);
    localStorage.setItem(NOTIFICATIONS_KEY, v ? '1' : '0');
    if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch {}
    }
  };

  const screens = (
    <>
      <PreferencesModal open={screen === 'prefs'} onClose={() => setScreen(null)} profile={profile} isGuest={isGuest} />
      <PrivacyModal open={screen === 'privacy'} onClose={() => setScreen(null)} />
      <ExportModal open={screen === 'export'} onClose={() => setScreen(null)} />
      <ComingSoonModal open={!!screen && screen.startsWith('soon-')} onClose={() => setScreen(null)} screen={screen} />
    </>
  );

  const popover = (
    <AccountPopover
      open={open}
      onClose={() => setOpen(false)}
      profile={profile}
      isGuest={isGuest}
      onLogout={onLogout}
      onUpgrade={onUpgrade}
      onOpenScreen={setScreen}
      notificationsOn={notificationsOn}
      setNotificationsOn={setNotificationsOn}
      triggerRef={triggerRef}
      anchor={compact ? 'down' : 'up'}
    />
  );

  if (compact) {
    return (
      <>
        <button ref={triggerRef} onClick={() => setOpen(o => !o)} style={{
          width: 32, height: 32, borderRadius: 999,
          background: 'var(--accent)', color: 'white',
          border: '1px solid var(--accent)',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{initial}</button>
        {popover}
        {screens}
      </>
    );
  }
  // sidebar-footer expanded form
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 10, border: '1px solid transparent',
        background: open ? 'var(--surface-2)' : 'transparent',
        cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
        fontFamily: 'var(--font-sans)', transition: 'background .12s',
      }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--surface-2)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: 30, height: 30, borderRadius: 999,
          background: 'var(--accent)', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600, flexShrink: 0,
        }}>{initial}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isGuest ? 'Guest session' : name}
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>Free plan</span>
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>⋯</span>
      </button>
      {popover}
      {screens}
    </>
  );
}
