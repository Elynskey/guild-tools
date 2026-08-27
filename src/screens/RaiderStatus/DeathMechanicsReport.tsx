import type { DeathMechanicEntry } from '../../scoring/deathMechanics';
import type { Window } from '../../scoring/types';

interface DeathMechanicsReportProps {
  entries: DeathMechanicEntry[];
  window: Window;
}

/** Roster-wide "who is dying to what" -- every death this window, grouped by boss/ability, worst first. */
export function DeathMechanicsReport({ entries, window }: DeathMechanicsReportProps) {
  const scopeLabel = window === 'night' ? 'last raid night' : 'this tier';

  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          padding: '10px 18px',
          background: 'var(--grad-header)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
          Death mechanics — {scopeLabel}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
          {entries.reduce((sum, e) => sum + e.totalDeaths, 0)} deaths across {entries.length} mechanic{entries.length === 1 ? '' : 's'}
        </span>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--status-success)', fontSize: 'var(--text-body-s)' }}>No deaths logged {scopeLabel}.</div>
      ) : (
        entries.map((e) => (
          <div key={`${e.boss}::${e.ability}`} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14, padding: '10px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-s)', color: 'var(--text-strong)' }}>{e.ability}</span>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}> — {e.boss}</span>
              <div style={{ marginTop: 3, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                {e.byRaider.map((b) => `${b.name}${b.count > 1 ? ` x${b.count}` : ''}`).join(', ')}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-title-s)', color: 'var(--status-danger)', textAlign: 'right' }}>
              {e.totalDeaths} death{e.totalDeaths === 1 ? '' : 's'}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
