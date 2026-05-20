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
];
const DIFFICULTIES = ['Easier', 'Standard', 'Challenging'];

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
  return messages.slice(firstStudentIdx).map(m => ({
    role: m.role === 'student' ? 'user' : 'assistant',
    content: m.content,
  }));
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
   APP SHELL — frames dashboard + session
   =========================================================== */
function AppShell({ profile, isGuest, onLogout, onGuestExit, settingsProps, variant, fontSize, setFontSize, reduceMotion, setReduceMotion }) {
  const [subject, setSubject] = React.useState(null);
  const [difficulty, setDifficulty] = React.useState('Standard');
  const [teachingStyle, setTeachingStyle] = React.useState('guided');
  const [mode, setMode] = React.useState('tutor');
  const [sessionConfig, setSessionConfig] = React.useState(null);

  const launch = (m, initialTopic = '') => {
    const sub = subject || GENERAL;
    setSessionConfig({ subject: sub, mode: m, difficulty, teachingStyle, initialTopic });
  };
  const endSession = () => setSessionConfig(null);
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
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
            />
          ) : (
            <SessionView config={sessionConfig} onExit={endSession} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------- top bar ---------- */
function AppTopBar({ displayName, isGuest, onLogout, onGuestExit, settingsProps, variant, inSession, onExitSession, sessionConfig, profile, fontSize, setFontSize, reduceMotion, setReduceMotion }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      flexShrink: 0, height: 60,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <SocrifyLogo variant={variant} size={22} showWord showBeta />

        {inSession && sessionConfig && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border-2)' }} />
            <button onClick={onExitSession} className="btn btn-bare btn-sm" style={{ paddingLeft: 0 }}>← All subjects</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <span style={{ fontFamily: 'var(--font-emph)', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {sessionConfig.subject.label}
              </span>
              <span style={{ color: 'var(--text-faint)' }}>·</span>
              <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{sessionConfig.mode}</span>
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

/* ===========================================================
   SIDEBAR — teaching controls + chat history
   =========================================================== */
const FAKE_HISTORY = [
  { id: 'h1', subj: 'Biology',  title: 'Why does my body break down sugar?',  when: '2h ago',   turns: 9,  active: false },
  { id: 'h2', subj: 'History',  title: 'Bronze Age collapse — what really caused it?', when: 'Yesterday', turns: 14, active: false },
  { id: 'h3', subj: 'Math',     title: 'Integration by parts',                 when: 'Mon',     turns: 6,  active: false },
  { id: 'h4', subj: 'English',  title: 'Symbolism in The Great Gatsby',        when: 'Sun',     turns: 11, active: false },
  { id: 'h5', subj: 'CS',       title: 'When to use recursion vs iteration',   when: '3d ago',  turns: 4,  active: false },
  { id: 'h6', subj: 'Physics',  title: 'Why does ice float?',                  when: '4d ago',  turns: 7,  active: false },
  { id: 'h7', subj: 'Geography', title: 'How rivers shape borders',            when: '1w ago',  turns: 5,  active: false },
  { id: 'h8', subj: 'Essay',    title: 'Outline for my college app essay',     when: '2w ago',  turns: 12, active: false },
];

function Sidebar({ subject, setSubject, difficulty, setDifficulty, teachingStyle, setTeachingStyle, mode, setMode, inSession, onLaunch, sessionConfig, profile, isGuest, onLogout }) {
  const [activeHistoryId, setActiveHistoryId] = React.useState(null);
  return (
    <aside style={{
      width: 272, flexShrink: 0, borderRight: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* New chat button */}
      <div style={{ padding: '16px 14px 10px' }}>
        <button onClick={() => { setActiveHistoryId(null); }} style={{
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
            <button key={t.id} onClick={() => setTeachingStyle(t.id)} className={teachingStyle === t.id ? 'is-active' : ''} style={{ flex: 1, fontSize: 11.5, padding: '6px 4px' }}>
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
        {FAKE_HISTORY.map(h => {
          const isActive = activeHistoryId === h.id;
          return (
            <button key={h.id} onClick={() => setActiveHistoryId(h.id)} style={{
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
                <span>{h.subj}</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span>{h.when}</span>
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
function Dashboard({ displayName, subject, setSubject, difficulty, teachingStyle, mode, setMode, onLaunch }) {
  const [topic, setTopic] = React.useState('');
  const effectiveSubject = subject || GENERAL;
  const placeholder = mode === 'tutor'
    ? `What do you want to work on in ${effectiveSubject.label.toLowerCase()}?`
    : `Pick a topic to research deeply…`;
  const submit = () => onLaunch(mode, topic.trim());

  return (
    <div className="bg-paper grain" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '64px 40px 80px' }}>

        <div className="fade-in-up">
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px 12px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="chip" style={{ fontSize: 12, padding: '4px 10px' }}>📎 Attach</span>
              <span className="chip" style={{ fontSize: 12, padding: '4px 10px' }}>I'm stuck</span>
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

        {/* Recent sessions placeholder */}
        <div style={{ marginTop: 56 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Recent</div>
          <div className="surface" style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
            {[
              { subj: 'Biology', icon: 'B', q: 'Why does my body break down sugar?', when: '2h ago', turns: 9 },
              { subj: 'History', icon: 'H', q: 'What caused the Bronze Age collapse?', when: 'Yesterday', turns: 14 },
              { subj: 'Math',    icon: 'M', q: 'Integration by parts — I keep getting stuck.', when: '3d ago', turns: 6 },
            ].map((r, i, arr) => (
              <button key={i} style={{
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
                }}>{r.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.q}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.subj} · {r.turns} turns</div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{r.when}</span>
              </button>
            ))}
          </div>
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
function SessionView({ config, onExit }) {
  const [messages, setMessages] = React.useState(() => seedMessages(config));
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState(null);
  const scrollRef = React.useRef(null);
  const didAutoSend = React.useRef(false);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const send = (overrideText) => {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text || thinking) return;
    const userMsg = { role: 'student', content: text, id: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setThinking(true);
    setError(null);
    callChatApi(newMessages, config)
      .then(data => {
        setMessages(m => [...m, {
          role: 'tutor',
          content: data.text,
          citations: data.citations || [],
          id: Date.now() + 1,
        }]);
      })
      .catch(err => {
        setError(err.message || 'Something went wrong. Please try again.');
      })
      .finally(() => {
        setThinking(false);
      });
  };

  // Auto-send the topic that was typed on the dashboard
  React.useEffect(() => {
    if (config.initialTopic && !didAutoSend.current) {
      didAutoSend.current = true;
      send(config.initialTopic);
    }
  }, []);

  return (
    <div className="bg-paper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Session header */}
      <div style={{
        padding: '20px 32px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--accent-soft)', color: 'var(--accent-ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20,
        }}>{config.subject.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.1 }}>
            {config.subject.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {config.mode === 'tutor' ? <>Tutor · <span style={{ textTransform: 'capitalize' }}>{config.teachingStyle}</span> · {config.difficulty}</> : <>Research mode · Deep search</>}
          </div>
        </div>
        <button onClick={onExit} className="btn btn-bare btn-sm">End session</button>
      </div>

      {/* Chat scroll */}
      <div ref={scrollRef} className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {messages.map((m, i) => (
            <Message key={m.id} msg={m} isFirst={i === 0} />
          ))}
          {thinking && <ThinkingIndicator mode={config.mode} />}
        </div>
      </div>

      {/* Composer */}
      <div style={{ padding: '16px 32px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
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
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Your turn — what are you thinking?"
              className="field"
              style={{ border: 'none', boxShadow: 'none', padding: '14px 16px', minHeight: 64, fontSize: 15.5, background: 'transparent' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px 8px' }}>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                ↵ to send · ⇧↵ for newline
              </div>
              <button onClick={() => send()} className="btn btn-accent btn-sm" disabled={!input.trim() || thinking}>
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
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="fade-in-up">
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          padding: '12px 16px', borderRadius: 14, maxWidth: '78%',
          fontSize: 15, lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
      </div>
    );
  }
  // Tutor / research response
  const hasCitations = msg.citations && msg.citations.length > 0;
  return (
    <div className="fade-in-up" style={{ display: 'flex', gap: 14, paddingRight: '8%' }}>
      <div style={{ flexShrink: 0, paddingTop: 4 }}>
        <SparkMark size={26} style={{ color: 'var(--accent)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isFirst && (
          <div className="eyebrow" style={{ marginBottom: 8 }}>Socrify · opening question</div>
        )}
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 16, lineHeight: 1.55, color: 'var(--text)',
          fontWeight: 400, whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </p>
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
