import { Icon } from '../../design-system/Icon';
import { REPEAT_MECHANIC_THRESHOLD, findRepeatOffenders, type DeathMechanicEntry } from '../../scoring/deathMechanics';
import type { Window } from '../../scoring/types';

interface DeathMechanicsReportProps {
  entries: DeathMechanicEntry[];
  window: Window;
}

/** Roster-wide "who is dying to what" -- every death this window, grouped by boss/ability, worst first. */
export function DeathMechanicsReport({ entries, window }: DeathMechanicsReportProps) {
  const scopeLabel = window === 'night' ? 'last raid night' : 'this tier';
  const offenders = findRepeatOffenders(entries);

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

      {offenders.length > 0 && (
        <div style={{ padding: '10px 18px', background: 'rgba(194,91,40,.08)', borderBottom: '1px solid var(--border-hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <Icon name="alert-triangle" size={13} color="var(--accent-ember)" />
            <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--accent-ember)' }}>
              Missing a mechanic — died to it {REPEAT_MECHANIC_THRESHOLD}+ times
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {offenders.map((o) => (
              <div key={o.name} style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-strong)' }}>{o.name}</span>{' '}
                <span style={{ color: 'var(--text-faint)' }}>
                  — {o.mechanics.map((m) => `${m.ability} on ${m.boss} (${m.count}x)`).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--status-success)', fontSize: 'var(--text-body-s)' }}>No deaths logged {scopeLabel}.</div>
      ) : (
        entries.map((e) => (
          <div key={`${e.boss}::${e.ability}`} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14, padding: '10px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-s)', color: 'var(--text-strong)' }}>{e.ability}</span>
              <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}> — {e.boss}</span>
              <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '0 5px', fontSize: 'var(--text-micro)' }}>
                {e.byRaider.map((b, i) => {
                  const flagged = b.count >= REPEAT_MECHANIC_THRESHOLD;
                  return (
                    <span key={b.name} style={{ color: flagged ? 'var(--accent-ember)' : 'var(--text-faint)', fontWeight: flagged ? 700 : 400 }}>
                      {flagged && <Icon name="alert-triangle" size={10} style={{ verticalAlign: -1, marginRight: 2 }} />}
                      {b.name}
                      {b.count > 1 ? ` x${b.count}` : ''}
                      {i < e.byRaider.length - 1 ? ',' : ''}
                    </span>
                  );
                })}
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
