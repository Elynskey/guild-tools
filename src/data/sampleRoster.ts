import type { DeathCause, GearDetail, MythicPlusRun, Raider } from '../scoring/types';

/**
 * Sample roster — fabricated data for the prototype. Real officer names from the
 * guild, invented numbers. Replace with the real pipeline once it exists; nothing
 * outside rosterSource.ts should import this file directly.
 */
// Fixed tier-to-date/night pull counts for every sample raider -- fabricated data
// doesn't need per-row variance here, just a believable denominator for the death
// rate (deaths column below stays the small per-window counts it already was).
const TIER_PULLS = 24;
const NIGHT_PULLS = 8;

// Real characters don't carry per-slot equipment data in sample mode (there's no
// Blizzard fetch behind fabricated raiders) -- this synthesizes a believable,
// stable-per-name breakdown from gearCompletion so the "missing gems/enchants"
// dropdown has something to show in browser-preview mode. Real data replaces this
// entirely once bnet.cjs's computeGearDetail runs against an actual character.
const ENCHANTABLE_SLOT_NAMES = ['Back', 'Chest', 'Wrist', 'Legs', 'Feet', 'Ring 1', 'Ring 2', 'Main Hand', 'Off Hand'];

function synthesizeGearDetail(name: string, gearCompletion: number): GearDetail {
  if (gearCompletion >= 100) return { missingEnchants: [], emptySockets: 0, totalSockets: 2 };
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const gap = 100 - gearCompletion;
  const missingCount = Math.max(1, Math.round((gap / 100) * ENCHANTABLE_SLOT_NAMES.length));
  const missingEnchants = [...new Set(Array.from({ length: missingCount }, (_, i) => ENCHANTABLE_SLOT_NAMES[(hash + i * 7) % ENCHANTABLE_SLOT_NAMES.length]))];
  return { missingEnchants, emptySockets: gap > 25 ? 1 : 0, totalSockets: 2 };
}

// Same "no real Blizzard/Raider.IO fetch behind a fabricated raider" reasoning as
// synthesizeGearDetail -- a believable, stable-per-name run history so the M+ Keys
// screen has something to show in browser-preview mode. Dungeon names are real
// (confirmed live against this tier's actual Raider.IO data), the runs themselves
// are invented. iconUrl/url are left blank -- there's no real per-run asset behind
// fabricated data, and the UI only renders those when non-empty.
const SAMPLE_DUNGEONS = ['Ruby Life Pools', "Kings' Rest", 'The Blinding Vale', 'Operation: Mechagon', 'Priory of the Sacred Flame'];

function synthesizeMythicPlusRuns(name: string, rioCurrent: number): MythicPlusRun[] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const baseLevel = Math.max(2, Math.round(rioCurrent / 130));
  const runCount = 3 + (hash % 4);
  const nowMs = Date.now();
  return Array.from({ length: runCount }, (_, i) => {
    const level = Math.max(2, baseLevel + ((hash + i * 3) % 5) - 2);
    return {
      dungeon: SAMPLE_DUNGEONS[(hash + i) % SAMPLE_DUNGEONS.length],
      level,
      completedAt: new Date(nowMs - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
      score: Math.round(level * 28 + (hash % 20)),
      upgrades: (hash + i) % 4,
      iconUrl: '',
      url: '',
    };
  });
}

// Same "no real WCL fetch behind a fabricated raider" reasoning as synthesizeGearDetail
// -- a believable raw number behind perf so the expanded feedback text ("41,300 HPS,
// guild average 36,800") has something to show in browser-preview mode. Baselines are
// invented, not read from any real season; dps inverts perf's own %-of-minimum against
// a plausible minimum, healer/tank scale perf's 0-100 percentile onto a plausible
// throughput range (tank inverted, since a HIGHER percentile means LESS damage taken).
const SAMPLE_MIN_DPS = 180_000;
const SAMPLE_HEALER_BASELINE_HPS = 34_000;
const SAMPLE_TANK_BASELINE_DTPS = 42_000;

