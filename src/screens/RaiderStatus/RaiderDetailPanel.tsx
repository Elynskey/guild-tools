import { useState } from 'react';
import type { DisplayRaider } from './useRaiderStatus';
import { OverallPerformanceDialog } from './OverallPerformanceDialog';

interface RaiderDetailPanelProps {
  raider: DisplayRaider;
  rioGateText: string;
  ilvlGateText: string;
}

export function RaiderDetailPanel({ raider: r, rioGateText, ilvlGateText }: RaiderDetailPanelProps) {
  const [showFull, setShowFull] = useState(false);
  const feedbackTitle = r.window === 'night' ? 'Friday Night Only' : 'Rolled-Up · Tier-to-Date';
  const provenance =
    r.window === 'night' ? 'Tonight’s Warcraft Logs pull only. One night, not a verdict.' : 'Warcraft Logs tier-to-date · wowaudit gear snapshot · Raider.IO';

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
