/* =========================================================
   Socrify · App shell — Dashboard + Session/Chat
   ========================================================= */

const SUBJECTS = [
  { id: 'math',        label: 'Math',              icon: 'M', persona: 'methodical' },
  { id: 'biology',     label: 'Biology',           icon: 'B', persona: 'evidence' },
  { id: 'chemistry',   label: 'Chemistry',         icon: 'C', persona: 'evidence' },
  { id: 'physics',     label: 'Physics',           icon: 'P', persona: 'evidence' },
  { id: 'history',     label: 'History',           icon: 'H', persona: 'narrative' },
  { id: 'geography',   label: 'Geography',         icon: 'G', persona: 'narrative' },
  { id: 'english',     label: 'English & Lit',     icon: 'E', persona: 'narrative' },
  { id: 'cs',          label: 'Computer Science',  icon: '{', persona: 'methodical' },
  { id: 'webdev',      label: 'HTML & JavaScript', icon: '</>', persona: 'methodical' },
  { id: 'essay',       label: 'Essay Writing',     icon: '✎', persona: 'narrative' },
];
const GENERAL = { id: 'general', label: 'General', icon: '◇', persona: 'methodical' };

const TEACHING_STYLES = [
  { id: 'guided',   label: 'Guided',    blurb: 'Mostly questions. Explains when you need it.' },
  { id: 'socratic', label: 'Socratic',  blurb: 'Pure questions. Never gives the answer.' },
  { id: 'direct',   label: 'Direct',    blurb: 'Teaches normally — but won\'t do your homework.' },
  { id: 'teacher',  label: 'Teacher',   blurb: 'Teaches the subject from scratch, like a real class.' },
];
const DIFFICULTIES = ['Easier', 'Standard', 'Challenging'];

/* ===========================================================
   HISTORY — localStorage persistence for guests
   =========================================================== */
const HISTORY_KEY = 'socrify_history';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function formatWhen(isoDate) {
  const now = new Date();
  const d = new Date(isoDate);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${Math.round(diffDays / 7)}w ago`;
}

function deriveTitle(text) {
  const clean = text.trim().replace(/^\[.*?\]\s*/, '');
  return clean.length <= 60 ? (clean || 'Untitled') : clean.slice(0, 57) + '…';
}

/* ===========================================================
   API helpers
   =========================================================== */
function buildSystemPrompt(config, openerText) {
  const { subject, mode, teachingStyle, difficulty } = config;
  const subjectName = subject.label;

  const openerCtx = openerText
    ? `\n\nYou opened this session with: "${openerText}"`
    : '';

  if (mode === 'research') {
    return `You are Socrify in Research mode. You synthesise information accurately and cite your sources.

Subject area: ${subjectName}
Difficulty: ${difficulty}

Guidelines:
- Search for current, reliable sources on the topic
- Present findings in clear sections; use headings when the content warrants it
- Cite sources inline and list them at the end
- Be honest about uncertainty and limitations
- Do not write essay intros or thesis statements unless explicitly asked${openerCtx}`;
  }

  const styleGuide = {
    guided:   'Guide with a mix of questions and brief explanations. Explain when the student is genuinely stuck, but always aim to restore their agency.',
    socratic: 'Use only questions — never give the answer directly. If the student asks for the answer, respond with a question that helps them discover it themselves.',
    direct:   'Teach clearly and explain concepts fully, but never complete assignments for the student.',
    teacher:  'Teach the subject from scratch, as if the student is encountering it for the first time. Start from the foundations and build up systematically: define key terms in plain language, motivate why each idea matters, walk through worked examples, and check understanding with a short question before moving on. Assume zero prior knowledge unless the student says otherwise, and offer to recap or slow down whenever they seem lost.',
  }[teachingStyle] || '';

  const difficultyGuide = {
    'Easier':      'Use simple language and small steps. Assume little prior knowledge and offer plenty of encouragement.',
    'Standard':    'Pitch explanations for a capable student. Not too simple, not overly technical.',
    'Challenging': 'Use precise vocabulary, deeper nuance, and push the student to think rigorously.',
  }[difficulty] || '';

  return `You are Socrify, an AI tutor specialising in ${subjectName}.

Teaching style: ${styleGuide}
Difficulty: ${difficultyGuide}

Rules:
- Keep replies concise — one or two short paragraphs, usually ending with a question
- Never complete the student's work for them
- Give hints when stuck, not full answers
- Stay focused on the subject${openerCtx}`;
}

function buildApiMessages(messages) {
  // API requires conversation to start with a user message.
  // Skip any leading tutor seed and map roles.
  const firstStudentIdx = messages.findIndex(m => m.role === 'student');
  if (firstStudentIdx === -1) return [];
  return messages.slice(firstStudentIdx).map(m => {
    const role = m.role === 'student' ? 'user' : 'assistant';
    if (!m.attachments?.length) return { role, content: m.content };
    // Build multi-part content array for messages with file attachments
    const blocks = [];
    for (const att of m.attachments) {
      if (att.type?.startsWith('image/')) {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: att.type, data: att.data } });
      } else if (att.type === 'application/pdf') {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.data } });
      } else {
        // Plain text / HTML — inline as text
        blocks.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.textContent || ''}` });
      }
    }
    if (m.content) blocks.push({ type: 'text', text: m.content });
    return { role, content: blocks };
  });
}

