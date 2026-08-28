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
      <div style={{ padding: '10px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
          Needs the most work
        </span>
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
                padding: '7px 18px',
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
                  style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-hairline)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <Icon name="alert-triangle" size={13} color="var(--accent-ember)" />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-s)', color: 'var(--text-strong)' }}>
                      {m.ability}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--accent-crimson)' }}>
                      {m.deathCount > 0 && `${m.deathCount} death${m.deathCount === 1 ? '' : 's'}`}
                      {m.deathCount > 0 && m.missCount > 0 && ' · '}
                      {m.missCount > 0 && `${m.missCount} missed`}
                    </span>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="var(--text-faint)" />
                  </div>
                  {m.what && <div style={{ marginTop: 3, fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{m.what}</div>}
                  {m.fix && (
                    <div style={{ marginTop: 2, fontSize: 'var(--text-body-s)', color: 'var(--text-gold)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fix — </span>
                      {m.fix}
                    </div>
                  )}
                  {expanded ? (
                    <MechanicDrilldown occurrences={m.occurrences} />
                  ) : (
                    <div style={{ marginTop: 4, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
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
