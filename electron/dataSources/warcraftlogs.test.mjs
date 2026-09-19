import { describe, expect, it } from 'vitest';
import { computeSeasonPercentiles, deadMsByActorId, throughputOverTimeAlive } from './warcraftlogs.cjs';

// Minimal fake "report aggregate" -- computeSeasonPercentiles only ever reads
// agg[metricKey] as a Map<name, value>, so that's all these fixtures need.
function agg(metricKey, values) {
  return { [metricKey]: new Map(Object.entries(values)) };
}

const ROLE = { Sylvara: 'healer', Vadailla: 'healer', Ranikina: 'healer' };
const roleOf = (name) => ROLE[name];

describe('computeSeasonPercentiles', () => {
  it('compares same-spec+class peers against each other when there are 2+ of them', () => {
    const CLASS = { Sylvara: 'Restoration Shaman', Vadailla: 'Restoration Shaman', Ranikina: 'Restoration Druid' };
    const classOf = (name) => CLASS[name];
    const aggregates = [
      agg('hps', { Sylvara: 42000, Vadailla: 38000, Ranikina: 30000 }),
      agg('hps', { Sylvara: 40000, Vadailla: 39000, Ranikina: 31000 }),
    ];

    const { percentile, basis } = computeSeasonPercentiles(aggregates, 'hps', 'healer', roleOf, true, classOf);

    // The two Restoration Shaman get scoped to each other, not the Druid.
    expect(basis.get('Sylvara')).toEqual({ scope: 'class', className: 'Restoration Shaman', peerCount: 1 });
    expect(basis.get('Vadailla')).toEqual({ scope: 'class', className: 'Restoration Shaman', peerCount: 1 });
    // Sylvara's raw average (41000) is higher than Vadailla's (38500) -- within their
    // own two-person pool she should score above the midpoint, Vadailla below it.
    expect(percentile.get('Sylvara')).toBeGreaterThan(50);
    expect(percentile.get('Vadailla')).toBeLessThan(50);

    // Ranikina is the only Restoration Druid -- nobody to compare against in-class,
    // so she falls back to the whole healer pool (all 3, so 2 other healers).
    expect(basis.get('Ranikina')).toEqual({ scope: 'role', className: null, peerCount: 2 });
  });

  it('falls back to the whole-role pool for everyone when classOf is omitted (backward compatible)', () => {
    const aggregates = [agg('hps', { Sylvara: 42000, Vadailla: 38000, Ranikina: 30000 })];
    const { basis } = computeSeasonPercentiles(aggregates, 'hps', 'healer', roleOf, true);
    for (const name of ['Sylvara', 'Vadailla', 'Ranikina']) {
      expect(basis.get(name)).toEqual({ scope: 'role', className: null, peerCount: 2 });
    }
  });

  it('gives the only person in a role 100 with nothing to compare against', () => {
    const aggregates = [agg('hps', { Sylvara: 42000 })];
    const soloRoleOf = () => 'healer';
    const { percentile, basis } = computeSeasonPercentiles(aggregates, 'hps', 'healer', soloRoleOf, true);
    expect(percentile.get('Sylvara')).toBe(100);
    expect(basis.get('Sylvara')).toEqual({ scope: 'role', className: null, peerCount: 0 });
  });

  it('gives everyone 50 when there is no spread in the data at all', () => {
    const aggregates = [agg('hps', { Sylvara: 40000, Vadailla: 40000, Ranikina: 40000 })];
    const { percentile } = computeSeasonPercentiles(aggregates, 'hps', 'healer', roleOf, true);
    expect(percentile.get('Sylvara')).toBe(50);
    expect(percentile.get('Vadailla')).toBe(50);
    expect(percentile.get('Ranikina')).toBe(50);
  });

  it('only counts DISTINCT raiders as class peers, not extra logged nights from the same person', () => {
    // Sylvara alone, logged across 3 reports -- still just one Restoration Shaman,
    // so she must fall back to the role pool, not be treated as having peers.
    const CLASS = { Sylvara: 'Restoration Shaman', Ranikina: 'Restoration Druid' };
    const classOf = (name) => CLASS[name];
    const aggregates = [
      agg('hps', { Sylvara: 40000, Ranikina: 30000 }),
      agg('hps', { Sylvara: 41000, Ranikina: 31000 }),
      agg('hps', { Sylvara: 39000, Ranikina: 32000 }),
    ];
    const { basis } = computeSeasonPercentiles(aggregates, 'hps', 'healer', roleOf, true, classOf);
    expect(basis.get('Sylvara')).toEqual({ scope: 'role', className: null, peerCount: 1 });
  });

  it('lower-is-better (tank damage taken) still favors the lower raw number within a class pool', () => {
    const CLASS = { Devkra: 'Blood Death Knight', Narima: 'Blood Death Knight' };
    const classOf = (name) => CLASS[name];
    const tankRoleOf = () => 'tank';
    const aggregates = [agg('damageTaken', { Devkra: 50000, Narima: 70000 })];
    const { percentile, basis } = computeSeasonPercentiles(aggregates, 'damageTaken', 'tank', tankRoleOf, false, classOf);
    expect(basis.get('Devkra')).toEqual({ scope: 'class', className: 'Blood Death Knight', peerCount: 1 });
    // Devkra took LESS damage (50000 < 70000) and lower is better here, so he should
    // score above the midpoint, Narima below.
    expect(percentile.get('Devkra')).toBeGreaterThan(50);
    expect(percentile.get('Narima')).toBeLessThan(50);
  });
});

