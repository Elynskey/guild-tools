import { useState } from 'react';
import { Icon } from '../../design-system/Icon';
import { REPEAT_MECHANIC_THRESHOLD } from '../../scoring/deathMechanics';
import type { DisplayRaider } from './useRaiderStatus';
import { OverallPerformanceDialog } from './OverallPerformanceDialog';

interface RaiderDetailPanelProps {
  raider: DisplayRaider;
  rioGateText: string;
  ilvlGateText: string;
}

export function RaiderDetailPanel({ raider: r, rioGateText, ilvlGateText }: RaiderDetailPanelProps) {
  const [showFull, setShowFull] = useState(false);
  const feedbackTitle = r.window === 'night' ? 'Selected Raid Night' : 'Season Overview · Tier-to-Date';
  const provenance =
    r.window === 'night' ? 'That raid night’s Warcraft Logs pull only. One night, not a verdict.' : 'Warcraft Logs tier-to-date · wowaudit gear snapshot · Raider.IO';

  // Full death history for this window, grouped by boss + ability with counts --
  // the feedback prose above only ever cites the single most recent cause.
  const deathLog = (() => {
    const map = new Map<string, { boss: string; ability: string; count: number }>();
    for (const cause of r.deathCausesInWindow) {
      const key = `${cause.boss}::${cause.ability}`;
      const entry = map.get(key);
      if (entry) entry.count++;
      else map.set(key, { boss: cause.boss, ability: cause.ability, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  })();

  return (
    <div style={{ padding: '16px 24px 22px 22px', background: 'var(--surface-raised)', borderTop: '1px solid var(--border-hairline)', boxShadow: 'var(--inset-well)' }}>
      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div className="crd-eyebrow">{feedbackTitle}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFull(true);
            }}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-micro)',
              letterSpacing: '.09em',
              textTransform: 'uppercase',
              color: 'var(--text-gold)',
            }}
          >
            See overall performance →
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-body-m)', lineHeight: 1.5, color: 'var(--text-strong)' }}>{r.feedback.status}</p>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-body)' }}>
          <span style={{ color: 'var(--text-gold)' }}>Working. </span>
          {r.feedback.working}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-body)' }}>
          <span style={{ color: 'var(--text-gold)' }}>Attention. </span>
          {r.feedback.attention}
        </p>
        <p
          style={{
            margin: '4px 0 0',
            padding: '10px 14px',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--action-secondary)',
            fontSize: 'var(--text-body-s)',
            lineHeight: 1.5,
            color: 'var(--text-strong)',
          }}
        >
          <span style={{ color: 'var(--text-gold)' }}>Next step. </span>
          {r.feedback.action}
        </p>
        {r.pullsInWindow > 0 && (
          <div style={{ marginTop: 2, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
            Died on {Math.round(r.deathRate * 100)}% of pulls — guild average {Math.round(r.deathRateAvg * 100)}%
            {Math.abs(r.deathRateZ) >= 0.05 && (
              <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.deathRateZ > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                ({r.deathRateZ > 0 ? '+' : ''}
                {r.deathRateZ.toFixed(1)}σ {r.deathRateZ > 0 ? 'above' : 'below'} average)
              </span>
            )}
          </div>
        )}
        {deathLog.length > 0 && (
          <div style={{ marginTop: 2 }}>
            <div className="crd-eyebrow" style={{ marginBottom: 4 }}>
              Death log ({r.deathsInWindow})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {deathLog.map((d) => {
                const flagged = d.count >= REPEAT_MECHANIC_THRESHOLD;
                return (
                  <div key={`${d.boss}::${d.ability}`} style={{ fontSize: 'var(--text-body-s)', color: flagged ? 'var(--accent-ember)' : 'var(--text-body)', fontWeight: flagged ? 700 : 400 }}>
                    {flagged && <Icon name="alert-triangle" size={11} style={{ verticalAlign: -1, marginRight: 3 }} color="var(--accent-ember)" />}
                    <span style={{ fontFamily: 'var(--font-mono)', color: flagged ? 'var(--accent-ember)' : 'var(--text-faint)' }}>{d.count}x</span> {d.ability}{' '}
                    <span style={{ color: flagged ? undefined : 'var(--text-faint)' }}>— {d.boss}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {r.band === 'ineligible' && (
          <div style={{ display: 'flex', gap: 24, marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)' }}>
            <span style={{ color: r.rioFail ? 'var(--status-danger)' : 'var(--text-body)' }}>
              Raider.IO {r.rioBest} <span style={{ color: 'var(--text-faint)' }}>/ gate {rioGateText}</span>
            </span>
            <span style={{ color: r.ilvlFail ? 'var(--status-danger)' : 'var(--text-body)' }}>
              Item level {r.ilvlBest} <span style={{ color: 'var(--text-faint)' }}>/ gate {ilvlGateText}</span>
            </span>
          </div>
        )}
        <div style={{ marginTop: 2, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{provenance}</div>
      </div>

      {showFull && <OverallPerformanceDialog raider={r} onClose={() => setShowFull(false)} rioGateText={rioGateText} ilvlGateText={ilvlGateText} />}
    </div>
  );
}
