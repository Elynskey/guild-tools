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

/** Every utility tag this file tracks, for a raid-wide "do we have X covered at all" check (see raidBuffCoverage below) -- deduped, order matches first appearance in RAID_UTILITY. */
export const ALL_UTILITY_TAGS: string[] = Array.from(new Set(Object.values(RAID_UTILITY).flat()));

/** Which tracked utility tags a roster of classes covers between them, and which are missing entirely. */
export function raidBuffCoverage(classes: string[]): { tag: string; covered: boolean }[] {
  const covered = new Set(classes.flatMap(getRaidUtility));
  return ALL_UTILITY_TAGS.map((tag) => ({ tag, covered: covered.has(tag) }));
}

export type DpsRange = 'melee' | 'ranged' | 'ambiguous';

/**
 * DPS melee/ranged split, by class -- the fallback used when a signup has no spec
 * recorded (signups made before that field existed). Three classes genuinely split
 * their DPS specs between melee and ranged (Hunter: Survival vs Beast
 * Mastery/Marksmanship; Shaman: Enhancement vs Elemental; Druid: Feral vs Balance) --
 * those come back 'ambiguous' rather than a guessed default, since silently picking one
 * would misrepresent the comp to whoever's planning around it. Every other class has
 * exactly one DPS spec, or all of its DPS specs agree, so class alone is enough for them.
 */
const DPS_RANGE: Record<string, DpsRange> = {
  Warrior: 'melee',
  Paladin: 'melee', // only DPS spec: Retribution
  Hunter: 'ambiguous',
  Rogue: 'melee',
  Priest: 'ranged', // only DPS spec: Shadow
  'Death Knight': 'melee',
  Shaman: 'ambiguous',
  Mage: 'ranged',
  Warlock: 'ranged',
  Monk: 'melee', // only DPS spec: Windwalker
  Druid: 'ambiguous',
  'Demon Hunter': 'melee', // only DPS spec: Havoc
  Evoker: 'ranged', // both DPS specs (Devastation, Augmentation) are ranged
};

/** 'ambiguous' for an unrecognized class too -- same "don't guess" reasoning as the three classes that are ambiguous on purpose. */
export function dpsRangeForClass(className: string): DpsRange {
  return DPS_RANGE[className] ?? 'ambiguous';
}

// Melee/ranged by (class, spec) -- resolves the three class-level 'ambiguous' cases
// above precisely, now that the Discord signup flow captures real spec. Spec names
// collide across classes (Frost is a Death Knight melee spec AND a Mage ranged spec),
// so this has to be keyed by class first, not spec name alone.
const DPS_SPEC_RANGE: Record<string, Record<string, DpsRange>> = {
  Warrior: { Arms: 'melee', Fury: 'melee' },
  Paladin: { Retribution: 'melee' },
  Hunter: { 'Beast Mastery': 'ranged', Marksmanship: 'ranged', Survival: 'melee' },
  Rogue: { Assassination: 'melee', Outlaw: 'melee', Subtlety: 'melee' },
  Priest: { Shadow: 'ranged' },
  'Death Knight': { Frost: 'melee', Unholy: 'melee' },
  Shaman: { Elemental: 'ranged', Enhancement: 'melee' },
  Mage: { Arcane: 'ranged', Fire: 'ranged', Frost: 'ranged' },
  Warlock: { Affliction: 'ranged', Demonology: 'ranged', Destruction: 'ranged' },
  Monk: { Windwalker: 'melee' },
  Druid: { Balance: 'ranged', Feral: 'melee' },
  'Demon Hunter': { Havoc: 'melee' },
  Evoker: { Devastation: 'ranged', Augmentation: 'ranged' },
};

/** Prefers the (class, spec) pair when spec is known and recognized; falls back to the class-only heuristic (which may itself be 'ambiguous') otherwise -- never throws on an unrecognized class or spec, just falls through. */
export function dpsRangeForSpec(className: string, specName: string | null): DpsRange {
  const bySpec = specName ? DPS_SPEC_RANGE[className]?.[specName] : undefined;
  return bySpec ?? dpsRangeForClass(className);
}
