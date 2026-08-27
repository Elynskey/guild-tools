import { RefreshButton } from '../shared/RefreshButton';
import type { Band } from '../../scoring/types';
import type { Tile } from './useRaiderStatus';

interface StatusRibbonProps {
  avgLine: string;
  freshness: string;
  tiles: Tile[];
  toggleBand: (key: Band) => void;
  guildWell: string;
  guildStop: string;
  guildGate: string;
  onRefresh: () => void;
  refreshing: boolean;
}

export function StatusRibbon({ avgLine, freshness, tiles, toggleBand, guildWell, guildStop, guildGate, onRefresh, refreshing }: StatusRibbonProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', paddingBottom: 10, borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
          {avgLine}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{freshness}</span>
        <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
      </div>

      <div style={{ display: 'flex', height: 6, gap: 2, margin: '14px 0 12px' }}>
        {tiles.map((tile) => (
          <div key={tile.key} title={tile.title} style={{ width: tile.pct, background: tile.color, boxShadow: 'var(--inset-bevel)' }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className="band-chip"
            onClick={() => toggleBand(tile.key)}
            title={tile.title}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '5px 12px',
              border: `1px solid ${tile.edge}`,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: tile.color }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: tile.countColor }}>{tile.count}</span>
            <span style={{ fontSize: 'var(--text-micro)', letterSpacing: '.09em', textTransform: 'uppercase', color: tile.labelColor }}>{tile.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 840, marginBottom: 34 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-body-m)', lineHeight: 1.5, color: 'var(--text-body)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-s)', letterSpacing: '.06em', color: 'var(--status-success)' }}>Going well. </span>
          {guildWell}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--text-body-m)', lineHeight: 1.5, color: 'var(--text-body)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-s)', letterSpacing: '.06em', color: 'var(--status-warning)' }}>Stopping us. </span>
          {guildStop}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-muted)' }}>{guildGate}</p>
      </div>
    </>
  );
}
