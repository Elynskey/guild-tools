/**
 * Raid utility per class -- deliberately class-level, not spec-level, since these
 * particular buffs/debuffs are almost always granted regardless of spec (unlike rotation
 * priority in rotationReference.ts, which is genuinely spec-specific). Covers the
 * long-stable "bring one of each" categories: a Bloodlust/Heroism-equivalent raid
 * cooldown, battle rez (combat resurrection), and the two unique raid-wide damage-taken
 * debuffs. These categories have held for many expansions running, but -- same caveat as
 * rotationReference.ts -- worth spot-checking against the current tier if a class here
 * looks wrong; this is informational only (a badge next to a raid-signup entry to help an
 * officer judge a manual swing), never used to gate or auto-assign anything.
 */
export const RAID_UTILITY: Record<string, string[]> = {
  'Death Knight': ['Battle Rez'],
  'Demon Hunter': ['Chaos Brand'],
  Druid: ['Battle Rez', 'Innervate'],
  Evoker: ['Bloodlust/Heroism'],
  Hunter: [],
  Mage: ['Bloodlust/Heroism'],
  Monk: ['Mystic Touch'],
  Paladin: [],
  Priest: [],
  Rogue: [],
  Shaman: ['Bloodlust/Heroism'],
  Warlock: ['Battle Rez'],
  Warrior: [],
};

/** Utility tags this class brings, or [] if none of the tracked categories apply (still a valid, common case -- not a missing-data signal). */
export function getRaidUtility(className: string): string[] {
  return RAID_UTILITY[className] ?? [];
}

/** Utility tags present among `existing` classes but missing from `candidateClass` -- what a swing would lose if this candidate replaced someone bringing them, with no one else in `existing` covering it. */
export function utilityGainedBy(candidateClass: string, existingClasses: string[]): string[] {
  const covered = new Set(existingClasses.flatMap(getRaidUtility));
  return getRaidUtility(candidateClass).filter((tag) => !covered.has(tag));
}
