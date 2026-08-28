import { PullFeedbackHeader } from './PullFeedbackHeader';
import { MechanicsSummary } from './MechanicsSummary';
import { PullLog } from './PullLog';
import { usePullFeedback } from './usePullFeedback';

export function PullFeedback() {
  const pf = usePullFeedback();

  if (pf.error) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-danger)' }}>{pf.error}</div>;
  }

  if (pf.loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading raid night…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <PullFeedbackHeader nights={pf.nights} selectedCode={pf.selectedCode} onSelect={pf.selectNight} />

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        {pf.nights.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No raid nights logged for this tier yet.
          </div>
        ) : pf.empty ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            No pulls found in this report.
          </div>
        ) : (
          <>
            <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 20 }}>
              {pf.totalPulls} pull{pf.totalPulls === 1 ? '' : 's'} · {pf.kills} kill{pf.kills === 1 ? '' : 's'}
              {pf.refreshing && ' · loading…'}
            </div>
            <MechanicsSummary mechanics={pf.mechanicsNeedingWork} />
            <PullLog groups={pf.bossGroups} />
          </>
        )}
      </div>
    </div>
  );
}
