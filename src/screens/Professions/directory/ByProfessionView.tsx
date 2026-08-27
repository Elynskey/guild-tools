import { professionIconUrl } from '../../../professions/professionCatalog';
import type { ProfessionGroup } from '../../../professions/directoryLogic';

const SHOW_CAP = 10;

function barColor(skill: number): string {
  return skill >= 100 ? 'var(--grad-gold)' : skill >= 90 ? 'var(--gold-500)' : skill >= 60 ? 'var(--bronze-400)' : 'var(--iron-400)';
}
function skillColor(skill: number): string {
  return skill >= 100 ? 'var(--text-gold)' : skill >= 90 ? 'var(--gold-500)' : 'var(--text-muted)';
}

interface ByProfessionViewProps {
  groups: ProfessionGroup[];
  expandedProfessions: Set<string>;
  onShowAll: (profession: string) => void;
  onOpenMember: (mainName: string) => void;
}

export function ByProfessionView({ groups, expandedProfessions, onShowAll, onOpenMember }: ByProfessionViewProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 16, alignItems: 'start' }}>
      {groups.map((g) => {
        const capped = !expandedProfessions.has(g.profession);
        const shown = capped ? g.members.slice(0, SHOW_CAP) : g.members;
        return (
          <div key={g.profession} style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={professionIconUrl(g.profession)} alt="" style={{ width: 26, height: 26, borderRadius: 3, border: '1px solid var(--border-soft)', boxShadow: 'var(--shadow-1)', flex: 'none', objectFit: 'cover' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.05em', fontSize: 'var(--text-title-m)', color: 'var(--text-gold)', flex: 1 }}>{g.profession}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
                {g.members.length} · {g.maxedCount} maxed
              </span>
            </div>

            {shown.map(({ character: c, skill }) => (
              <div
                key={c.id}
                onClick={() => onOpenMember(c.mainName)}
                className="crd-profgroup-row"
                style={{ display: 'grid', gridTemplateColumns: '1fr 92px 1fr 56px', gap: 12, alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid var(--border-hairline)', cursor: 'pointer' }}
              >
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
                <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.isMain ? 'main' : `alt · ${c.mainName}`}
                </span>
                <span style={{ height: 5, borderRadius: 99, background: 'var(--stone-950)', boxShadow: 'var(--inset-well)', overflow: 'hidden', display: 'block' }}>
                  <span style={{ display: 'block', height: '100%', width: `${skill}%`, background: barColor(skill) }} />
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: skillColor(skill), textAlign: 'right' }}>{skill}/100</span>
              </div>
            ))}

            {capped && g.members.length > SHOW_CAP && (
              <div
                onClick={() => onShowAll(g.profession)}
                className="crd-showall-row"
                style={{ padding: '9px 16px', textAlign: 'center', fontSize: 'var(--text-label)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-gold)', cursor: 'pointer' }}
              >
                Show all {g.members.length}
              </div>
            )}

            {g.members.length === 0 && (
              <div style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--status-danger)', fontSize: 'var(--text-body-s)', letterSpacing: '.03em' }}>Nobody in the guild covers this.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
