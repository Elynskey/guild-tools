import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Tabs, type TabDef } from '../../design-system/Tabs';
import { Select } from '../../design-system/Select';
import { config } from '../../config';
import type { RaidNight } from '../../electron';

interface SiteHeaderProps {
  windowTabs: TabDef[];
  windowValue: string;
  setWindow: (v: string) => void;
  progressionFraction: string;
  nights: RaidNight[];
  selectedNightCode: string | null;
  setSelectedNightCode: (code: string) => void;
}

function formatNightLabel(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SiteHeader({ windowTabs, windowValue, setWindow, progressionFraction, nights, selectedNightCode, setSelectedNightCode }: SiteHeaderProps) {
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
              Raider Status
            </div>
          </div>
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img
            src={config.expansionLogo}
            alt="Midnight"
            style={{ height: 38, width: 'auto', objectFit: 'contain', opacity: 0.9, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.6))' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <div className="crd-eyebrow">Current tier</div>
            <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
              {config.tier.name} · <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-gold)' }}>{progressionFraction}</span>{' '}
              {config.tier.progressionDifficulty}
            </div>
          </div>
          <Tabs tabs={windowTabs} value={windowValue} onChange={setWindow} />
          {windowValue === 'night' && nights.length > 0 && (
            <Select
              aria-label="Raid night"
              value={selectedNightCode ?? ''}
              onChange={(e) => setSelectedNightCode(e.target.value)}
              options={nights.map((n) => ({ value: n.code, label: formatNightLabel(n.date) }))}
            />
          )}
        </div>
      </div>
    </header>
  );
}
