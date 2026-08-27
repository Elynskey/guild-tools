import { Tag } from '../../design-system/Tag';
import { ALL_EXPANSIONS, deriveExpansionLabel, pickMostRecentTier } from '../../professions/expansions';
import type { MemberProfessions } from '../../professions/types';

interface MemberCardProps {
  member: MemberProfessions;
  expansionFilter: string;
}

const RECIPE_PREVIEW_COUNT = 6;

export function MemberCard({ member, expansionFilter }: MemberCardProps) {
  return (
    <div className="crd-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-strong)' }}>
          {member.mainName}
        </div>
        {member.characters.length > 1 && (
          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{member.characters.length} characters</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {member.characters.map((c) => {
          const professionsWithFilteredTiers = c.professions
            .map((p) => ({
              ...p,
              tiers: expansionFilter === ALL_EXPANSIONS ? p.tiers : p.tiers.filter((t) => deriveExpansionLabel(t.tierName, p.profession) === expansionFilter),
            }))
            .filter((p) => p.tiers.length > 0);

          const isRedundantMainName = member.characters.length === 1 && c.characterName === member.mainName;

          return (
            <div key={c.characterName}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                {!isRedundantMainName && (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-s)', fontWeight: 600, color: 'var(--text-body)' }}>{c.characterName}</span>
                )}
                <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                  {c.class} · {c.realm} · {c.lastLoginDaysAgo === 0 ? 'today' : `${c.lastLoginDaysAgo}d ago`}
                </span>
              </div>

              {professionsWithFilteredTiers.length === 0 ? (
                <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-faint)' }}>
                  {c.professions.length === 0 ? 'No tracked professions.' : 'No recipes for this expansion.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {professionsWithFilteredTiers.map((p) => {
                    const latestTier = pickMostRecentTier(p.tiers, p.profession);
                    const allRecipes = p.tiers.flatMap((t) => t.knownRecipes);
                    const preview = allRecipes.slice(0, RECIPE_PREVIEW_COUNT);
                    const extra = allRecipes.length - preview.length;
                    return (
                      <div key={p.profession}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 'var(--text-label)', color: 'var(--text-gold)' }}>{p.profession}</span>
                          {latestTier && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                              {latestTier.skillPoints}/{latestTier.maxSkillPoints} · {latestTier.tierName}
                            </span>
                          )}
                        </div>
                        {latestTier && (
                          <div style={{ marginTop: 4, height: 3, background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                background: 'var(--status-success)',
                                width: `${latestTier.maxSkillPoints ? (latestTier.skillPoints / latestTier.maxSkillPoints) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        )}
                        {preview.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {preview.map((r) => (
                              <Tag key={r}>{r}</Tag>
                            ))}
                            {extra > 0 && <Tag>+{extra} more</Tag>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
