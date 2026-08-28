import type { Pull, PullFeedbackResult, RaidNight } from '../electron';

/**
 * Sample pull-by-pull data for demo mode -- fabricated, matching the shape
 * fetchPullBreakdown() returns for real reports. Nothing outside pullsSource.ts
 * should import this file directly.
 */
export const SAMPLE_RAID_NIGHTS: RaidNight[] = [
  { code: 'sample-night-2', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { code: 'sample-night-1', date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
];

const pull = (p: Pull): Pull => p;

const NIGHT_2: Pull[] = [
  pull({
    fightId: 1,
    pullNumber: 1,
    boss: 'Vashnik the Malignant',
    kill: false,
    bossPercentage: 62.4,
    durationMs: 118_000,
    raiders: [
      { name: 'Vadailla', role: 'tank', metric: 'rankPercent', value: null },
      { name: 'Perseffonee', role: 'healer', metric: 'hps', value: 8420 },
      { name: 'Harima', role: 'dps', metric: 'dps', value: 21800 },
      { name: 'Thornwick', role: 'tank', metric: 'rankPercent', value: null },
    ],
    deaths: [{ name: 'Thornwick', ability: 'Plague Froth' }],
    mechanicMisses: [
      { name: 'Grimsyl', ability: 'Plague Froth', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' },
      { name: 'Zalanto', ability: 'Plague Froth', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' },
    ],
  }),
  pull({
    fightId: 2,
    pullNumber: 2,
    boss: 'Vashnik the Malignant',
    kill: false,
    bossPercentage: 41.1,
    durationMs: 156_000,
    raiders: [
      { name: 'Vadailla', role: 'tank', metric: 'rankPercent', value: null },
      { name: 'Perseffonee', role: 'healer', metric: 'hps', value: 8890 },
      { name: 'Harima', role: 'dps', metric: 'dps', value: 22400 },
      { name: 'Thornwick', role: 'tank', metric: 'rankPercent', value: null },
    ],
    deaths: [],
    mechanicMisses: [{ name: 'Grimsyl', ability: 'Plague Froth', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' }],
  }),
  pull({
    fightId: 3,
    pullNumber: 3,
    boss: 'Vashnik the Malignant',
    kill: true,
    bossPercentage: 0,
    durationMs: 312_000,
    raiders: [
      { name: 'Vadailla', role: 'tank', metric: 'rankPercent', value: 62 },
      { name: 'Perseffonee', role: 'healer', metric: 'hps', value: 9120 },
      { name: 'Harima', role: 'dps', metric: 'dps', value: 23100 },
      { name: 'Thornwick', role: 'tank', metric: 'rankPercent', value: 48 },
    ],
    deaths: [],
    mechanicMisses: [],
  }),
  pull({
    fightId: 4,
    pullNumber: 1,
    boss: 'Sszorak',
    kill: false,
    bossPercentage: 88.0,
    durationMs: 74_000,
    raiders: [
      { name: 'Vadailla', role: 'tank', metric: 'rankPercent', value: null },
      { name: 'Perseffonee', role: 'healer', metric: 'hps', value: 7900 },
      { name: 'Harima', role: 'dps', metric: 'dps', value: 20100 },
    ],
    deaths: [{ name: 'Harima', ability: 'Tempest' }],
    mechanicMisses: [{ name: 'Perseffonee', ability: 'Tempest', what: 'Tornadoes that sweep across the arena.', fix: 'Dodge them.' }],
  }),
];

const NIGHT_1: Pull[] = [
  pull({
    fightId: 1,
    pullNumber: 1,
    boss: 'Vashnik the Malignant',
    kill: false,
    bossPercentage: 74.2,
    durationMs: 95_000,
    raiders: [
      { name: 'Vadailla', role: 'tank', metric: 'rankPercent', value: null },
      { name: 'Perseffonee', role: 'healer', metric: 'hps', value: 8010 },
      { name: 'Harima', role: 'dps', metric: 'dps', value: 20600 },
    ],
    deaths: [],
    mechanicMisses: [{ name: 'Grimsyl', ability: 'Plague Froth', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' }],
  }),
  pull({
    fightId: 2,
    pullNumber: 2,
    boss: 'Vashnik the Malignant',
    kill: true,
    bossPercentage: 0,
    durationMs: 298_000,
    raiders: [
      { name: 'Vadailla', role: 'tank', metric: 'rankPercent', value: 55 },
      { name: 'Perseffonee', role: 'healer', metric: 'hps', value: 8760 },
      { name: 'Harima', role: 'dps', metric: 'dps', value: 22000 },
    ],
    deaths: [],
    mechanicMisses: [],
  }),
];

const NIGHTS: Record<string, Pull[]> = {
  'sample-night-2': NIGHT_2,
  'sample-night-1': NIGHT_1,
};

export function getSamplePullFeedback(code: string): PullFeedbackResult {
  return { pulls: NIGHTS[code] ?? [] };
}
