import { Badge } from '../../../design-system/Badge';
import { professionIconUrl } from '../../../professions/professionCatalog';
import { ALL_EXPANSIONS_FILTER, recipeTone, type FlatCharacter, type MainListEntry } from '../../../professions/directoryLogic';
import { GRAD_CREST } from '../theme';

function barColor(skill: number): string {
  return skill >= 100 ? 'var(--grad-gold)' : skill >= 90 ? 'var(--gold-500)' : skill >= 60 ? 'var(--bronze-400)' : 'var(--iron-400)';
}
function skillColor(skill: number): string {
  return skill >= 100 ? 'var(--text-gold)' : skill >= 90 ? 'var(--gold-500)' : 'var(--text-muted)';
}
function dotColor(days: number): string {
  return days === 0 ? 'var(--accent-verdant)' : days <= 7 ? 'var(--bronze-400)' : 'var(--iron-400)';
}
function pillStyle(tone: 'match' | 'current' | 'legacy'): { border: string; background: string; color: string } {
  if (tone === 'match') return { border: 'var(--border-strong)', background: 'rgba(212,179,88,.16)', color: 'var(--gold-200)' };
  if (tone === 'current') return { border: 'var(--border-hairline)', background: 'rgba(212,179,88,.05)', color: 'var(--text-body)' };
  return { border: 'var(--border-iron)', background: 'transparent', color: 'var(--text-faint)' };
}

interface RosterDetailViewProps {
  railMains: MainListEntry[]; // current page slice
  railLabel: string; // "N members", full filtered count
  selectedMain: string;
  onSelectMain: (mainName: string) => void;
  detailCharacters: FlatCharacter[]; // every character for the selected main, unfiltered
  expansion: string;
  query: string;
}

export function RosterDetailView({ railMains, railLabel, selectedMain, onSelectMain, detailCharacters, expansion, query }: RosterDetailViewProps) {
  const mainDays = detailCharacters.find((c) => c.isMain)?.days ?? Math.min(...detailCharacters.map((c) => c.days), 999);
  const professionCount = detailCharacters.reduce((n, c) => n + c.profs.length, 0);
  const recipeCount = detailCharacters.reduce((n, c) => n + c.profs.reduce((m, p) => m + (expansion === ALL_EXPANSIONS_FILTER ? p.recipes.length : p.recipes.filter((r) => r.expansion === expansion).length), 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 16, alignItems: 'start' }}>
      <div
        className="crd-scrollbar-thin"
        style={{
          border: '1px solid var(--border-hairline)',
          borderRadius: 5,
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-2)',
          overflow: 'hidden',
          position: 'sticky',
          top: 150,
          maxHeight: 'calc(100vh - 190px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--grad-header)',
            borderBottom: '1px solid var(--border-soft)',
            fontSize: 'var(--text-micro)',
            letterSpacing: 'var(--tracking-eyebrow)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {railLabel}
        </div>
        {railMains.map((m) => {
          const selected = m.mainName === selectedMain;
          return (
            <div
              key={m.mainName}
              onClick={() => onSelectMain(m.mainName)}
              className="crd-rail-row"
              style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--border-hairline)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                background: selected ? 'var(--surface-card-hover)' : 'transparent',
                borderLeft: `2px solid ${selected ? 'var(--gold-400)' : 'transparent'}`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 99, flex: 'none', background: dotColor(m.days) }} />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  letterSpacing: '.03em',
                  fontSize: 'var(--text-title-s)',
                  color: selected ? 'var(--text-gold)' : 'var(--text-strong)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {m.mainName}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{m.characterCount}c</span>
            </div>
          );
        })}
      </div>

      <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
        <div style={{ height: 2, background: GRAD_CREST }} />
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-hairline)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 'auto' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 'var(--tracking-display)', fontSize: 'var(--text-display-s)', color: 'var(--text-gold)' }}>{selectedMain}</div>
            <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
              {detailCharacters.length} characters · {professionCount} professions · {recipeCount} recipes in {expansion}
            </div>
          </div>
          <Badge tone={mainDays === 0 ? 'success' : mainDays <= 7 ? 'info' : 'neutral'} dot>
            {mainDays === 0 ? 'online' : mainDays === 1 ? '1d' : `${mainDays}d`}
          </Badge>
        </div>

        {detailCharacters.map((c) => (
          <div key={c.id} style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.04em', fontSize: 'var(--text-title-m)', color: 'var(--text-strong)' }}>{c.characterName}</span>
              <span style={{ fontSize: 'var(--text-micro)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>{c.isMain ? 'Main' : 'Alt'}</span>
            </div>
            {c.profs.length === 0 && <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', fontStyle: 'italic' }}>No professions on this character.</div>}
            {c.profs.map((p) => {
              const recipes = expansion === ALL_EXPANSIONS_FILTER ? p.recipes : p.recipes.filter((r) => r.expansion === expansion);
              return (
                <div key={p.profession} style={{ padding: '10px 0', borderTop: '1px solid rgba(212,179,88,.08)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 92px', gap: 14, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 'var(--text-body-m)', color: 'var(--text-body)', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <img src={professionIconUrl(p.profession)} alt="" style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid var(--border-soft)', flex: 'none', objectFit: 'cover' }} />
                      {p.profession}
                    </span>
                    <span style={{ height: 6, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
                      <span style={{ display: 'block', height: '100%', width: `${p.skill}%`, background: barColor(p.skill) }} />
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body-s)', color: skillColor(p.skill), textAlign: 'right' }}>{p.skill}/100</span>
                  </div>
                  {recipes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 2 }}>
                      {recipes.map((r) => {
                        const style = pillStyle(recipeTone(r, query, expansion));
                        return (
                          <span key={r.name} style={{ padding: '2px 9px', borderRadius: 99, border: `1px solid ${style.border}`, background: style.background, color: style.color, fontSize: 'var(--text-micro)' }}>
                            {r.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {!p.gather && recipes.length === 0 && <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)', fontStyle: 'italic' }}>No {expansion} recipes recorded.</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
