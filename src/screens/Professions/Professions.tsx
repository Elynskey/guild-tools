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
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading professions…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <ProfessionsHeader onRefresh={p.refresh} refreshing={p.refreshing} />

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', paddingBottom: 10, marginBottom: 24, borderBottom: '1px solid var(--border-hairline)' }}>
          <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
            {p.totalMembers} active members
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{p.freshness}</span>
        </div>

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 40 }}>
            {p.members.map((m) => (
              <MemberCard key={m.mainName} member={m} expansionFilter={p.expansionFilter} />
            ))}
          </div>
        )}

        <RequestBoard professionNames={p.allProfessionNames} />
      </div>
    </div>
  );
}
