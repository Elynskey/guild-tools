import { professionIconUrl } from '../../../professions/professionCatalog';
import { ALL_EXPANSIONS_FILTER, expRecipes, groupRecipesByExpansion, recipeTone, type FlatCharacter, type SortDir, type SortKey } from '../../../professions/directoryLogic';

const GRID = 'minmax(190px,1fr) minmax(330px,1.7fr) 104px 118px 30px';

const COLUMNS: { key: SortKey | ''; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Character', align: 'left' },
  { key: 'prof', label: 'Professions · skill', align: 'left' },
  { key: 'recipes', label: 'Recipes', align: 'right' },
  { key: 'seen', label: 'Last seen', align: 'right' },
  { key: '', label: '', align: 'right' },
];

function barColor(skill: number): string {
  return skill >= 100 ? 'var(--grad-gold)' : skill >= 90 ? 'var(--gold-500)' : skill >= 60 ? 'var(--bronze-400)' : 'var(--iron-400)';
}
function skillColor(skill: number): string {
  return skill >= 100 ? 'var(--text-gold)' : skill >= 90 ? 'var(--gold-500)' : 'var(--text-muted)';
}
function seenLabel(days: number): string {
  return days === 0 ? 'online' : days === 1 ? '1d' : `${days}d`;
}
function seenColor(days: number): string {
  return days === 0 ? 'var(--accent-verdant)' : days <= 7 ? 'var(--text-body)' : 'var(--text-faint)';
}
function dotColor(days: number): string {
  return days === 0 ? 'var(--accent-verdant)' : days <= 7 ? 'var(--bronze-400)' : 'var(--iron-400)';
}
function pillStyle(tone: 'match' | 'current' | 'legacy'): { border: string; background: string; color: string } {
  if (tone === 'match') return { border: 'var(--border-strong)', background: 'rgba(212,179,88,.16)', color: 'var(--gold-200)' };
  if (tone === 'current') return { border: 'var(--border-hairline)', background: 'rgba(212,179,88,.05)', color: 'var(--text-body)' };
  return { border: 'var(--border-iron)', background: 'transparent', color: 'var(--text-faint)' };
}

interface TableViewProps {
  rows: FlatCharacter[];
  expansion: string;
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  openRows: Set<string>;
  onToggleRow: (id: string) => void;
}

export function TableView({ rows, expansion, query, sortKey, sortDir, onSort, openRows, onToggleRow }: TableViewProps) {
  return (
    <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '9px 16px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-soft)' }}>
        {COLUMNS.map((c) => (
          <div
            key={c.label || 'caret'}
            onClick={() => c.key && onSort(c.key)}
            style={{
              fontSize: 'var(--text-micro)',
              letterSpacing: 'var(--tracking-eyebrow)',
              textTransform: 'uppercase',
              color: c.key && sortKey === c.key ? 'var(--text-gold)' : 'var(--text-faint)',
              cursor: c.key ? 'pointer' : 'default',
              userSelect: 'none',
              textAlign: c.align,
            }}
          >
            {c.label}
            {c.key && sortKey === c.key ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}
          </div>
        ))}
      </div>

      {rows.map((c) => {
        const expanded = openRows.has(c.id);
        const recipeCount = expRecipes(c, expansion).length;
        return (
          <div key={c.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
            <div
              onClick={() => onToggleRow(c.id)}
              className="crd-table-row"
              style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '8px 16px', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, flex: 'none', background: dotColor(c.days) }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      letterSpacing: '.03em',
                      fontSize: 'var(--text-title-s)',
                      color: c.isMain ? 'var(--text-strong)' : 'var(--text-body)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.characterName}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', letterSpacing: '.04em', paddingLeft: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.isMain ? `${c.siblingCount} character${c.siblingCount === 1 ? '' : 's'}` : `alt of ${c.mainName}`}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                {c.profs.length === 0 ? (
                  <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', fontStyle: 'italic' }}>No professions recorded</span>
                ) : (
                  c.profs.map((p) => (
                    <div key={p.profession} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 58px', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <img src={professionIconUrl(p.profession)} alt="" style={{ width: 16, height: 16, borderRadius: 2, border: '1px solid var(--border-iron)', flex: 'none', objectFit: 'cover' }} />
                        {p.profession}
                      </span>
                      <span style={{ height: 5, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
                        <span style={{ display: 'block', height: '100%', width: `${p.skill}%`, background: barColor(p.skill) }} />
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: skillColor(p.skill), textAlign: 'right' }}>{p.skill}</span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: recipeCount ? 'var(--text-body)' : 'var(--text-faint)', textAlign: 'right' }}>
                {recipeCount || '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: seenColor(c.days), textAlign: 'right' }}>{seenLabel(c.days)}</div>
              <div style={{ textAlign: 'right', color: 'var(--text-faint)', fontSize: 'var(--text-label)' }}>{expanded ? '▾' : '▸'}</div>
            </div>

            {expanded && (
              <div style={{ padding: '4px 16px 18px 30px', background: 'var(--surface-sunken)', borderTop: '1px solid var(--border-hairline)' }}>
                {c.profs.length === 0 && <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', fontStyle: 'italic' }}>No professions on this character.</div>}
                {c.profs.map((p) => {
                  const scopedRecipes = expansion === ALL_EXPANSIONS_FILTER ? p.recipes : p.recipes.filter((r) => r.expansion === expansion);
                  const groups = groupRecipesByExpansion(scopedRecipes);
                  return (
                    <div key={p.profession} style={{ padding: '12px 0 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <img src={professionIconUrl(p.profession)} alt="" style={{ width: 20, height: 20, borderRadius: 3, border: '1px solid var(--border-soft)', flex: 'none', objectFit: 'cover' }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.04em', fontSize: 'var(--text-title-s)', color: 'var(--text-gold)' }}>{p.profession}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>{p.skill}/100</span>
                        <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                          {p.gather ? 'gathering' : `${scopedRecipes.length} recipes`}
                        </span>
                      </div>
                      {groups.length === 0 && !p.gather && <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', fontStyle: 'italic' }}>No recipes recorded for this expansion.</div>}
                      {groups.map((g) => (
                        <div key={g.expansion} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, padding: '5px 0', borderTop: '1px solid rgba(212,179,88,.08)' }}>
                          <div
                            style={{
                              fontSize: 'var(--text-micro)',
                              letterSpacing: 'var(--tracking-label)',
                              textTransform: 'uppercase',
                              color: g.expansion === expansion ? 'var(--text-gold)' : 'var(--text-faint)',
                              paddingTop: 4,
                            }}
                          >
                            {g.expansion}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {g.recipes.map((r) => {
                              const style = pillStyle(recipeTone(r, query, expansion));
                              return (
                                <span
                                  key={r.name}
                                  style={{ padding: '2px 9px', borderRadius: 99, border: `1px solid ${style.border}`, background: style.background, color: style.color, fontSize: 'var(--text-micro)', letterSpacing: '.02em' }}
                                >
                                  {r.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-faint)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 6 }}>Nothing matches</div>
          <div style={{ fontSize: 'var(--text-body-s)' }}>Widen the expansion scope or clear a filter.</div>
        </div>
      )}
    </div>
  );
}