async function callChatApi(messages, config) {
  const openerText = messages[0]?.role === 'tutor' ? messages[0].content : null;
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: buildApiMessages(messages),
      system: buildSystemPrompt(config, openerText),
      mode: config.mode,
      subject: config.subject.id,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || data.error || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ===========================================================
   FILE ATTACHMENT helpers
   =========================================================== */
const MAX_ATTACH_BYTES = 10 * 1024 * 1024; // 10 MB per file

async function processFiles(fileList) {
  const results = [];
  for (const file of fileList) {
    if (file.size > MAX_ATTACH_BYTES) {
      alert(`"${file.name}" exceeds the 10 MB limit — please try a smaller file.`);
      continue;
    }
    const att = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.onload = e => {
          const dataUrl = e.target.result;
          resolve({
            name: file.name,
            type: file.type,
            data: dataUrl.split(',')[1],
            preview: file.type.startsWith('image/') ? dataUrl : null,
          });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = e => resolve({ name: file.name, type: file.type, textContent: e.target.result });
        reader.readAsText(file);
      }
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    });
    results.push(att);
  }
  return results;
}

/* ===========================================================
   EXPORT helpers
   =========================================================== */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAsTxt(messages, config) {
  const date = new Date().toLocaleDateString();
  const lines = [`SOCRIFY — ${config.subject.label.toUpperCase()}`, `Exported ${date}`, '='.repeat(52), ''];
  for (const m of messages) {
    if (m.role === 'student') {
      const labels = m.attachmentLabels?.length ? ` [+ ${m.attachmentLabels.join(', ')}]` : '';
      lines.push(`YOU:${labels}`, m.content || '', '');
    } else {
      lines.push('SOCRIFY:', m.content || '');
      if (m.citations?.length) {
        lines.push('', 'Sources:');
        m.citations.forEach((c, i) => lines.push(`  ${i + 1}. ${c.title || c.url} — ${c.url}`));
      }
      lines.push('');
    }
  }
  downloadFile(`socrify-${config.subject.id}-${Date.now()}.txt`, lines.join('\n'), 'text/plain');
}

