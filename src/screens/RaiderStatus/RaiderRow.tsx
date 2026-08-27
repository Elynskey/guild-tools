import { Icon } from '../../design-system/Icon';
import { Badge } from '../../design-system/Badge';
import { ordinal } from '../../scoring/scoring';
import { specIconFallback } from '../../scoring/specIcons';
import type { DisplayRaider } from './useRaiderStatus';
import { BADGE_TONE, ROW_COLOR } from './bandVisuals';
import { LEDGER_GRID_TEMPLATE } from './LedgerTable';
import { RaiderDetailPanel } from './RaiderDetailPanel';

interface RaiderRowProps {
  raider: DisplayRaider;
  onToggle: () => void;
  rioGateText: string;
  ilvlGateText: string;
}

export function RaiderRow({ raider: r, onToggle, rioGateText, ilvlGateText }: RaiderRowProps) {
  const dps = r.role === 'dps';
  const night = r.window === 'night';
  const color = ROW_COLOR[r.band];

  // dps: perf/trend are %-of-the-guild's-minimum-DPS. healer/tank: percentile within role.
  const perfValue = dps ? `${r.perf}%` : ordinal(r.perf);
  const perfW = `${r.scoreParts.perfScore}%`;
  const gearValue = `${r.gearCompletion}%`;
  const gearColor = r.gearCompletion >= 95 ? 'var(--status-success)' : r.gearCompletion >= 80 ? 'var(--status-warning)' : 'var(--status-danger)';
  const trendValue = dps
    ? night
      ? `${r.nightParse}%`
      : r.parseTrend > 0
        ? `+${r.parseTrend}`
        : `${r.parseTrend}`
    : night
      ? ordinal(r.nightParse)
      : r.parseTrend > 0
        ? `+${r.parseTrend}`
        : `${r.parseTrend}`;
  const trendColor = (dps ? (night ? r.nightParse >= 100 : r.parseTrend >= 0) : night ? r.nightParse >= 50 : r.parseTrend >= 0) ? 'var(--status-success)' : 'var(--status-warning)';
  const deathColor = r.deaths >= 2 ? 'var(--status-danger)' : r.deaths === 1 ? 'var(--status-warning)' : 'var(--text-faint)';
  const capTitle = r.deaths >= 2 ? 'Death cap: band held at Red' : r.deaths === 1 ? 'Death cap: band held at Yellow' : '';
  const scoreText = r.scored ? `${r.score}` : '—';
  const dim = r.band === 'ineligible' ? 0.72 : 1;

  return (
    <div style={{ borderTop: '1px solid var(--border-hairline)' }}>
      <div
        onClick={onToggle}
        className="raider-row"
        style={{
          display: 'grid',
          gridTemplateColumns: LEDGER_GRID_TEMPLATE,
          gap: 12,
          alignItems: 'center',
          padding: '0 18px 0 0',
          cursor: 'pointer',
          opacity: dim,
          transition: 'background-color var(--dur-fast) var(--ease-standard)',
        }}
      >
        <div style={{ alignSelf: 'stretch', background: color }} />
        <div style={{ padding: '9px 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{perfValue}</div>
          <div style={{ marginTop: 4, height: 3, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: color, width: perfW }} />
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{gearValue}</div>
          <div style={{ marginTop: 4, height: 3, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: gearColor, width: gearValue }} />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: trendColor }}>{trendValue}</div>
        <div title={capTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: deathColor }}>
          {r.deaths > 0 && <Icon name="skull" size={14} />}
          <span>{r.deaths}</span>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-title-l)', color }}>{scoreText}</div>
        <div>
          <Badge tone={BADGE_TONE[r.band]} dot>
            {r.bandLabel}
          </Badge>
        </div>
      </div>

      {r.expanded && <RaiderDetailPanel raider={r} rioGateText={rioGateText} ilvlGateText={ilvlGateText} />}
    </div>
  );
}
