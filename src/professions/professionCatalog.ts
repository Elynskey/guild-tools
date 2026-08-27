/**
 * Static facts about WoW professions — which are which, and their Blizzard trade-skill
 * icon slugs (from the design handoff's Assets table, confirmed against Wowhead's CDN).
 * Not data that changes per-guild or per-character, so it doesn't need to come from the
 * live pipeline.
 */

export const CRAFTING_PROFESSIONS = ['Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Inscription', 'Jewelcrafting', 'Leatherworking', 'Tailoring'] as const;

export const GATHERING_PROFESSIONS = ['Herbalism', 'Mining', 'Skinning'] as const;

export const ALL_PROFESSIONS = [...CRAFTING_PROFESSIONS, ...GATHERING_PROFESSIONS];

export function isGatheringProfession(profession: string): boolean {
  return (GATHERING_PROFESSIONS as readonly string[]).includes(profession);
}

const PROF_ICON_SLUG: Record<string, string> = {
  Alchemy: 'trade_alchemy',
  Blacksmithing: 'trade_blacksmithing',
  Enchanting: 'trade_engraving',
  Engineering: 'trade_engineering',
  Inscription: 'inv_inscription_tradeskill01',
  Jewelcrafting: 'inv_misc_gem_01',
  Leatherworking: 'trade_leatherworking',
  Tailoring: 'trade_tailoring',
  Herbalism: 'trade_herbalism',
  Mining: 'trade_mining',
  Skinning: 'inv_misc_pelt_wolf_01',
};

// Shared with src/scoring/specIcons.ts's ICON_FALLBACK — already bundled at assets/icons/.
const FALLBACK_ICON_PATH = './assets/icons/inv_misc_questionmark.jpg';

/**
 * Self-hosted (assets/icons/professions/), same as this app's class/spec icons
 * (src/scoring/specIcons.ts) — the design handoff hotlinks these from Wowhead's CDN and
 * flags that as a "self-host before shipping" item; this app already dropped every other
 * hotlinked-CDN dependency (lucide-static, spec icons), so do the same here from the start
 * rather than shipping a new one and fixing it later.
 */
export function professionIconUrl(profession: string): string {
  const slug = PROF_ICON_SLUG[profession];
  return slug ? `./assets/icons/professions/${slug}.jpg` : FALLBACK_ICON_PATH;
}
