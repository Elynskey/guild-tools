import { Icon } from '../../design-system/Icon';
import { specIconFallback } from '../../scoring/specIcons';
import type { DisplayRaider } from './useRaiderStatus';
import { ROSTER_GRID_TEMPLATE } from './RosterTable';

interface RosterRowProps {
  raider: DisplayRaider;
  onToggleGear: () => void;
}

/** Identity + gear only -- no score/band here, see LedgerTable for that (Performance section). */
export function RosterRow({ raider: r, onToggleGear }: RosterRowProps) {
  const gearValue = `${r.gearCompletion}%`;
  const gearColor = r.gearCompletion >= 95 ? 'var(--status-success)' : r.gearCompletion >= 80 ? 'var(--status-warning)' : 'var(--status-danger)';
  const detail = r.gearDetail;

  return (
    <div style={{ borderTop: '1px solid var(--border-hairline)' }}>
      <div
        onClick={onToggleGear}
        className="raider-row"
        style={{ display: 'grid', gridTemplateColumns: ROSTER_GRID_TEMPLATE, gap: 12, alignItems: 'center', padding: '9px 18px', cursor: 'pointer' }}
      >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-faint)' }}>Gear</span>
              <span>{gearValue}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: gearColor, width: gearValue }} />
            </div>
          </div>
          <Icon name={r.gearExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="var(--text-faint)" />
        </div>
      </div>

      {r.gearExpanded && (
        <div style={{ padding: '14px 18px 18px 54px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-hairline)', boxShadow: 'var(--inset-well)' }}>
          {!detail ? (
            <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>No per-slot gear detail available.</div>
          ) : detail.missingEnchants.length === 0 && detail.emptySockets === 0 ? (
            <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--status-success)' }}>Every enchantable slot and gem socket filled.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
              {detail.missingEnchants.length > 0 && (
                <div>
                  <div className="crd-eyebrow" style={{ marginBottom: 4 }}>
                    Missing enchants ({detail.missingEnchants.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detail.missingEnchants.map((slot) => (
                      <span
                        key={slot}
                        style={{
                          padding: '2px 8px',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-body-s)',
                          color: 'var(--status-warning)',
                        }}
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {detail.emptySockets > 0 && (
                <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--status-warning)' }}>
                  {detail.emptySockets} of {detail.totalSockets} gem socket{detail.totalSockets === 1 ? '' : 's'} empty.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
