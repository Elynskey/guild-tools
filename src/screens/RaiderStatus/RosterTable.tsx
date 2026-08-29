import type { DisplayRaider } from './useRaiderStatus';
import { RosterRow } from './RosterRow';

export const ROSTER_GRID_TEMPLATE = 'minmax(180px,1fr) minmax(220px,340px)';

interface RosterTableProps {
  rows: DisplayRaider[];
  toggleGearRow: (name: string) => void;
}

/** Who's on the team -- identity, class/spec, gear completion. No score/band; see LedgerTable for that. */
export function RosterTable({ rows, toggleGearRow }: RosterTableProps) {
  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: ROSTER_GRID_TEMPLATE,
          gap: 12,
          alignItems: 'center',
          padding: '8px 18px',
          background: 'var(--grad-header)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div className="crd-eyebrow">Raider</div>
        <div className="crd-eyebrow">Gear</div>
      </div>
      {rows.map((r) => (
        <RosterRow key={r.name} raider={r} onToggleGear={() => toggleGearRow(r.name)} />
      ))}
    </div>
  );
}