function synthesizePerfRaw(role: Raider['role'], perf: number): number {
  if (role === 'dps') return Math.round((perf / 100) * SAMPLE_MIN_DPS);
  if (role === 'healer') return Math.round(SAMPLE_HEALER_BASELINE_HPS * (0.7 + (perf / 100) * 0.6));
  return Math.round(SAMPLE_TANK_BASELINE_DTPS * (1.3 - (perf / 100) * 0.6));
}

const raider = (
  name: string,
  role: Raider['role'],
  cls: string,
  spec: string,
  rioCurrent: number,
  rioHighestThisSeason: number,
  ilvlEquipped: number,
  ilvlHighestThisSeason: number,
  perf: number,
  gearCompletion: number,
  parseTrend: number,
  deaths: number,
  nightParse: number,
  deathCauses: DeathCause[] = [],
): Raider => ({
  name,
  role,
  class: cls,
  spec,
  rioCurrent,
  rioHighestThisSeason,
  ilvlEquipped,
  ilvlHighestThisSeason,
  mythicPlusRuns: synthesizeMythicPlusRuns(name, rioCurrent),
  perf,
  perfRaw: synthesizePerfRaw(role, perf),
  gearCompletion,
  gearDetail: synthesizeGearDetail(name, gearCompletion),
  // No Blizzard fetch behind fabricated raiders, so no real avatar to show -- RosterRow
  // falls back to the generic spec icon, same as it does for a real character whose
  // profile is hidden or whose portrait fetch failed.
  portraitUrl: null,
  parseTrend,
  deaths,
  pulls: TIER_PULLS,
  deathCauses,
  nightParse,
  nightDeaths: Math.min(deaths, 1),
  nightPulls: NIGHT_PULLS,
  nightDeathCauses: deathCauses.slice(0, 1),
});

