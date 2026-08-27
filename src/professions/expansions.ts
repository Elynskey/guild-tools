import type { MemberProfessions, ProfessionTier } from './types';

export const ALL_EXPANSIONS = 'All expansions';

/**
 * Blizzard's tier names are consistently "<Expansion> <Profession>" (confirmed
 * live: "Khaz Algar Blacksmithing", "Zandalari Skinning", "Classic Skinning", ...).
 * Stripping the profession name off leaves the expansion label.
 */
export function deriveExpansionLabel(tierName: string, profession: string): string {
  const stripped = tierName.replace(profession, '').trim();
  return stripped || tierName;
}

/**
 * Chronological order, oldest to newest. This is a fixed historical fact (not a
 * guess about "what's current") — needed because Blizzard's profession tiers do
 * NOT come back newest-first as originally assumed: confirmed live that "Classic"
 * wins any position-based heuristic (its tier sorts first for many professions,
 * seemingly by internal tier ID rather than recency). Add to the end when a new
 * expansion ships; anything not listed sorts before everything here (oldest).
 */
const EXPANSION_ORDER = [
  'Classic',
  'Outland',
  'Northrend',
  'Cataclysm',
  'Pandaria',
  'Draenor',
  'Legion',
  'Zandalari',
  'Shadowlands',
  'Dragon Isles',
  'Khaz Algar',
  'Kul Tiran',
  'Midnight',
];

function chronologicalRank(label: string): number {
  const i = EXPANSION_ORDER.indexOf(label);
  return i === -1 ? -1 : i;
}

/** The chronologically newest tier for a profession — NOT tiers[0] (confirmed unreliable, see above). */
export function pickMostRecentTier(tiers: ProfessionTier[], profession: string): ProfessionTier | undefined {
  return tiers.reduce<ProfessionTier | undefined>((best, t) => {
    if (!best) return t;
    return chronologicalRank(deriveExpansionLabel(t.tierName, profession)) > chronologicalRank(deriveExpansionLabel(best.tierName, profession)) ? t : best;
  }, undefined);
}

/** Builds the dropdown's option list (oldest to newest) and defaults to the newest present. */
export function computeExpansionOptions(members: MemberProfessions[]): { options: string[]; defaultExpansion: string } {
  const seen = new Set<string>();

  for (const member of members) {
    for (const character of member.characters) {
      for (const entry of character.professions) {
        for (const tier of entry.tiers) {
          seen.add(deriveExpansionLabel(tier.tierName, entry.profession));
        }
      }
    }
  }

  const sorted = [...seen].sort((a, b) => chronologicalRank(a) - chronologicalRank(b));
  const defaultExpansion = sorted[sorted.length - 1] ?? ALL_EXPANSIONS;

  return { options: [ALL_EXPANSIONS, ...sorted], defaultExpansion };
}
