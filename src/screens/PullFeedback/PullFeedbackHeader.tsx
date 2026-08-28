import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Select } from '../../design-system/Select';
import type { RaidNight } from '../../electron';

interface PullFeedbackHeaderProps {
  nights: RaidNight[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

function formatNightLabel(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PullFeedbackHeader({ nights, selectedCode, onSelect }: PullFeedbackHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 6,
        backgroundColor: 'rgba(18,16,12,.92)',
        backdropFilter: 'var(--blur-panel)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
          <Crest size={42} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-title-l)',
                fontWeight: 600,
                letterSpacing: '.06em',
                color: 'var(--text-strong)',
                lineHeight: 1.1,
              }}
            >
              Pull Feedback
            </div>
          </div>
        </Link>
        <div style={{ flex: 1 }} />
        <Select
          label="Raid night"
          value={selectedCode ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          options={nights.map((n) => ({ value: n.code, label: formatNightLabel(n.date) }))}
          style={{ minWidth: 200 }}
        />
      </div>
    </header>
  );
}
