import { useState } from 'react';
import { Icon } from '../../design-system/Icon';
import { Badge } from '../../design-system/Badge';
import { BossIcon } from '../../raid/BossIcon';
import { formatPullDuration, type BossGroup } from '../../raid/pullLogic';
import type { Pull, PullRaider } from '../../electron';

interface PullLogProps {
  groups: BossGroup[];
}

function formatMetric(raider: PullRaider): string {
  if (raider.value == null) return '—';
  if (raider.metric === 'rankPercent') return `${Math.round(raider.value)}%ile`;
  return Math.round(raider.value).toLocaleString();
}

function metricLabel(raider: PullRaider): string {
  if (raider.metric === 'dps') return 'DPS';
  if (raider.metric === 'hps') return 'HPS';
  if (raider.metric === 'rankPercent') return 'Rank';
  return '';
}

// Same tone hexes as Badge.tsx's gold/info tones -- a quick role glance in the dense throughput grid.
const ROLE_LETTER: Record<string, string> = { tank: 'T', healer: 'H', dps: 'D' };
const ROLE_COLOR: Record<string, string> = { tank: 'var(--gold-300)', healer: '#7fb0d8', dps: 'var(--text-faint)' };

function PullDetail({ pull }: { pull: Pull }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border-hairline)', boxShadow: 'var(--inset-well)', padding: '14px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px 16px', marginBottom: pull.deaths.length || pull.mechanicMisses.length ? 12 : 0 }}>
        {pull.raiders.map((r) => (
          <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-body-s)' }}>
            <span style={{ color: 'var(--text-body)' }}>
              {r.role && (
                <span style={{ display: 'inline-block', width: 14, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: ROLE_COLOR[r.role] }}>
                  {ROLE_LETTER[r.role]}
                </span>
              )}
              {r.name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {formatMetric(r)} <span style={{ color: 'var(--text-faint)', fontSize: 'var(--text-micro)' }}>{metricLabel(r)}</span>
            </span>
          </div>
        ))}
      </div>

      {pull.deaths.length > 0 && (
        <div style={{ marginBottom: pull.mechanicMisses.length ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Icon name="skull" size={12} color="var(--accent-crimson)" />
            <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--accent-crimson)' }}>Deaths</span>
          </div>
          {pull.deaths.map((d, i) => (
            <div key={i} style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{d.name}</span> — {d.ability}
            </div>
          ))}
        </div>
      )}

      {pull.mechanicMisses.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Icon name="alert-triangle" size={12} color="var(--accent-ember)" />
            <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--accent-ember)' }}>
              Mechanics missed
            </span>
          </div>
          {pull.mechanicMisses.map((m, i) => (
            <div key={i} style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', marginBottom: i < pull.mechanicMisses.length - 1 ? 6 : 0 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{m.name}</span> — {m.ability}
              {m.what && <div style={{ color: 'var(--text-muted)' }}>{m.what}</div>}
              {m.fix && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Fix — </span>
                  <span style={{ color: 'var(--text-gold)' }}>{m.fix}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PullLog({ groups }: PullLogProps) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <p style={{ margin: '0 0 20px', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', maxWidth: 640 }}>
        Every attempt on each boss below, in order — a red edge means it was a wipe, green means the kill. Click any pull for the full breakdown.
      </p>
      {groups.map((group) => {
        const kills = group.pulls.filter((p) => p.kill).length;
        return (
          <div key={group.boss} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <BossIcon boss={group.boss} size={26} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-title-m)', letterSpacing: '.05em', color: 'var(--text-strong)' }}>
                {group.boss}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
                {group.pulls.length} pull{group.pulls.length === 1 ? '' : 's'} · {kills} kill{kills === 1 ? '' : 's'}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--rule-gold)' }} />
            </div>

            <div className="crd-card" style={{ padding: 0, overflow: 'hidden' }}>
              {group.pulls.map((pull) => {
                const isOpen = open === pull.fightId;
                return (
                  <div
                    key={pull.fightId}
                    style={{ borderLeft: `3px solid ${pull.kill ? 'var(--status-success)' : 'var(--status-danger)'}`, background: pull.kill ? 'rgba(95,158,74,.05)' : 'rgba(168,50,50,.05)' }}
                  >
                    <div
                      onClick={() => setOpen(isOpen ? null : pull.fightId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '10px 18px',
                        borderTop: '1px solid var(--border-hairline)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', width: 56 }}>
                        Pull {pull.pullNumber}
                      </span>
                      <Badge tone={pull.kill ? 'success' : 'danger'} dot>
                        {pull.kill ? 'Kill' : 'Wipe'}
                      </Badge>
                      {!pull.kill && pull.bossPercentage != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{pull.bossPercentage.toFixed(1)}% left</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>{formatPullDuration(pull.durationMs)}</span>
                      <div style={{ flex: 1 }} />
                      {pull.deaths.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--accent-crimson)' }}>
                          <Icon name="skull" size={12} />
                          {pull.deaths.length}
                        </span>
                      )}
                      {pull.mechanicMisses.length > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--accent-ember)' }}>
                          <Icon name="alert-triangle" size={12} />
                          {pull.mechanicMisses.length}
                        </span>
                      )}
                      <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="var(--text-faint)" />
                    </div>
                    {isOpen && <PullDetail pull={pull} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
