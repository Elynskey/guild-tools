import { describe, expect, it } from 'vitest';
import { computeSeasonPercentiles } from './warcraftlogs.cjs';

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
