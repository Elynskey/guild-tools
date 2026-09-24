/**
 * What each class brings to a Mythic+ group, for M+ Comp. Class-level on purpose: a
 * class's lust, battle res, soothe, dispel, purge and group buff are (almost) all
 * available whatever the spec. Same caveat as raid/raidBuffs.ts -- spot-check against the
 * current patch if something looks wrong. Unlike raidBuffs.ts this counts Paladin's
 * battle res (Intercession) and a Hunter's lust from a pet, which matter in keys.
 */
export type UtilityId = 'lust' | 'bres' | 'soothe' | 'curse' | 'poison' | 'disease' | 'purge';

export interface UtilityDef {
  id: UtilityId;
  label: string;
  /** How much a missing one costs a group, relative to a raider's whole score (see mplusComp.ts). */
  weight: number;
  classes: Record<string, string>;
}

export const UTILITIES: UtilityDef[] = [
  { id: 'lust', label: 'Lust', weight: 0.3, classes: { Shaman: 'Bloodlust', Mage: 'Time Warp', Evoker: 'Fury of the Aspects', Hunter: 'Primal Rage (pet)' } },
  { id: 'bres', label: 'Battle res', weight: 0.2, classes: { Druid: 'Rebirth', 'Death Knight': 'Raise Ally', Warlock: 'Soulstone', Paladin: 'Intercession' } },
  { id: 'soothe', label: 'Soothe (enrage)', weight: 0.04, classes: { Druid: 'Soothe', Hunter: 'Tranquilizing Shot', Rogue: 'Shiv' } },
  { id: 'curse', label: 'Curse dispel', weight: 0.03, classes: { Mage: 'Remove Curse', Druid: 'Remove Corruption', Shaman: 'Cleanse Spirit', Evoker: 'Cauterizing Flame' } },
  { id: 'poison', label: 'Poison dispel', weight: 0.03, classes: { Druid: 'Remove Corruption', Monk: 'Detox', Paladin: 'Cleanse Toxins', Evoker: 'Expunge', Shaman: 'Poison Cleansing Totem' } },
  { id: 'disease', label: 'Disease dispel', weight: 0.03, classes: { Monk: 'Detox', Paladin: 'Cleanse Toxins', Priest: 'Purify Disease', Evoker: 'Cauterizing Flame' } },
  { id: 'purge', label: 'Purge (magic)', weight: 0.03, classes: { Shaman: 'Purge', Priest: 'Dispel Magic', Mage: 'Spellsteal', 'Demon Hunter': 'Consume Magic', Hunter: 'Tranquilizing Shot' } },
];

// Group-wide buffs/debuffs, one per class -- more different ones is simply better, so these
// score per buff rather than as a single have-it-or-not.
export const GROUP_BUFFS: Record<string, string> = {
  Priest: 'Fortitude',
  Mage: 'Arcane Intellect',
  Warrior: 'Battle Shout',
  Druid: 'Mark of the Wild',
  Shaman: 'Skyfury',
  Evoker: 'Blessing of the Bronze',
  Monk: 'Mystic Touch',
  'Demon Hunter': 'Chaos Brand',
  Hunter: "Hunter's Mark",
  Paladin: 'Devotion Aura',
};
export const GROUP_BUFF_WEIGHT = 0.02;

export interface UtilityCoverage {
  id: UtilityId;
  label: string;
  /** Who in the group brings it, with what. Empty = missing. */
  by: Array<{ name: string; ability: string }>;
}

/** What a group of (name, class) covers, in UTILITIES order, plus its group buffs. */
export function groupUtility(team: Array<{ name: string; class: string }>): { utilities: UtilityCoverage[]; buffs: string[] } {
  return {
    utilities: UTILITIES.map((u) => ({
      id: u.id,
      label: u.label,
      by: team.filter((m) => u.classes[m.class]).map((m) => ({ name: m.name, ability: u.classes[m.class] })),
    })),
    buffs: [...new Set(team.map((m) => GROUP_BUFFS[m.class]).filter((b): b is string => !!b))],
  };
}

/** How much adding this class to a group with these classes improves its utility, in score units. */
export function utilityGain(candidateClass: string, teamClasses: string[]): number {
  let gain = 0;
  for (const u of UTILITIES) {
    if (u.classes[candidateClass] && !teamClasses.some((c) => u.classes[c])) gain += u.weight;
  }
  const buff = GROUP_BUFFS[candidateClass];
  if (buff && !teamClasses.some((c) => GROUP_BUFFS[c] === buff)) gain += GROUP_BUFF_WEIGHT;
  return gain;
}
