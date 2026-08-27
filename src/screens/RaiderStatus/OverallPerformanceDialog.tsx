import { Dialog } from '../../design-system/Dialog';
import { Badge } from '../../design-system/Badge';
import type { DisplayRaider } from './useRaiderStatus';
import { BADGE_TONE } from './bandVisuals';

/**
 * "See overall performance" — the full per-metric breakdown (perf/gear/trend), not
 * just the strongest/weakest pair shown in the compact row panel. Answers, in one
 * place: what they did well (each metric's own text), what's holding them back
 * (Attention), and the single thing to fix (Next step).
 */

const VERDICT_COLOR: Record<'strong' | 'mid' | 'weak', string> = {
  strong: 'var(--status-success)',
  mid: 'var(--status-warning)',
  weak: 'var(--status-danger)',
};

const VERDICT_LABEL: Record<'strong' | 'mid' | 'weak', string> = {
  strong: 'Working well',
  mid: 'Holding steady',
  weak: 'Needs attention',
};

interface OverallPerformanceDialogProps {
  raider: DisplayRaider;
  onClose: () => void;
  rioGateText: string;
  ilvlGateText: string;
}

export function OverallPerformanceDialog({ raider: r, onClose, rioGateText, ilvlGateText }: OverallPerformanceDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      width={560}
      eyebrow={r.window === 'night' ? 'Friday Night Only' : 'Rolled-Up · Tier-to-Date'}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.name}
          <Badge tone={BADGE_TONE[r.band]} dot>
            {r.bandLabel}
          </Badge>
        </span>
      }
    >
      <p style={{ marginTop: 0, color: 'var(--text-strong)' }}>{r.feedback.status}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'var(--space-2)' }}>
        {r.feedback.breakdown.map((item) => (
          <div key={item.dimension}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--text-label)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {item.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>{item.value}</span>
            </div>
            <div style={{ marginTop: 4, height: 4, background: 'var(--surface-sunken)', overflow: 'hidden', borderRadius: 'var(--radius-xs)' }}>
              <div style={{ height: '100%', background: VERDICT_COLOR[item.verdict], width: `${item.score}%` }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
              <span style={{ color: VERDICT_COLOR[item.verdict] }}>{VERDICT_LABEL[item.verdict]}. </span>
              {item.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-body)' }}>
          <span style={{ color: 'var(--text-gold)' }}>Mistakes to fix. </span>
          {r.feedback.attention}
        </p>
        <p
          style={{
            margin: 0,
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
      </div>

      {r.band === 'ineligible' && (
        <div style={{ display: 'flex', gap: 24, marginTop: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)' }}>
          <span style={{ color: r.rioFail ? 'var(--status-danger)' : 'var(--text-body)' }}>
            Raider.IO {r.rioBest} <span style={{ color: 'var(--text-faint)' }}>/ gate {rioGateText}</span>
          </span>
          <span style={{ color: r.ilvlFail ? 'var(--status-danger)' : 'var(--text-body)' }}>
            Item level {r.ilvlBest} <span style={{ color: 'var(--text-faint)' }}>/ gate {ilvlGateText}</span>
          </span>
        </div>
      )}
    </Dialog>
  );
}
