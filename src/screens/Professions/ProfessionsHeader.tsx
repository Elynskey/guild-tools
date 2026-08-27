import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Tabs } from '../../design-system/Tabs';
import { RefreshButton } from '../shared/RefreshButton';
import { isGatheringProfession } from '../../professions/professionCatalog';
import type { MemberProfessions } from '../../professions/types';
import type { ProfessionsTab } from './Professions';

interface ProfessionsHeaderProps {
  members: MemberProfessions[];
  freshness: string;
  freshnessJustSynced: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  tab: ProfessionsTab;
  onTabChange: (tab: ProfessionsTab) => void;
  openRequestCount: number;
}

function StatCell({ value, label, gold = false, last = false }: { value: number; label: string; gold?: boolean; last?: boolean }) {
  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 1, borderRight: last ? 'none' : '1px solid var(--border-hairline)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, color: gold ? 'var(--text-gold)' : 'var(--text-strong)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{label}</div>
    </div>
  );
}

export function ProfessionsHeader({ members, freshness, freshnessJustSynced, refreshing, onRefresh, tab, onTabChange, openRequestCount }: ProfessionsHeaderProps) {
  const characterCount = members.reduce((n, m) => n + m.characters.length, 0);
  const crafterCount = members.reduce((n, m) => n + m.characters.filter((c) => c.professions.some((p) => !isGatheringProfession(p.profession))).length, 0);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(18,16,12,.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <div style={{ maxWidth: 1560, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none', marginRight: 'auto' }} title="Back to Guild Tools">
          <Crest size={42} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="crd-eyebrow">Casual Raid Days · The Scryers · Officer Tools</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.06em', fontSize: 26, color: 'var(--text-gold)', lineHeight: 1.1 }}>Professions</div>
          </div>
        </Link>

        <div style={{ display: 'flex', border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--inset-bevel)' }}>
          <StatCell value={members.length} label="Active members" />
          <StatCell value={characterCount} label="Characters" />
          <StatCell value={crafterCount} label="Crafters" gold last />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent-verdant)', boxShadow: '0 0 6px rgba(95,158,74,.7)' }} />
            <span>{freshnessJustSynced ? 'Synced just now · Blizzard API' : freshness}</span>
          </div>
          <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
        </div>
      </div>

      <div style={{ maxWidth: 1560, margin: '0 auto', padding: '0 32px' }}>
        <Tabs
          tabs={[
            { value: 'directory', label: 'Member directory', count: members.length },
            { value: 'coverage', label: 'Coverage & reports' },
            { value: 'requests', label: 'Crafting requests', count: openRequestCount },
          ]}
          value={tab}
          onChange={(v) => onTabChange(v as ProfessionsTab)}
        />
      </div>
    </header>
  );
}
