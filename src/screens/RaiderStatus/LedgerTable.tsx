import type { DisplayRaider } from './useRaiderStatus';
import { RaiderRow } from './RaiderRow';

export const LEDGER_GRID_TEMPLATE = '3px minmax(160px,1fr) 92px 122px 78px 58px 62px 104px';

interface LedgerTableProps {
  perfHeader: string;
  trendHeader: string;
  rows: DisplayRaider[];
  toggleRow: (name: string) => void;
  rioGateText: string;
  ilvlGateText: string;
}

export function LedgerTable({ perfHeader, trendHeader, rows, toggleRow, rioGateText, ilvlGateText }: LedgerTableProps) {
  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: LEDGER_GRID_TEMPLATE,
          gap: 12,
          alignItems: 'center',
          padding: '8px 18px 8px 0',
          background: 'var(--grad-header)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div />
        <div className="crd-eyebrow">Raider</div>
        <div className="crd-eyebrow">{perfHeader}</div>
        <div className="crd-eyebrow">Gems &amp; enchants</div>
        <div className="crd-eyebrow">{trendHeader}</div>
        <div className="crd-eyebrow" style={{ textAlign: 'right' }}>
          Deaths
        </div>
        <div className="crd-eyebrow" style={{ textAlign: 'right' }}>
          Score
        </div>
        <div className="crd-eyebrow">Band</div>
      </div>
      {rows.map((r) => (
        <RaiderRow key={r.name} raider={r} onToggle={() => toggleRow(r.name)} rioGateText={rioGateText} ilvlGateText={ilvlGateText} />
      ))}
    </div>
  );
}
