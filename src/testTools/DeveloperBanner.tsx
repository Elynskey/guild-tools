/**
 * A yellow strip that says "Developer", so a test-only tool (Analytics, the Loot Logger Monitor) can't be mistaken
 * for an officer feature. Same look as the Test Mode banner, in normal flow at the top of the screen (a fixed
 * strip would cover the screens' own sticky headers).
 */
export function DeveloperBanner() {
  return (
    <div
      role="note"
      style={{
        padding: '5px 12px',
        textAlign: 'center',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-micro)',
        fontWeight: 700,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: '#1a1409',
        background: 'linear-gradient(90deg, var(--gold-300), var(--gold-400))',
        userSelect: 'none',
      }}
    >
      Developer
    </div>
  );
}

/** The small yellow "Developer" tag on a tile or heading that leads to a test-only tool. */
export function DeveloperTag() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 3,
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-micro)',
        fontWeight: 700,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: '#1a1409',
        background: 'var(--gold-300)',
        userSelect: 'none',
      }}
    >
      Developer
    </span>
  );
}
