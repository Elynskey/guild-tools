import { Icon } from '../../design-system/Icon';
import { IconButton } from '../../design-system/IconButton';
import { BossIcon } from '../../raid/BossIcon';
import { itemLabel } from '../../raid/lootLogic';
import type { LootEntry } from '../../raid/lootLogic';

interface LootLogTableProps {
  entries: LootEntry[];
  itemIcons?: Record<number, string | null>;
  onEdit?: (entry: LootEntry) => void;
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const GRID_TEMPLATE = '90px 1fr 1.4fr 110px 140px 130px 36px';

export function LootLogTable({ entries, itemIcons, onEdit }: LootLogTableProps) {
  if (entries.length === 0) {
    return (
      <div className="crd-card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-body-s)' }}>
        No loot logged for this raid night.
      </div>
    );
  }

  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, gap: 12, padding: '8px 20px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
        <div className="crd-eyebrow">Time</div>
        <div className="crd-eyebrow">Boss</div>
        <div className="crd-eyebrow">Item</div>
        <div className="crd-eyebrow">Slot</div>
        <div className="crd-eyebrow">Won by</div>
        <div className="crd-eyebrow">Traded to</div>
        <div />
      </div>
      {entries.map((e, i) => {
        const iconUrl = e.itemId != null ? itemIcons?.[e.itemId] : null;
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_TEMPLATE,
              gap: 12,
              alignItems: 'center',
              padding: '12px 20px',
              borderTop: '1px solid var(--border-hairline)',
              opacity: e.standaloneTrade ? 0.75 : 1,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>{formatTime(e.time)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
              {e.boss && <BossIcon boss={e.boss} size={28} />}
              {e.boss ?? '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-s)', color: 'var(--text-strong)', fontWeight: 600 }}>
              {iconUrl && (
                <img src={iconUrl} alt="" style={{ width: 20, height: 20, borderRadius: 3, border: '1px solid var(--border-iron)', flex: 'none', objectFit: 'cover' }} />
              )}
              {itemLabel(e.itemLink)}
            </div>
            <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{e.slot ?? '—'}</div>
            <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
              {e.standaloneTrade ? <span style={{ color: 'var(--text-faint)' }}>unknown</span> : e.winner}
            </div>
            <div style={{ fontSize: 'var(--text-body-s)', color: e.tradedTo ? 'var(--text-gold)' : 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {e.tradedTo && <Icon name="arrow-right" size={12} />}
              {e.tradedTo ?? '—'}
            </div>
            <div>
              {onEdit && (e.id || e.tradeId) && <IconButton icon="pencil" label="Edit this entry" size="sm" onClick={() => onEdit(e)} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