export const SAMPLE_ROSTER: Raider[] = [
  // Tank perf/nightParse are survivability percentile (0-100), not DPS-style values —
  // tanks aren't judged on damage output at all.
  raider('Vadailla', 'tank', 'Warrior', 'Protection', 2480, 2480, 709, 709, 88, 100, 3, 0, 81),
  // 4 deaths on 24 pulls (16.7%, in the yellow zone) -- but Ogrimund's score alone
  // already lands Yellow, so the rate is elevated without actually being the thing
  // holding the band down (deathCapped stays false; see Hotchick below for a raider
  // the cap actually changes).
  raider('Ogrimund', 'tank', 'Death Knight', 'Blood', 1620, 1690, 698, 701, 64, 92, 1, 4, 54),
  // 8 deaths on 24 pulls (33.3%, over the red threshold) -- score alone already
  // lands Red here too, same non-capping case as Ogrimund above. Boss names are
  // real (from a live pull of this guild's actual logs); ability names are
  // illustrative, same as the rest of this fabricated sample data.
  raider('Thornwick', 'tank', 'Paladin', 'Protection', 1180, 1210, 691, 693, 42, 78, -2, 8, 38, [
    // Two deaths to the same mechanic demonstrates the "missing a mechanic" flag.
    { boss: 'Sszorak', ability: 'Venomous Detonation' },
    { boss: 'Sszorak', ability: 'Venomous Detonation' },
    { boss: 'The Twin Fangs', ability: 'Fang Sweep' },
  ]),
  raider('Skarnak', 'tank', 'Druid', 'Guardian', 940, 985, 688, 689, 55, 85, 0, 0, 44),
  raider('Perseffonee', 'healer', 'Priest', 'Holy', 2610, 2610, 711, 711, 91, 100, 5, 0, 89),
  raider('Quixxie', 'healer', 'Shaman', 'Restoration', 2050, 2110, 704, 706, 84, 96, 2, 0, 80),
  raider('Ellowyn', 'healer', 'Druid', 'Restoration', 1490, 1530, 697, 699, 61, 74, -3, 1, 58),
  raider('Mirthwin', 'healer', 'Monk', 'Mistweaver', 1320, 1360, 694, 696, 55, 88, 1, 0, 51),
  raider('Halvora', 'healer', 'Paladin', 'Holy', 1010, 1080, 692, 694, 42, 62, -6, 2, 35),
  raider('Duskwren', 'healer', 'Priest', 'Discipline', 1780, 1810, 701, 703, 77, 90, 4, 0, 74),
  raider('Harima', 'dps', 'Mage', 'Frost', 2740, 2740, 712, 712, 114, 100, 6, 0, 93),
  // 5 deaths on 24 pulls (20.8%) is in the yellow zone -- and Hotchick's score alone
  // would land Green, so this is the sample data's one actual cap event (Green held
  // to Yellow), as opposed to Thornwick/Ogrimund above who land in Red/Yellow from
  // score alone regardless of their death rate.
  raider('Hotchick', 'dps', 'Hunter', 'Beast Mastery', 2180, 2200, 707, 708, 106, 100, 3, 5, 77),
  raider('Shortie', 'dps', 'Rogue', 'Subtlety', 1960, 1990, 703, 705, 101, 94, 2, 0, 62),
  raider('Zalanto', 'dps', 'Warlock', 'Destruction', 2260, 2260, 708, 710, 109, 98, 4, 0, 84),
  raider('Addy', 'dps', 'Druid', 'Balance', 1540, 1600, 699, 701, 97, 86, 5, 0, 55),
  raider('Brumblade', 'dps', 'Warrior', 'Fury', 1150, 1180, 693, 695, 92, 70, -1, 1, 41),
  raider('Grimsyl', 'dps', 'Death Knight', 'Unholy', 1420, 1470, 696, 698, 88, 82, -4, 0, 33),
  raider('Mossbeard', 'dps', 'Shaman', 'Elemental', 1030, 1090, 690, 692, 84, 66, -5, 2, 26),
  raider('Kaldresh', 'dps', 'Paladin', 'Retribution', 1680, 1700, 700, 702, 103, 92, 1, 0, 66),
  raider('Sunnivah', 'dps', 'Priest', 'Shadow', 880, 930, 686, 687, 90, 80, 2, 0, 48),
  raider('Bristlebane', 'dps', 'Monk', 'Windwalker', 1260, 1300, 695, 697, 95, 88, 0, 1, 50),
  raider('Verrock', 'dps', 'Hunter', 'Marksmanship', 2040, 2060, 705, 707, 104, 96, 3, 0, 72),
  raider('Nyxaria', 'dps', 'Evoker', 'Devastation', 1590, 1640, 698, 700, 99, 90, 7, 0, 68),
  raider('Dromm', 'dps', 'Warrior', 'Arms', 1120, 1160, 687, 689, 86, 74, -2, 0, 30),
  raider('Fizzlewick', 'dps', 'Mage', 'Fire', 1870, 1900, 702, 704, 100, 84, -1, 0, 57),
  raider('Ashkara', 'dps', 'Rogue', 'Assassination', 1350, 1390, 694, 696, 93, 90, 2, 1, 46),
  raider('Torvyn', 'dps', 'Demon Hunter', 'Havoc', 2120, 2140, 706, 708, 111, 100, 5, 0, 87),
  raider('Selvara', 'dps', 'Warlock', 'Affliction', 1080, 1120, 691, 693, 81, 58, -7, 2, 22),
  raider('Pyreleaf', 'dps', 'Druid', 'Feral', 1470, 1500, 697, 699, 96, 78, 1, 0, 53),
  raider('Brakkus', 'dps', 'Shaman', 'Enhancement', 1240, 1280, 693, 695, 89, 86, 3, 0, 49),
];
