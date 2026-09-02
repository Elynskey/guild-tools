import type { DeathRateComparisonRow } from '../../scoring/deathMechanics';
import { DEATH_RATE_RED_SIGMA, DEATH_RATE_YELLOW_SIGMA } from '../../scoring/scoring';

interface DeathRateComparisonProps {
  rows: DeathRateComparisonRow[];
}

function sigmaColor(z: number): string {
  if (z > DEATH_RATE_RED_SIGMA) return 'var(--status-danger)';
  if (z > DEATH_RATE_YELLOW_SIGMA) return 'var(--status-warning)';
  if (z < -DEATH_RATE_YELLOW_SIGMA) return 'var(--status-success)';
  return 'var(--text-faint)';
}

function sigmaLabel(z: number): string {
  if (Math.abs(z) < 0.05) return 'average';
  return `${z > 0 ? '+' : ''}${z.toFixed(1)}σ ${z > 0 ? 'above' : 'below'} average`;
}

/**
 * "Who's dying more or less than everyone else" -- every raider's death rate this
 * tier, ranked against the roster's own average, so an officer can scan the whole
 * roster at once instead of opening each raider's detail panel on Raider Status
 * (which shows the same number, just one at a time).
 */
export function DeathRateComparison({ rows }: DeathRateComparisonProps) {
  if (rows.length === 0) return null;

  return (
    <div className="crd-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
          Death rate vs. guild average — this tier
        </span>
      </div>
      <div>
        {rows.map((r) => (
          <div
            key={r.name}
            style={{ display: 'grid', gridTemplateColumns: '1fr 70px 170px', gap: 12, alignItems: 'baseline', padding: '7px 18px', borderTop: '1px solid var(--border-hairline)' }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-body-s)', color: 'var(--text-strong)' }}>{r.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', textAlign: 'right' }}>{Math.round(r.deathRate * 100)}%</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', fontWeight: 700, color: sigmaColor(r.z), textAlign: 'right' }}>{sigmaLabel(r.z)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
