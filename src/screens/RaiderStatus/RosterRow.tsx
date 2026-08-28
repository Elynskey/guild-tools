import { specIconFallback } from '../../scoring/specIcons';
import type { DisplayRaider } from './useRaiderStatus';
import { ROSTER_GRID_TEMPLATE } from './RosterTable';

interface RosterRowProps {
  raider: DisplayRaider;
}

/** Identity + gear only -- no score/band here, see LedgerTable for that (Performance section). */
export function RosterRow({ raider: r }: RosterRowProps) {
  const gearValue = `${r.gearCompletion}%`;
  const gearColor = r.gearCompletion >= 95 ? 'var(--status-success)' : r.gearCompletion >= 80 ? 'var(--status-warning)' : 'var(--status-danger)';

  return (
    <div style={{ borderTop: '1px solid var(--border-hairline)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: ROSTER_GRID_TEMPLATE, gap: 12, alignItems: 'center', padding: '9px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img
            src={r.icon}
            alt={`${r.spec} ${r.class}`}
            title={`${r.spec} ${r.class}`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = specIconFallback;
            }}
            style={{ flex: 'none', width: 26, height: 26, border: '1px solid var(--border-hairline)', borderRadius: 2, boxShadow: 'var(--shadow-1)' }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-s)', fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-strong)' }}>
              {r.name}
            </div>
            <div style={{ marginTop: 1, fontSize: 'var(--text-micro)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.subline}
            </div>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-faint)' }}>Gear</span>
            <span>{gearValue}</span>
          </div>
          <div style={{ height: 4, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: gearColor, width: gearValue }} />
          </div>
        </div>
      </div>
    </div>
  );
}
