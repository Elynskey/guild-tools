import type { Raider } from '../scoring/types';

/**
 * Sample roster — fabricated data for the prototype. Real officer names from the
 * guild, invented numbers. Replace with the real pipeline once it exists; nothing
 * outside rosterSource.ts should import this file directly.
 */
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
): Raider => ({ name, role, class: cls, spec, rioCurrent, rioHighestThisSeason, ilvlEquipped, ilvlHighestThisSeason, perf, gearCompletion, parseTrend, deaths, nightParse });

export const SAMPLE_ROSTER: Raider[] = [
  // Tank perf/nightParse are survivability percentile (0-100), not DPS-style values —
  // tanks aren't judged on damage output at all.
  raider('Vadailla', 'tank', 'Warrior', 'Protection', 2480, 2480, 709, 709, 88, 100, 3, 0, 81),
  raider('Ogrimund', 'tank', 'Death Knight', 'Blood', 1620, 1690, 698, 701, 64, 92, 1, 1, 54),
  raider('Thornwick', 'tank', 'Paladin', 'Protection', 1180, 1210, 691, 693, 42, 78, -2, 2, 38),
  raider('Skarnak', 'tank', 'Druid', 'Guardian', 940, 985, 688, 689, 55, 85, 0, 0, 44),
  raider('Perseffonee', 'healer', 'Priest', 'Holy', 2610, 2610, 711, 711, 91, 100, 5, 0, 89),
  raider('Quixxie', 'healer', 'Shaman', 'Restoration', 2050, 2110, 704, 706, 84, 96, 2, 0, 80),
  raider('Ellowyn', 'healer', 'Druid', 'Restoration', 1490, 1530, 697, 699, 61, 74, -3, 1, 58),
  raider('Mirthwin', 'healer', 'Monk', 'Mistweaver', 1320, 1360, 694, 696, 55, 88, 1, 0, 51),
  raider('Halvora', 'healer', 'Paladin', 'Holy', 1010, 1080, 692, 694, 42, 62, -6, 2, 35),
  raider('Duskwren', 'healer', 'Priest', 'Discipline', 1780, 1810, 701, 703, 77, 90, 4, 0, 74),
  raider('Harima', 'dps', 'Mage', 'Frost', 2740, 2740, 712, 712, 114, 100, 6, 0, 93),
  raider('Hotchick', 'dps', 'Hunter', 'Beast Mastery', 2180, 2200, 707, 708, 106, 100, 3, 0, 77),
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
