import { Tooltip } from '../../design-system/Tooltip';
import type { DisplayRaider } from './useRaiderStatus';
import { RaiderRow } from './RaiderRow';

export const LEDGER_GRID_TEMPLATE = '3px minmax(140px,1fr) 122px 78px 58px 62px 104px';

const PERF_HEADER_TIP: Record<string, string> = {
  'Survivability percentile': "Where this tank's damage-taken ranks against the guild's other tanks on the same pulls -- not judged on damage output at all.",
  'HPS percentile': "Where this healer's healing throughput ranks against the guild's other healers on the same pulls -- healing load swings too much by comp/mechanics for a flat number to be fair.",
  'DPS vs minimum': "Damage as a percentage of the guild's minimum DPS bar (set in .env, rises as the tier progresses) -- a real threshold, never a ranking against other players' logs.",
};

const TREND_HEADER_TIP: Record<string, string> = {
  Trend: "Slope of this metric across the whole tier -- rising, flat, or slipping. Flat scores the midpoint; each point of slope shifts the trend score by 6.",
  'That Night': 'This metric from the selected raid night only, not the tier-to-date average.',
};

function HeaderTip({ label, tip }: { label: string; tip: string }) {
  // placement="bottom", not the default "top" -- the ledger card has overflow:hidden
  // for its rounded corners, which silently clips a tooltip positioned above a header
  // that sits right at the card's top edge. Below stays inside the card's bounds.
  return (
    <Tooltip label={tip} wrap placement="bottom">
      <span style={{ cursor: 'help', borderBottom: '1px dotted currentColor' }}>{label}</span>
    </Tooltip>
  );
}

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
        <div className="crd-eyebrow">
          <HeaderTip label={perfHeader} tip={PERF_HEADER_TIP[perfHeader] ?? perfHeader} />
        </div>
        <div className="crd-eyebrow">
          <HeaderTip label={trendHeader} tip={TREND_HEADER_TIP[trendHeader] ?? trendHeader} />
        </div>
        <div className="crd-eyebrow" style={{ textAlign: 'right' }}>
          <HeaderTip label="Deaths" tip="Deaths / pulls, not a raw count. Over 15% of pulls caps Green to Yellow; over 30% forces Red regardless of score. Hover a row's death count for the exact rate." />
        </div>
        <div className="crd-eyebrow" style={{ textAlign: 'right' }}>
          <HeaderTip label="Score" tip="Weighted 0-100: performance 50% + gems & enchants 30% + trend 20%, then the death cap can hold the band down (but never the number itself)." />
        </div>
        <div className="crd-eyebrow">
          <HeaderTip
            label="Band"
            tip="Green >= 75, Yellow >= 55, else Red -- from the score above, then the death cap can hold it lower. Ineligible means the Raider.IO or item level gate isn't met; no score is computed."
          />
        </div>
      </div>
      {rows.map((r) => (
        <RaiderRow key={r.name} raider={r} onToggle={() => toggleRow(r.name)} rioGateText={rioGateText} ilvlGateText={ilvlGateText} />
      ))}
    </div>
  );
}
