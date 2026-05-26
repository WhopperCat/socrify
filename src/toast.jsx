/* =========================================================
   Socrify · Toast notifications
   Lightweight queue + portal host. Exposes window.toast.
   ========================================================= */

(function () {
  const listeners = new Set();
  let nextId = 1;
  let toasts = [];

  function emit() { listeners.forEach(fn => fn(toasts)); }

  function show({ title, message, type = 'info', duration } = {}) {
    const id = nextId++;
    const t = {
      id,
      title: title || null,
      message: message || '',
      type, // 'info' | 'success' | 'error' | 'warning'
      duration: duration ?? (type === 'error' ? 7000 : 4500),
    };
    toasts = [...toasts, t];
    emit();
    if (t.duration > 0) setTimeout(() => dismiss(id), t.duration);
    return id;
  }

  function dismiss(id) {
    toasts = toasts.filter(t => t.id !== id);
    emit();
  }

  function subscribe(fn) { listeners.add(fn); fn(toasts); return () => listeners.delete(fn); }

  window.toast = {
    show,
    dismiss,
    info:    (message, opts) => show({ ...opts, message, type: 'info' }),
    success: (message, opts) => show({ ...opts, message, type: 'success' }),
    error:   (message, opts) => show({ ...opts, message, type: 'error' }),
    warning: (message, opts) => show({ ...opts, message, type: 'warning' }),
    _subscribe: subscribe,
  };
})();

function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => window.toast._subscribe(setItems), []);
  if (!items.length) return null;

  const node = (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
        pointerEvents: 'none',
      }}
    >
      {items.map(t => {
        const palette = {
          info:    { bg: 'var(--surface-2)', border: 'var(--border)',  accent: 'var(--accent)',  icon: 'i' },
          success: { bg: 'var(--surface-2)', border: 'var(--border)',  accent: '#16a34a',         icon: '✓' },
          warning: { bg: 'var(--surface-2)', border: 'var(--border)',  accent: '#d97706',         icon: '!' },
          error:   { bg: 'var(--surface-2)', border: 'var(--border)',  accent: '#dc2626',         icon: '✕' },
        }[t.type] || { bg: 'var(--surface-2)', border: 'var(--border)', accent: 'var(--accent)', icon: 'i' };
        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: palette.bg,
              border: `1px solid ${palette.border}`,
              borderLeft: `3px solid ${palette.accent}`,
              boxShadow: 'var(--shadow-lg)',
              fontFamily: 'var(--font-sans)',
              animation: 'fadeInUp .18s ease',
              alignItems: 'flex-start',
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              background: palette.accent, color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
            }}>{palette.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {t.title}
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4, wordWrap: 'break-word' }}>
                {t.message}
              </div>
            </div>
            <button
              onClick={() => window.toast.dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
                padding: 2, marginTop: -2, marginRight: -4,
              }}
            >&times;</button>
          </div>
        );
      })}
    </div>
  );

  return ReactDOM.createPortal(node, document.body);
}

window.ToastHost = ToastHost;
