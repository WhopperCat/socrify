/* =========================================================
   Socrify · Logo Mark — original radial "spark" family
   Designed for the Socratic theme: radiating inquiry.
   4 variations, themable via currentColor.
   ========================================================= */

/**
 * SparkMark — the primary 8-point mark.
 *   4 long cardinal rays + 4 short diagonals. Tapered lenses, not lines.
 *   Has slight asymmetry: the bottom-right diagonal is replaced with a
 *   separated dot — the "question mark" of the Socratic spark.
 */
function SparkMark({ size = 32, withQuestionDot = true, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      style={style}
      aria-hidden="true"
    >
      {/* Long cardinal rays — tapered lens shape */}
      {[0, 90, 180, 270].map((deg) => (
        <path
          key={`L${deg}`}
          d="M0,-46 C 5,-22 5,-22 0,0 C -5,-22 -5,-22 0,-46 Z"
          transform={`rotate(${deg})`}
        />
      ))}
      {/* Short diagonal rays */}
      {[45, 135, 225].map((deg) => (
        <path
          key={`S${deg}`}
          d="M0,-26 C 3.2,-13 3.2,-13 0,0 C -3.2,-13 -3.2,-13 0,-26 Z"
          transform={`rotate(${deg})`}
        />
      ))}
      {/* 4th diagonal: replaced with a question-dot when asymmetric, else regular */}
      {withQuestionDot ? (
        <circle cx="18.5" cy="18.5" r="4.8" />
      ) : (
        <path
          d="M0,-26 C 3.2,-13 3.2,-13 0,0 C -3.2,-13 -3.2,-13 0,-26 Z"
          transform="rotate(315)"
        />
      )}
    </svg>
  );
}

/**
 * BloomMark — 6 organic petals at 60° intervals.
 *   Softer, more botanical/philosophical.
 */
function BloomMark({ size = 32, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      style={style}
      aria-hidden="true"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path
          key={deg}
          d="M0,-44 C 8,-30 8,-14 0,0 C -8,-14 -8,-30 0,-44 Z"
          transform={`rotate(${deg})`}
        />
      ))}
      {/* Center void */}
      <circle cx="0" cy="0" r="4.2" fill="var(--bg)" />
    </svg>
  );
}

/**
 * QuillMark — 4 sharp points, longer vertical than horizontal.
 *   A "guiding star" for inquiry.
 */
function QuillMark({ size = 32, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      style={style}
      aria-hidden="true"
    >
      {/* Tall vertical points */}
      <path d="M0,-48 C 6,-18 6,-18 0,0 C -6,-18 -6,-18 0,-48 Z" />
      <path d="M0,-48 C 6,-18 6,-18 0,0 C -6,-18 -6,-18 0,-48 Z" transform="rotate(180)" />
      {/* Shorter horizontal points */}
      <path d="M0,-32 C 5,-14 5,-14 0,0 C -5,-14 -5,-14 0,-32 Z" transform="rotate(90)" />
      <path d="M0,-32 C 5,-14 5,-14 0,0 C -5,-14 -5,-14 0,-32 Z" transform="rotate(270)" />
      {/* Tiny accent dots in negative space */}
      <circle cx="22" cy="22" r="2.8" opacity="0.6" />
      <circle cx="-22" cy="-22" r="2.8" opacity="0.6" />
    </svg>
  );
}

/**
 * InquiryMark — minimal version: a single hyper-elegant spark
 *   with floating question-dot. Reads cleanly at favicon size.
 */
function InquiryMark({ size = 32, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      style={style}
      aria-hidden="true"
    >
      {/* Vertical (tall) */}
      <path d="M0,-44 C 4,-20 4,-20 0,0 C -4,-20 -4,-20 0,-44 Z" />
      {/* Horizontal (medium) */}
      <path d="M-36,0 C -16,-3.5 -16,-3.5 0,0 C -16,3.5 -16,3.5 -36,0 Z" />
      <path d="M36,0 C 16,-3.5 16,-3.5 0,0 C 16,3.5 16,3.5 36,0 Z" />
      {/* Bottom drops into a floating dot — the question */}
      <path d="M0,8 C 3,16 3,16 0,24 C -3,16 -3,16 0,8 Z" />
      <circle cx="0" cy="34" r="4.6" />
    </svg>
  );
}

/**
 * SocrifyLogo — primary lockup with mark + wordmark
 *   Wordmark uses Instrument Serif for editorial gravity.
 */
function SocrifyLogo({
  variant = 'spark',
  size = 28,
  showWord = true,
  showBeta = false,
  inkColor = false,
  className = '',
  animated = false,
}) {
  const markColor = inkColor ? 'var(--text)' : 'var(--accent)';
  const Mark = {
    spark: SparkMark,
    bloom: BloomMark,
    quill: QuillMark,
    inquiry: InquiryMark,
  }[variant] || SparkMark;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.32,
        color: markColor,
      }}
    >
      <span className={animated ? 'pulse-spark' : ''} style={{ display: 'inline-flex' }}>
        <Mark size={size} />
      </span>
      {showWord && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: size * 0.95,
            fontWeight: 400,
            letterSpacing: '-0.015em',
            color: 'var(--text)',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: size * 0.22,
          }}
        >
          Socrify
          {showBeta && <span className="beta-pill">BETA</span>}
        </span>
      )}
    </span>
  );
}

/* Export to window so other Babel scripts can use them */
Object.assign(window, {
  SparkMark,
  BloomMark,
  QuillMark,
  InquiryMark,
  SocrifyLogo,
});
