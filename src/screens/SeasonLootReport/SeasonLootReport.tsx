import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../design-system/Badge';
import { Crest } from '../../design-system/Crest';
import { Icon } from '../../design-system/Icon';
import { RefreshButton } from '../shared/RefreshButton';
import { HelpTooltip } from '../../design-system/HelpTooltip';
import { BossIcon } from '../../raid/BossIcon';
import { itemLabel } from '../../raid/lootLogic';
import { useSeasonLootReport, type SortKey } from './useSeasonLootReport';

const GRID_TEMPLATE = '1fr 130px 130px 130px 160px 24px';

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SortHeader({ label, sortKey, active, dir, onClick, align }: { label: string; sortKey: SortKey; active: boolean; dir: 'asc' | 'desc'; onClick: (key: SortKey) => void; align?: 'right' }) {
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className="crd-eyebrow"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        background: 'none',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        color: active ? 'var(--text-gold)' : 'var(--text-faint)',
        font: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
      }}
    >
      {label}
      {active && <Icon name={dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={11} />}
    </button>
  );
}

export function SeasonLootReport() {
  const lr = useSeasonLootReport();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                Season Loot Report
                <HelpTooltip text="Every Need win this tier, per raider -- who's behind, who's kept what, and when they last won something." />
              </div>
            </div>
          </Link>
          <div style={{ flex: 1 }} />
          <RefreshButton onRefresh={lr.refresh} refreshing={lr.refreshing} />
        </div>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        <p style={{ margin: '0 0 20px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 640 }}>
          Every Need win this tier, per raider -- who's behind, who's kept what, and when they last won something.
        </p>

        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Filter by raider…"
            value={lr.query}
            onChange={(e) => lr.setQuery(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-raised)',
              color: 'var(--text-body)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-body-s)',
              minWidth: 220,
            }}
          />
        </div>

        {lr.loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : lr.empty ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No loot logged yet this tier.
          </div>
        ) : (
          <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, gap: 12, padding: '8px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
              <SortHeader label="Raider" sortKey="name" active={lr.sortKey === 'name'} dir={lr.sortDir} onClick={lr.toggleSort} />
              <SortHeader label="Need wins" sortKey="needWinCount" active={lr.sortKey === 'needWinCount'} dir={lr.sortDir} onClick={lr.toggleSort} align="right" />
              <SortHeader label="Total won" sortKey="totalWon" active={lr.sortKey === 'totalWon'} dir={lr.sortDir} onClick={lr.toggleSort} align="right" />
              <SortHeader label="Rolled, no win" sortKey="lossCount" active={lr.sortKey === 'lossCount'} dir={lr.sortDir} onClick={lr.toggleSort} align="right" />
              <SortHeader label="Last won" sortKey="lastWonAt" active={lr.sortKey === 'lastWonAt'} dir={lr.sortDir} onClick={lr.toggleSort} align="right" />
              <div />
            </div>

            {lr.rows.map((r) => {
              const isOpen = expanded === r.name;
              return (
                <div key={r.name}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : r.name)}
                    className="raider-row"
                    style={{ display: 'grid', gridTemplateColumns: GRID_TEMPLATE, gap: 12, alignItems: 'center', padding: '10px 18px', borderTop: '1px solid var(--border-hairline)', cursor: 'pointer' }}
                  >
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', color: 'var(--text-strong)' }}>{r.name}</div>
                    <div
                      title={r.maxNeedWinsInNight > 2 ? `Broke the 2-win cap on at least one raid night (${r.maxNeedWinsInNight} that night)` : undefined}
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        color: r.maxNeedWinsInNight > 2 ? 'var(--status-danger)' : r.needWinCount === 0 ? 'var(--text-faint)' : 'var(--text-body)',
                        fontWeight: r.maxNeedWinsInNight > 2 ? 700 : 400,
                      }}
                    >
                      {r.needWinCount}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{r.totalWon}</div>
                    <div
                      title={r.lossCount > 0 ? `Rolled Need and didn't win ${r.lossCount} time${r.lossCount === 1 ? '' : 's'} this tier -- could be bad luck, could mean they've outgrown these drops` : "Hasn't lost a Need roll this tier"}
                      style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.lossCount > 0 ? 'var(--text-gold)' : 'var(--text-faint)' }}
                    >
                      {r.lossCount}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: r.lastWonAt ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                      {r.lastWonAt ? formatDate(r.lastWonAt) : 'never'}
                    </div>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="var(--text-faint)" />
                  </div>

                  {isOpen && (
                    <div style={{ padding: '10px 18px 16px 18px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-hairline)', boxShadow: 'var(--inset-well)' }}>
                      {r.items.length === 0 ? (
                        <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>No wins logged yet this tier.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {r.items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-s)' }}>
                              {item.boss && <BossIcon boss={item.boss} size={20} />}
                              <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{itemLabel(item.itemLink)}</span>
                              {item.slot && <span style={{ color: 'var(--text-faint)' }}>({item.slot})</span>}
                              <span style={{ color: 'var(--text-faint)' }}>— {item.boss ?? 'boss not recorded'}</span>
                              {item.difficulty && <Badge tone={item.difficulty === 'Heroic' ? 'gold' : 'neutral'}>{item.difficulty}</Badge>}
                              <span style={{ color: 'var(--text-faint)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{formatDate(item.time)}</span>
                              {item.tradedTo && (
                                <span style={{ color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Icon name="arrow-right" size={11} /> {item.tradedTo}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {r.lostItems.length > 0 && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-hairline)' }}>
                          <div className="crd-eyebrow" style={{ marginBottom: 8, color: 'var(--text-faint)' }}>
                            Rolled and lost this tier
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {r.lostItems.map((item, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body-s)' }}>
                                {item.boss && <BossIcon boss={item.boss} size={20} />}
                                <span style={{ color: 'var(--text-muted)' }}>{itemLabel(item.itemLink)}</span>
                                {item.slot && <span style={{ color: 'var(--text-faint)' }}>({item.slot})</span>}
                                <span style={{ color: 'var(--text-faint)' }}>— {item.boss ?? 'boss not recorded'}</span>
                                {item.difficulty && <Badge tone={item.difficulty === 'Heroic' ? 'gold' : 'neutral'}>{item.difficulty}</Badge>}
                                <span style={{ color: 'var(--text-faint)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{formatDate(item.time)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
