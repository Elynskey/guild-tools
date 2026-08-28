import { ROW_COLOR } from './bandVisuals';

const ROWS: { band: 'green' | 'yellow' | 'red' | 'ineligible'; label: string; note: string }[] = [
  { band: 'green', label: 'Green', note: '75 and up' },
  { band: 'yellow', label: 'Yellow', note: '55 to 74' },
  { band: 'red', label: 'Red', note: 'under 55' },
  { band: 'ineligible', label: 'Ineligible', note: 'gear/score gate not met, no score computed' },
];

/** Explains the score/band language once, above the performance ledgers -- same numbers as scoring.ts, not restated informally. */
export function ScoreKey() {
  return (
    <div className="crd-card" style={{ padding: '16px 20px', marginBottom: 20 }}>
      <div className="crd-eyebrow" style={{ marginBottom: 10 }}>
        How to read a score
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>
            <b style={{ color: 'var(--text-strong)' }}>Score</b> is weighted: <span style={{ color: 'var(--text-gold)' }}>performance 50%</span> +{' '}
            <span style={{ color: 'var(--text-gold)' }}>gems &amp; enchants 30%</span> + <span style={{ color: 'var(--text-gold)' }}>trend 20%</span>.
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>
            <b style={{ color: 'var(--text-strong)' }}>Death cap</b> can hold a band down even when the number wouldn't: over 15% of pulls ending in death
            caps Green to Yellow; over 30% forces Red, regardless of score.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {ROWS.map((r) => (
            <div key={r.band} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-s)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: ROW_COLOR[r.band], flex: 'none' }} />
              <b style={{ color: 'var(--text-strong)' }}>{r.label}</b>
              <span style={{ color: 'var(--text-muted)' }}>— {r.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
