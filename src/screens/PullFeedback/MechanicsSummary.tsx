import { Icon } from '../../design-system/Icon';
import type { BossMechanics } from '../../raid/pullLogic';

interface MechanicsSummaryProps {
  groups: BossMechanics[];
}

/** "Needs the most work" -- deaths and survived-but-missed mechanics combined, grouped by boss, worst first within each. */
export function MechanicsSummary({ groups }: MechanicsSummaryProps) {
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
            {g.mechanics.map((m) => (
              <div key={m.ability} style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-hairline)' }}>
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
                </div>
                {m.what && <div style={{ marginTop: 3, fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{m.what}</div>}
                {m.fix && (
                  <div style={{ marginTop: 2, fontSize: 'var(--text-body-s)', color: 'var(--text-gold)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fix — </span>
                    {m.fix}
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                  {m.raiders.map((r) => `${r.name}${r.count > 1 ? ` x${r.count}` : ''}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
