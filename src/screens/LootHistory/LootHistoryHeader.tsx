import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Select } from '../../design-system/Select';
import { IconButton } from '../../design-system/IconButton';
import type { LootNight } from '../../raid/lootLogic';

interface LootHistoryHeaderProps {
  nights: LootNight[];
  selectedNightKey: string | null;
  onSelect: (key: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

function formatNightLabel(startTime: number): string {
  return new Date(startTime * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function LootHistoryHeader({ nights, selectedNightKey, onSelect, onRefresh, refreshing }: LootHistoryHeaderProps) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
          <Crest size={42} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
              Loot History
            </div>
          </div>
        </Link>
        <div style={{ flex: 1 }} />
        {nights.length > 0 && (
          <Select
            label="Raid night"
            value={selectedNightKey ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            options={nights.map((n) => ({ value: n.key, label: formatNightLabel(n.startTime) }))}
            style={{ minWidth: 200 }}
          />
        )}
        <IconButton
          icon="refresh-cw"
          label={refreshing ? 'Refreshing…' : 'Refresh'}
          framed
          disabled={refreshing}
          onClick={onRefresh}
          style={{ opacity: refreshing ? 0.6 : 1 }}
        />
      </div>
    </header>
  );
}
