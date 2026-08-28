import { useState } from 'react';
import { Icon } from '../../design-system/Icon';
import type { BossMechanics } from '../../raid/pullLogic';
import { groupOccurrencesByRaider } from '../../raid/pullLogic';

interface MechanicsSummaryProps {
  groups: BossMechanics[];
}

/** Who hit this mechanic, and on which pulls -- expanded on click. */
function MechanicDrilldown({ occurrences }: { occurrences: BossMechanics['mechanics'][number]['occurrences'] }) {
  const byRaider = groupOccurrencesByRaider(occurrences);
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {byRaider.map((r) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'var(--text-body-s)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: 110 }}>{r.name}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {r.hits.map((h, i) => (
              <span
                key={i}
                title={h.kind === 'death' ? 'Died to this mechanic' : 'Took damage from it, survived'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  color: h.kind === 'death' ? 'var(--accent-crimson)' : 'var(--text-muted)',
                }}
              >
                <Icon name={h.kind === 'death' ? 'skull' : 'alert-triangle'} size={11} />
                Pull {h.pullNumber}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Needs the most work" -- deaths and survived-but-missed mechanics combined, grouped by boss, worst first within each. */
export function MechanicsSummary({ groups }: MechanicsSummaryProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
      <div style={{ padding: '16px 24px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
        <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 6 }}>
          Needs the most work
        </div>
        <div style={{ fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-muted)', maxWidth: 640 }}>
          Worst first. A death weighs more than a near-miss — and only counts once a pull ends in a{' '}
          <b style={{ color: 'var(--text-body)' }}>kill</b>; a wipe's deaths are just how the attempt ended, not a sign nobody can dodge it.
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
            <Icon name="skull" size={13} color="var(--accent-crimson)" />
            Died to it — ended the pull
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
            <Icon name="alert-triangle" size={13} color="var(--accent-ember)" />
            Hit, survived — still worth fixing
          </span>
        </div>
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--status-success)', fontSize: 'var(--text-body-s)' }}>
          No missed mechanics this night.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.boss}>
            <div
              style={{
                padding: '9px 24px',
                background: 'var(--surface-sunken)',
                borderBottom: '1px solid var(--border-hairline)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                letterSpacing: '.04em',
                fontSize: 'var(--text-body-s)',
                color: 'var(--text-muted)',
              }}
            >
              {g.boss}
            </div>
            {g.mechanics.map((m) => {
              const key = `${g.boss}::${m.ability}`;
              const expanded = expandedKey === key;
              return (
                <div
                  key={m.ability}
                  onClick={() => setExpandedKey(expanded ? null : key)}
                  style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-hairline)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-m)', color: 'var(--text-strong)' }}>
                      {m.ability}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: m.deathCount > 0 ? 'var(--accent-crimson)' : 'var(--accent-ember)' }}>
                      {m.deathCount > 0 && `${m.deathCount} death${m.deathCount === 1 ? '' : 's'}`}
                      {m.deathCount > 0 && m.missCount > 0 && ' · '}
                      {m.missCount > 0 && `${m.missCount} missed`}
                    </span>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="var(--text-faint)" />
                  </div>
                  {(m.what || m.fix) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
                          What's happening
                        </div>
                        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', lineHeight: 1.5 }}>{m.what}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
                          How to fix it
                        </div>
                        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-gold)', lineHeight: 1.5 }}>{m.fix}</div>
                      </div>
                    </div>
                  )}
                  {expanded ? (
                    <MechanicDrilldown occurrences={m.occurrences} />
                  ) : (
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                      {m.raiders.map((r) => `${r.name}${r.count > 1 ? ` x${r.count}` : ''}`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
