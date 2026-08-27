import '../RaiderStatus/RaiderStatus.css';
import { Input } from '../../design-system/Input';
import { Select } from '../../design-system/Select';
import { ProfessionsHeader } from './ProfessionsHeader';
import { MemberCard } from './MemberCard';
import { RequestBoard } from './RequestBoard';
import { useProfessions } from './useProfessions';

export function Professions() {
  const p = useProfessions();

  if (p.loadError) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-danger)' }}>{p.loadError}</div>;
  }

  if (p.loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ marginBottom: 12 }}>{p.progressLabel}</div>
        {p.progressPercent !== null && (
          <div style={{ maxWidth: 360, margin: '0 auto', height: 4, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p.progressPercent}%`, background: 'var(--status-success)', transition: 'width .2s ease' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <ProfessionsHeader onRefresh={p.refresh} refreshing={p.refreshing} />

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', paddingBottom: 10, marginBottom: p.refreshing && p.progressPercent !== null ? 8 : 24, borderBottom: '1px solid var(--border-hairline)' }}>
          <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
            {p.totalMembers} active members
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{p.refreshing ? p.progressLabel : p.freshness}</span>
        </div>
        {p.refreshing && p.progressPercent !== null && (
          <div style={{ height: 3, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ height: '100%', width: `${p.progressPercent}%`, background: 'var(--status-success)', transition: 'width .2s ease' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ width: 280 }}>
            <Input placeholder="Search name, profession, or recipe" value={p.query} onChange={(e) => p.setQuery(e.target.value)} />
          </div>
          <div style={{ width: 220 }}>
            <Select
              label="Recipes from"
              value={p.expansionFilter}
              onChange={(e) => p.setExpansionFilter(e.target.value)}
              options={p.expansionOptions}
            />
          </div>
        </div>

        {p.members.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
            No members match that search.
          </div>
        ) : (
          // Column-based (masonry-style) layout, not CSS grid -- with cards this
          // uneven in height (1-5 characters x 1-3 professions x recipe tags each,
          // across a whole-guild roster), a strict grid stretches/gaps ugly. Columns
          // pack each card under the shortest column instead.
          <div style={{ columnWidth: 340, columnGap: 16, marginBottom: 40 }}>
            {p.members.map((m) => (
              <div key={m.mainName} style={{ breakInside: 'avoid', marginBottom: 16 }}>
                <MemberCard member={m} expansionFilter={p.expansionFilter} />
              </div>
            ))}
          </div>
        )}

        <RequestBoard professionNames={p.allProfessionNames} />
      </div>
    </div>
  );
}