// Fixtures mirror the real 9/18 Ula'tek kill (report 69YPhG2bZXKJQLc7, fight 8, 439s):
// timestamps are report-relative ms on the same clock as the fight's start/end.
const FIGHT_START = 3515205;
const FIGHT_END = 3954090;
const DURATION = FIGHT_END - FIGHT_START;

describe('deadMsByActorId', () => {
  it('counts death -> fight end for someone who never got rezzed', () => {
    const dead = deadMsByActorId([{ id: 3, timestamp: 3763632 }], [], FIGHT_END);
    expect(dead.get(3)).toBe(FIGHT_END - 3763632);
  });

  it('counts death -> rez, then rez -> next death is alive time (a battle-rezzed raider)', () => {
    // Quinnter: died 3764331, rezzed 3878831, died again 3912879 and stayed dead.
    const deaths = [
      { id: 8, timestamp: 3764331 },
      { id: 8, timestamp: 3912879 },
    ];
    const rezzes = [{ targetID: 8, timestamp: 3878831 }];
    const dead = deadMsByActorId(deaths, rezzes, FIGHT_END);
    expect(dead.get(8)).toBe(3878831 - 3764331 + (FIGHT_END - 3912879));
  });

  it('does not let a rez for one actor resurrect someone else', () => {
    const dead = deadMsByActorId([{ id: 1, timestamp: 3600000 }], [{ targetID: 2, timestamp: 3610000 }], FIGHT_END);
    expect(dead.get(1)).toBe(FIGHT_END - 3600000);
  });

  it('ignores anyone who never died', () => {
    expect(deadMsByActorId([], [], FIGHT_END).size).toBe(0);
  });
});

describe('throughputOverTimeAlive', () => {
  const noDeaths = new Map();

  it('divides by the whole fight for someone who lived (matches Warcraft Logs Summary DPS)', () => {
    // Odasa: 44,324,733 over the 438.9s kill -> WCL showed 100,994.0
    const dps = throughputOverTimeAlive([{ durationMs: DURATION, entries: [{ name: 'Odasa', id: 1, total: 44324733 }], deadMsById: noDeaths }]);
    expect(Math.round(dps.get('Odasa'))).toBe(100994);
  });

  it('divides by time alive only, so dying does not shrink the number the way a whole-fight divisor would', () => {
    const deadMs = FIGHT_END - 3763632; // Bubble died at 248s and stayed down
    const withDeath = throughputOverTimeAlive([{ durationMs: DURATION, entries: [{ name: 'Bubble', id: 5, total: 22974892 }], deadMsById: new Map([[5, deadMs]]) }]);
    const wholeFight = 22974892 / (DURATION / 1000);
    expect(withDeath.get('Bubble')).toBeGreaterThan(wholeFight);
    expect(Math.round(withDeath.get('Bubble'))).toBe(Math.round(22974892 / ((DURATION - deadMs) / 1000)));
  });

  it('only counts alive time from fights the player appears in (sitting a boss out is not a penalty)', () => {
    const dps = throughputOverTimeAlive([
      { durationMs: 400000, entries: [{ name: 'A', id: 1, total: 4000000 }], deadMsById: noDeaths },
      { durationMs: 400000, entries: [{ name: 'B', id: 2, total: 4000000 }], deadMsById: noDeaths }, // A sat this one out
    ]);
    expect(dps.get('A')).toBe(10000);
  });

  it('gives alive-time credit once per name per fight even with duplicate rows (same-named pets)', () => {
    const dps = throughputOverTimeAlive([{ durationMs: 100000, entries: [{ name: 'A', id: 1, total: 500000 }, { name: 'A', id: 9, total: 500000 }], deadMsById: noDeaths }]);
    expect(dps.get('A')).toBe(10000); // 1,000,000 / 100s, not / 200s
  });

  it('reports 0 for someone dead the whole fight instead of dividing by zero', () => {
    const dps = throughputOverTimeAlive([{ durationMs: 100000, entries: [{ name: 'A', id: 1, total: 1000 }], deadMsById: new Map([[1, 100000]]) }]);
    expect(dps.get('A')).toBe(0);
  });
});
