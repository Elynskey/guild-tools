import { Icon } from '../../design-system/Icon';
import type { MechanicNeedingWork } from '../../raid/pullLogic';

interface MechanicsSummaryProps {
  mechanics: MechanicNeedingWork[];
}

/** Ranked "what needs the most work" list -- deaths and survived-but-missed mechanics combined, worst first. */
export function MechanicsSummary({ mechanics }: MechanicsSummaryProps) {
  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
      <div style={{ padding: '10px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
          Needs the most work
        </span>
      </div>
      {mechanics.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--status-success)', fontSize: 'var(--text-body-s)' }}>
          No missed mechanics this night.
        </div>
      ) : (
        mechanics.map((m) => (
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
            {m.description !== m.ability && <div style={{ marginTop: 3, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{m.description}</div>}
            <div style={{ marginTop: 4, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
              {m.raiders.map((r) => `${r.name}${r.count > 1 ? ` x${r.count}` : ''}`).join(', ')}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