function exportAsHtml(messages, config) {
  const date = new Date().toLocaleDateString();
  const msgHtml = messages.map(m => {
    if (m.role === 'student') {
      const text = (m.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      const chips = (m.attachmentLabels || []).map(l => `<span class="chip">📎 ${l}</span>`).join(' ');
      return `<div class="student">${chips ? `<div class="chips">${chips}</div>` : ''}<div class="bubble">${text}</div></div>`;
    }
    const raw = window.marked ? window.marked.parse(m.content || '') : (m.content || '');
    const safe = window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
    const cits = m.citations?.length
      ? `<div class="sources"><strong>Sources:</strong><ol>${m.citations.map(c => `<li><a href="${c.url}" target="_blank">${c.title || c.url}</a></li>`).join('')}</ol></div>`
      : '';
    return `<div class="tutor"><div class="label">Socrify</div><div class="content">${safe}${cits}</div></div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${config.subject.label} — Socrify</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.6;color:#1a1a2e;background:#fafaf8}
  h1{font-size:22px;font-weight:600;margin:0 0 4px}
  .meta{color:#666;font-size:13px;margin-bottom:32px}
  .student{display:flex;flex-direction:column;align-items:flex-end;margin:16px 0}
  .student .chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:6px}
  .student .chip{font-size:12px;padding:3px 8px;background:#e8eeff;color:#3355cc;border-radius:6px}
  .student .bubble{background:#f0f0f0;padding:10px 16px;border-radius:14px;max-width:75%;font-size:15px}
  .tutor{margin:20px 0}
  .tutor .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#4d6dff;margin-bottom:6px}
  .content{font-size:15px}
  .content h1,.content h2,.content h3{margin:.8em 0 .3em;font-weight:600}
  .content pre{background:#f5f5f5;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px;font-family:monospace}
  .content code{background:#f0f0f0;padding:2px 5px;border-radius:4px;font-size:13px;font-family:monospace}
  .content pre code{background:none;padding:0}
  .content blockquote{border-left:3px solid #4d6dff;padding-left:12px;color:#555;margin-left:0}
  .content a{color:#4d6dff}
  .content table{border-collapse:collapse;width:100%}
  .content th,.content td{border:1px solid #ddd;padding:7px 10px;text-align:left}
  .content th{background:#f5f5f5;font-weight:600}
  .sources{font-size:12px;margin-top:10px;padding-top:8px;border-top:1px solid #e5e5e5;color:#555}
  .sources ol{margin:4px 0;padding-left:18px}
  .sources a{color:#4d6dff}
  footer{margin-top:48px;padding-top:14px;border-top:1px solid #e5e5e5;font-size:12px;color:#999}
</style></head>
<body>
<h1>${config.subject.label}</h1>
<p class="meta">Socrify session · Exported ${date}</p>
${msgHtml}
<footer>Exported from Socrify</footer>
</body></html>`;
  downloadFile(`socrify-${config.subject.id}-${Date.now()}.html`, html, 'text/html');
}

/* ===========================================================
   APP SHELL — frames dashboard + session
   =========================================================== */
function loadSavedPrefs() {
  try { return JSON.parse(localStorage.getItem('socrify_prefs') || '{}'); } catch { return {}; }
}

function AppShell({ profile, isGuest, onLogout, onGuestExit, settingsProps, variant, fontSize, setFontSize, reduceMotion, setReduceMotion }) {
  const savedPrefs = loadSavedPrefs();
  const [subject, setSubject] = React.useState(null);
  const [difficulty, setDifficulty] = React.useState(savedPrefs.difficulty || 'Standard');
  const [teachingStyle, setTeachingStyle] = React.useState(savedPrefs.teachingStyle || 'guided');
  const [mode, setMode] = React.useState('tutor');
  const [sessionConfig, setSessionConfig] = React.useState(null);
  const [history, setHistory] = React.useState(() => loadHistory());
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const updateConversation = React.useCallback((conv) => {
    setHistory(prev => {
      const idx = prev.findIndex(h => h.id === conv.id);
      const updated = idx >= 0
        ? prev.map((h, i) => i === idx ? conv : h)
        : [conv, ...prev];
      saveHistory(updated);
      return updated;
    });
  }, []);

  const launch = (m, initialTopic = '', initialAttachments = []) => {
    const sub = subject || GENERAL;
    setSessionConfig({
      subject: sub, mode: m, difficulty, teachingStyle, initialTopic, initialAttachments,
      convId: 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    });
    setSidebarOpen(false);
  };

  const loadConversation = (conv) => {
    const sub = SUBJECTS.find(s => s.id === conv.subjectId) || GENERAL;
    setSubject(sub);
    setMode(conv.mode);
    setDifficulty(conv.difficulty || 'Standard');
    setTeachingStyle(conv.teachingStyle || 'guided');
    setSessionConfig({
      subject: sub,
      mode: conv.mode,
      difficulty: conv.difficulty || 'Standard',
      teachingStyle: conv.teachingStyle || 'guided',
      initialTopic: '',
      convId: conv.id,
      restoredConv: conv,
    });
    setSidebarOpen(false);
  };

  const endSession = () => { setSessionConfig(null); setSidebarOpen(false); };
  const activeConvId = sessionConfig?.convId ?? null;
  const displayName = isGuest ? 'guest' : (profile?.first_name || 'friend');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <AppTopBar
        displayName={displayName}
        isGuest={isGuest}
        onLogout={onLogout}
        onGuestExit={onGuestExit}
        settingsProps={settingsProps}
        variant={variant}
        inSession={!!sessionConfig}
        onExitSession={endSession}
        sessionConfig={sessionConfig}
        profile={profile}
        fontSize={fontSize}
        setFontSize={setFontSize}
        reduceMotion={reduceMotion}
        setReduceMotion={setReduceMotion}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        sidebarOpen={sidebarOpen}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {sidebarOpen && (
          <div className="sidebar-overlay mobile-only" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <Sidebar
          subject={subject} setSubject={setSubject}
          difficulty={difficulty} setDifficulty={setDifficulty}
          teachingStyle={teachingStyle} setTeachingStyle={setTeachingStyle}
          mode={mode} setMode={setMode}
          inSession={!!sessionConfig}
          onLaunch={launch}
          profile={profile}
          isGuest={isGuest}
          onLogout={isGuest ? onGuestExit : onLogout}
          history={history}
          activeConvId={activeConvId}
          onLoadConversation={loadConversation}
          onNewChat={endSession}
          mobileOpen={sidebarOpen}
        />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!sessionConfig ? (
            <Dashboard
              displayName={displayName}
              subject={subject} setSubject={setSubject}
              difficulty={difficulty}
              teachingStyle={teachingStyle}
              mode={mode} setMode={setMode}
              onLaunch={launch}
              history={history}
              onLoadConversation={loadConversation}
            />
          ) : (
            <SessionView config={sessionConfig} onExit={endSession} onConversationUpdate={updateConversation} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------- top bar ---------- */
function AppTopBar({ displayName, isGuest, onLogout, onGuestExit, settingsProps, variant, inSession, onExitSession, sessionConfig, profile, fontSize, setFontSize, reduceMotion, setReduceMotion, onToggleSidebar, sidebarOpen }) {
  return (
    <header className="r-appbar" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      flexShrink: 0, height: 60,
    }}>
      <div className="r-appbar-left" style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <button
          type="button"
          className="hamburger-btn mobile-only"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen ? 'true' : 'false'}
        >
          <HamburgerIcon open={sidebarOpen} />
        </button>
        <SocrifyLogo variant={variant} size={22} showWord showBeta />

        {inSession && sessionConfig && (
          <>
            <div className="session-meta" style={{ width: 1, height: 18, background: 'var(--border-2)' }} />
            <button onClick={onExitSession} className="btn btn-bare btn-sm session-meta" style={{ paddingLeft: 0 }}>← All subjects</button>
            <div className="session-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span style={{ fontFamily: 'var(--font-emph)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {sessionConfig.subject.label}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{sessionConfig.mode}</span>
            </div>
          </>
        )}
      </div>
      <div className="r-appbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SettingsButton
          settingsProps={settingsProps}
          fontSize={fontSize}
          setFontSize={setFontSize}
          reduceMotion={reduceMotion}
          setReduceMotion={setReduceMotion}
        />
        <AccountButton
          profile={profile}
          isGuest={isGuest}
          onLogout={isGuest ? onGuestExit : onLogout}
          onUpgrade={() => alert('Pro plan — coming soon')}
          compact
        />
      </div>
    </header>
  );
}

function HamburgerIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {open ? (
        <>
          <line x1="4" y1="4" x2="16" y2="16" />
          <line x1="16" y1="4" x2="4" y2="16" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="17" y2="6" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="14" x2="17" y2="14" />
        </>
      )}
    </svg>
  );
}

/* ===========================================================
   SIDEBAR — teaching controls + chat history
   =========================================================== */
function Sidebar({ subject, setSubject, difficulty, setDifficulty, teachingStyle, setTeachingStyle, mode, setMode, inSession, onLaunch, profile, isGuest, onLogout, history, activeConvId, onLoadConversation, onNewChat, mobileOpen }) {
  return (
    <aside className={`app-sidebar ${mobileOpen ? 'is-open' : ''}`} style={{
      width: 272, flexShrink: 0, borderRight: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* New chat button */}
      <div style={{ padding: '16px 14px 10px' }}>
        <button onClick={onNewChat} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 500,
          transition: 'all .12s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
        >
          <SparkMark size={14} style={{ color: 'var(--accent)' }} />
          New chat
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-faint)' }} className="mono">⌘N</span>
        </button>
      </div>

      {/* Mode toggle */}
      <div style={{ padding: '0 14px 12px' }}>
        <div className="eyebrow" style={{ marginBottom: 8, paddingLeft: 4 }}>Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <ModePill active={mode === 'tutor'} onClick={() => setMode('tutor')} label="Tutor" sub="Guided" />
          <ModePill active={mode === 'research'} onClick={() => setMode('research')} label="Research" sub="Deep" />
        </div>
      </div>

      {/* Teaching style */}
      <div style={{ padding: '4px 14px 8px' }}>
        <div className="eyebrow" style={{ marginBottom: 8, paddingLeft: 4 }}>Teaching style</div>
        <div className="seg" style={{ width: '100%', padding: 3 }}>
          {TEACHING_STYLES.map(t => (
            <button key={t.id} onClick={() => setTeachingStyle(t.id)} className={teachingStyle === t.id ? 'is-active' : ''} style={{ flex: 1, fontSize: 11, padding: '6px 2px' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div style={{ padding: '4px 14px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow" style={{ marginBottom: 8, paddingLeft: 4 }}>Difficulty</div>
        <div className="seg" style={{ width: '100%', padding: 3 }}>
          {DIFFICULTIES.map(d => (
            <button key={d} onClick={() => setDifficulty(d)} className={difficulty === d ? 'is-active' : ''} style={{ flex: 1, fontSize: 11.5, padding: '6px 4px' }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Chat history */}
      <div style={{ padding: '14px 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="eyebrow">History</div>
        <button className="btn-bare" style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
          search
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }} className="scroll-thin">
        {history.length === 0 ? (
          <div style={{ padding: '20px 10px', color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
            No conversations yet
          </div>
        ) : history.map(h => {
          const isActive = activeConvId === h.id;
          return (
            <button key={h.id} onClick={() => onLoadConversation(h)} style={{
              width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              fontFamily: 'var(--font-sans)', textAlign: 'left', gap: 3,
              transition: 'background .12s', marginBottom: 1,
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                fontSize: 13.2, fontWeight: 500,
                color: isActive ? 'var(--accent-ink)' : 'var(--text)',
                width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{h.title}</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>{h.subjectLabel}</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span>{formatWhen(h.startedAt)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer — opens account popover */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
        <AccountButton
          profile={profile}
          isGuest={isGuest}
          onLogout={onLogout}
          onUpgrade={() => alert('Pro plan — coming soon')}
        />
      </div>
    </aside>
  );
}

function ModePill({ active, onClick, label, sub }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
      background: active ? 'var(--text)' : 'var(--surface-2)',
      color: active ? 'var(--bg)' : 'var(--text)',
      border: '1px solid ' + (active ? 'var(--text)' : 'var(--border)'),
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      fontFamily: 'var(--font-sans)', transition: 'all .12s ease',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{sub}</span>
    </button>
  );
}

/* ===========================================================
   DASHBOARD (empty state)
   =========================================================== */
function Dashboard({ displayName, subject, setSubject, difficulty, teachingStyle, mode, setMode, onLaunch, history, onLoadConversation }) {
  const [topic, setTopic] = React.useState('');
  const [attachments, setAttachments] = React.useState([]);
  const effectiveSubject = subject || GENERAL;
  const placeholder = mode === 'tutor'
    ? `What do you want to work on in ${effectiveSubject.label.toLowerCase()}?`
    : `Pick a topic to research deeply…`;
  const submit = () => onLaunch(mode, topic.trim(), attachments);
  const handleFileSelect = async (files) => {
    try {
      const processed = await processFiles(files);
      setAttachments(prev => [...prev, ...processed]);
    } catch (e) { alert('File error: ' + e.message); }
  };

  const recentItems = history.slice(0, 3);

  return (
    <div className="bg-paper grain" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div className="r-pad-page" style={{ maxWidth: 880, margin: '0 auto', padding: '64px 40px 80px' }}>

        <div className="fade-in-up r-dash-hero">
          <div className="eyebrow" style={{ marginBottom: 14 }}>{getGreeting()}, {displayName}</div>
          <h1 className="display" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: '0 0 12px', lineHeight: 1.05, maxWidth: '18ch' }}>
            What do you want to <em>think</em> about today?
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-2)', margin: '0 0 40px', maxWidth: '52ch' }}>
            Pick a subject in the sidebar, or just type below — we'll figure out the rest.
          </p>
        </div>

        {/* Compose card */}
        <div className="card-lg fade-in-up" style={{ padding: 6, animationDelay: '0.08s', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 6px' }}>
            <SparkMark size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontFamily: 'var(--font-emph)', fontStyle: 'italic', color: 'var(--text-2)' }}>
              {effectiveSubject.label}
            </span>
            <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {teachingStyle} · {difficulty}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <div className="seg" style={{ padding: 3 }}>
                <button onClick={() => setMode('tutor')} className={mode === 'tutor' ? 'is-active' : ''} style={{ fontSize: 12 }}>Tutor</button>
                <button onClick={() => setMode('research')} className={mode === 'research' ? 'is-active' : ''} style={{ fontSize: 12 }}>Research</button>
              </div>
            </div>
          </div>

          <textarea
            value={topic} onChange={e => setTopic(e.target.value)}
            placeholder={placeholder}
            className="field"
            style={{
              border: 'none', borderRadius: 12, fontSize: 17, padding: '14px 16px',
              minHeight: 100, background: 'transparent', boxShadow: 'none',
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          />

          <AttachmentPreview
            attachments={attachments}
            onRemove={i => setAttachments(prev => prev.filter((_, j) => j !== i))}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px 12px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <AttachButton onFilesSelected={handleFileSelect} style={{ fontSize: 12, padding: '4px 10px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>⌘ + ↵</span>
              <button onClick={submit} className="btn btn-accent">
                Start {mode === 'tutor' ? 'tutoring' : 'research'} →
              </button>
            </div>
          </div>
        </div>

        {/* Quick subjects */}
        <div style={{ marginTop: 56 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Or pick a subject</div>
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {SUBJECTS.slice(0, 8).map(s => (
              <button key={s.id}
                onClick={() => setSubject(s)}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                  background: subject?.id === s.id ? 'var(--accent-soft)' : 'var(--surface)',
                  borderColor: subject?.id === s.id ? 'var(--accent)' : 'var(--border)',
                  transition: 'all .15s ease',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: subject?.id === s.id ? 'var(--accent)' : 'var(--surface-2)',
                  color: subject?.id === s.id ? 'white' : 'var(--text-2)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17,
                }}>{s.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.persona}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        <div style={{ marginTop: 56 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Recent</div>
          {recentItems.length === 0 ? (
            <div style={{
              padding: '28px 20px', borderRadius: 14, textAlign: 'center',
              border: '1px dashed var(--border-2)', color: 'var(--text-faint)', fontSize: 14,
            }}>
              No sessions yet — start your first conversation above.
            </div>
          ) : (
            <div className="surface" style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
              {recentItems.map((h, i, arr) => {
                const subj = SUBJECTS.find(s => s.id === h.subjectId) || GENERAL;
                const turns = Math.floor((h.messages.length - 1) / 2);
                return (
                  <button key={h.id} onClick={() => onLoadConversation(h)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background .12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'var(--surface-2)', color: 'var(--text-2)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15,
                    }}>{subj.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{h.subjectLabel} · {turns} {turns === 1 ? 'turn' : 'turns'}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatWhen(h.startedAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night';
}

/* ===========================================================
   SESSION (chat) VIEW
   =========================================================== */
function SessionView({ config, onExit, onConversationUpdate }) {
  const convId = React.useRef(config.convId);
  const startedAt = React.useRef(config.restoredConv?.startedAt || new Date().toISOString());

  const [messages, setMessages] = React.useState(() =>
    config.restoredConv ? config.restoredConv.messages : seedMessages(config)
  );
  const [input, setInput] = React.useState('');
  const [attachments, setAttachments] = React.useState([]);
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState(null);
  const scrollRef = React.useRef(null);
  const didAutoSend = React.useRef(false);

  const handleFileSelect = async (files) => {
    try {
      const processed = await processFiles(files);
      setAttachments(prev => [...prev, ...processed]);
    } catch (e) { setError('Could not read file: ' + e.message); }
  };

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const persistConversation = (msgs) => {
    const firstStudent = msgs.find(m => m.role === 'student');
    if (!firstStudent) return;
    // Strip binary attachment data before writing to localStorage — keep only labels
    const storableMsgs = msgs.map(m => ({
      ...m,
      attachments: undefined,
      attachmentLabels: m.attachmentLabels || m.attachments?.map(a => a.name),
    }));
    const titleSource = firstStudent.content || firstStudent.attachments?.[0]?.name || 'Attachment';
    onConversationUpdate({
      id: convId.current,
      subjectId: config.subject.id,
      subjectLabel: config.subject.label,
      mode: config.mode,
      difficulty: config.difficulty,
      teachingStyle: config.teachingStyle,
      title: deriveTitle(titleSource),
      messages: storableMsgs,
      startedAt: startedAt.current,
    });
  };

  const send = (overrideText, overrideAttachments) => {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    const currentAtts = overrideAttachments !== undefined ? overrideAttachments : attachments;
    if ((!text && !currentAtts.length) || thinking) return;
    const userMsg = {
      role: 'student',
      content: text,
      attachments: currentAtts.length ? currentAtts : undefined,
      attachmentLabels: currentAtts.length ? currentAtts.map(a => a.name) : undefined,
      id: Date.now(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setThinking(true);
    setError(null);
    callChatApi(newMessages, config)
      .then(data => {
        const tutorMsg = {
          role: 'tutor',
          content: data.text,
          citations: data.citations || [],
          id: Date.now() + 1,
        };
        const finalMessages = [...newMessages, tutorMsg];
        setMessages(finalMessages);
        persistConversation(finalMessages);
      })
      .catch(err => {
        setError(err.message || 'Something went wrong. Please try again.');
      })
      .finally(() => {
        setThinking(false);
      });
  };

  // Auto-send the topic (and any attachments) typed on the dashboard
  React.useEffect(() => {
    if ((config.initialTopic || config.initialAttachments?.length) && !didAutoSend.current) {
      didAutoSend.current = true;
      send(config.initialTopic || '', config.initialAttachments || []);
    }
  }, []);

  return (
    <div className="bg-paper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Session header */}
      <div className="r-session-header" style={{
        padding: '20px 32px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div className="r-session-icon" style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--accent-soft)', color: 'var(--accent-ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20,
          flexShrink: 0,
        }}>{config.subject.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="r-session-title" style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {config.subject.label}
          </div>
          <div className="r-session-meta-line" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {config.mode === 'tutor' ? <>Tutor · <span style={{ textTransform: 'capitalize' }}>{config.teachingStyle}</span> · {config.difficulty}</> : <>Research mode · Deep search</>}
          </div>
        </div>
        <div className="r-session-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ExportMenu messages={messages} config={config} />
          <button onClick={onExit} className="btn btn-bare btn-sm">End session</button>
        </div>
      </div>

      {/* Chat scroll */}
      <div ref={scrollRef} className="scroll-thin r-session-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
        <div className="r-session-scroll-inner" style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {messages.map((m, i) => (
            <Message key={m.id} msg={m} isFirst={i === 0} />
          ))}
          {thinking && <ThinkingIndicator mode={config.mode} />}
        </div>
      </div>

      {/* Composer */}
      <div className="r-composer" style={{ padding: '16px 32px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Quick actions */}
          <div className="r-quick-actions" style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <QuickAction onClick={() => send("[I'M STUCK] I don't know where to start.")}>I'm stuck</QuickAction>
            <QuickAction onClick={() => send('Can you simplify that?')}>Simpler</QuickAction>
            <QuickAction onClick={() => send('Give me a hint, please.')}>Hint, please</QuickAction>
            <QuickAction onClick={() => send('Different angle?')}>Different angle</QuickAction>
          </div>

          {/* Error display */}
          {error && (
            <div style={{
              marginBottom: 10, padding: '10px 14px', borderRadius: 10,
              background: 'var(--danger-soft, #fff0f0)', border: '1px solid var(--danger, #dc2626)',
              color: 'var(--danger, #dc2626)', fontSize: 13.5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <span>{error}</span>
              <button onClick={() => setError(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'inherit', fontSize: 16, lineHeight: 1, padding: '0 2px',
              }}>×</button>
            </div>
          )}

          <div className="card" style={{ padding: 4, borderRadius: 14, boxShadow: 'var(--shadow)' }}>
            <AttachmentPreview
              attachments={attachments}
              onRemove={i => setAttachments(prev => prev.filter((_, j) => j !== i))}
            />
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Your turn — what are you thinking?"
              className="field"
              style={{ border: 'none', boxShadow: 'none', padding: '14px 16px', minHeight: 64, fontSize: 15.5, background: 'transparent' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AttachButton onFilesSelected={handleFileSelect} disabled={thinking} />
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>↵ send · ⇧↵ newline</span>
              </div>
              <button onClick={() => send()} className="btn btn-accent btn-sm" disabled={(!input.trim() && !attachments.length) || thinking}>
                Send <span aria-hidden>↵</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ children, onClick }) {
  return (
    <button onClick={onClick} className="chip" style={{ fontSize: 12.5, padding: '5px 12px' }}>
      {children}
    </button>
  );
}

function Message({ msg, isFirst }) {
  if (msg.role === 'student') {
    const labels = msg.attachmentLabels || [];
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="fade-in-up">
        <div className="r-message-student" style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {labels.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {labels.map((lbl, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: '3px 9px', borderRadius: 6,
                  background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                }}>📎 {lbl}</span>
              ))}
            </div>
          )}
          {msg.content && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              padding: '12px 16px', borderRadius: 14, fontSize: 15, lineHeight: 1.5,
            }}>
              {msg.content}
            </div>
          )}
        </div>
      </div>
    );
  }
  // Tutor / research response
  const hasCitations = msg.citations && msg.citations.length > 0;
  return (
    <div className="fade-in-up r-message-tutor" style={{ display: 'flex', gap: 14, paddingRight: '8%' }}>
      <div style={{ flexShrink: 0, paddingTop: 4 }}>
        <SparkMark size={26} style={{ color: 'var(--accent)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isFirst && (
          <div className="eyebrow" style={{ marginBottom: 8 }}>Socrify · opening question</div>
        )}
        <MarkdownContent content={msg.content} />
        {hasCitations && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Sources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {msg.citations.map((c, i) => (
                <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 12.5, color: 'var(--accent)', textDecoration: 'none',
                  display: 'flex', alignItems: 'baseline', gap: 6,
                }}>
                  <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{i + 1}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title || c.url}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ mode }) {
  return (
    <div className="fade-in-up" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div className="pulse-spark">
        <SparkMark size={26} style={{ color: 'var(--accent)' }} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {mode === 'research' ? 'Searching sources' : 'Thinking'}
        <span><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>
      </div>
    </div>
  );
}

/* ===========================================================
   MARKDOWN CONTENT — renders AI responses as formatted text
   =========================================================== */
function MarkdownContent({ content }) {
  const ref = React.useRef(null);

  const html = React.useMemo(() => {
    if (!window.marked) return null;
    // One-time setup: open links in new tabs, enable GFM + breaks
    if (!window._markedReady) {
      window._markedReady = true;
      try {
        window.marked.use({
          gfm: true,
          breaks: true,
          renderer: {
            link({ href, title, text }) {
              const t = title ? ` title="${title}"` : '';
              return `<a href="${href}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
            },
          },
        });
      } catch (e) { /* marked version mismatch — fall through */ }
    }
    try {
      const raw = window.marked.parse(content || '');
      return window.DOMPurify
        ? window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] })
        : raw;
    } catch (e) { return null; }
  }, [content]);

  // Apply syntax highlighting after every render (only hits un-highlighted blocks)
  React.useEffect(() => {
    if (ref.current && window.hljs) {
      ref.current.querySelectorAll('pre code:not(.hljs)').forEach(block => {
        window.hljs.highlightElement(block);
      });
    }
  });

  if (!html) {
    // Fallback: plain pre-wrap text (same as before)
    return (
      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
        {content}
      </p>
    );
  }
  return <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ===========================================================
   ATTACH BUTTON — triggers a hidden file <input>
   =========================================================== */
function AttachButton({ onFilesSelected, disabled, style }) {
  const ref = React.useRef(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/html,text/htm"
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.length) {
            onFilesSelected([...e.target.files]);
            e.target.value = '';
          }
        }}
      />
      <button
        type="button"
        className="chip"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer', ...style }}
      >
        📎 Attach
      </button>
    </>
  );
}

/* ===========================================================
   ATTACHMENT PREVIEW — shows pending files above the textarea
   =========================================================== */
function AttachmentPreview({ attachments, onRemove }) {
  if (!attachments.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 12px 4px' }}>
      {attachments.map((att, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderRadius: 8,
          background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5,
        }}>
          {att.preview
            ? <img src={att.preview} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
            : <span style={{ fontSize: 16 }}>{att.type === 'application/pdf' ? '📄' : '📝'}</span>
          }
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
            {att.name}
          </span>
          <button
            onClick={() => onRemove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: '0 2px', lineHeight: 1 }}
          >×</button>
        </div>
      ))}
    </div>
  );
}

/* ===========================================================
   EXPORT MENU — dropdown to save conversation as .txt or .html
   =========================================================== */
function ExportMenu({ messages, config }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const hasContent = messages.some(m => m.role === 'student');

  React.useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const items = [
    { label: 'Download .txt', action: () => { exportAsTxt(messages, config); setOpen(false); } },
    { label: 'Download .html', action: () => { exportAsHtml(messages, config); setOpen(false); } },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-bare btn-sm"
        onClick={() => setOpen(o => !o)}
        disabled={!hasContent}
        title="Export conversation"
      >
        Export ↓
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: 'var(--shadow)', minWidth: 160, overflow: 'hidden',
        }}>
          {items.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13.5,
                color: 'var(--text)', fontFamily: 'var(--font-sans)',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- session seed ---------- */
function seedMessages(config) {
  const opener = config.mode === 'research'
    ? 'What topic would you like me to research? I\'ll pull from current sources and give you a structured report — but no thesis statements or essay intros.'
    : (config.subject.id === 'biology'
        ? 'Before we begin — what do you already know about this? Even a vague idea is a starting point.'
        : config.subject.id === 'history'
        ? 'Where would you like to start? With a place, a time, or a question that\'s been bothering you?'
        : 'What\'s the problem you\'re trying to crack? Tell me what you\'ve tried so far.');
  return [{ id: 1, role: 'tutor', content: opener }];
}

Object.assign(window, { AppShell, Dashboard, SessionView });
