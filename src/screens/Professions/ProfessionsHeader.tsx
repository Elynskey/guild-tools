import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { RefreshButton } from '../shared/RefreshButton';
import { config } from '../../config';

interface ProfessionsHeaderProps {
  onRefresh: () => void;
  refreshing: boolean;
}

export function ProfessionsHeader({ onRefresh, refreshing }: ProfessionsHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 6,
        backgroundColor: 'rgba(18,16,12,.92)',
        backgroundImage: `linear-gradient(90deg,rgba(18,16,12,.97) 0%,rgba(18,16,12,.72) 45%,rgba(18,16,12,.86) 100%),url('${config.heroBanner}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
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
              Professions
            </div>
          </div>
        </Link>
        <div style={{ flex: 1 }} />
        <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
      </div>
    </header>
  );
}
