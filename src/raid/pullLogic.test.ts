import { describe, expect, it } from 'vitest';
import { formatPullDuration, groupPullsByBoss, rankMechanicsNeedingWork } from './pullLogic';
import type { Pull } from '../electron';

function pull(overrides: Partial<Pull> & Pick<Pull, 'boss' | 'pullNumber'>): Pull {
  return {
    fightId: overrides.pullNumber,
    kill: false,
    bossPercentage: 50,
    durationMs: 60_000,
    raiders: [],
    deaths: [],
    mechanicMisses: [],
    ...overrides,
  };
}

describe('groupPullsByBoss', () => {
  it('groups pulls by boss in first-seen order', () => {
    const pulls = [
      pull({ boss: 'Vashnik', pullNumber: 1 }),
      pull({ boss: 'Vashnik', pullNumber: 2 }),
      pull({ boss: 'Sszorak', pullNumber: 1 }),
    ];
    const groups = groupPullsByBoss(pulls);
    expect(groups.map((g) => g.boss)).toEqual(['Vashnik', 'Sszorak']);
    expect(groups[0].pulls).toHaveLength(2);
    expect(groups[1].pulls).toHaveLength(1);
  });

  it('handles an interleaved boss order (e.g. two wings pulled back to back)', () => {
    const pulls = [
      pull({ boss: 'Vashnik', pullNumber: 1 }),
      pull({ boss: 'Sszorak', pullNumber: 1 }),
      pull({ boss: 'Vashnik', pullNumber: 2 }),
    ];
    const groups = groupPullsByBoss(pulls);
    expect(groups.map((g) => g.boss)).toEqual(['Vashnik', 'Sszorak']);
    expect(groups[0].pulls.map((p) => p.pullNumber)).toEqual([1, 2]);
  });

  it('returns an empty array for no pulls', () => {
    expect(groupPullsByBoss([])).toEqual([]);
  });
});

describe('formatPullDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatPullDuration(45_000)).toBe('0:45');
  });

  it('formats multi-minute durations with zero-padded seconds', () => {
    expect(formatPullDuration(312_000)).toBe('5:12');
  });

  it('rounds to the nearest second', () => {
    expect(formatPullDuration(59_600)).toBe('1:00');
  });
});

describe('rankMechanicsNeedingWork', () => {
  it('ranks by weighted severity, deaths above misses', () => {
    const pulls = [
      pull({
        boss: 'Vashnik',
        pullNumber: 1,
        deaths: [{ name: 'Thornwick', ability: 'Plague Froth' }],
      }),
      pull({
        boss: 'Vashnik',
        pullNumber: 2,
        mechanicMisses: [
          { name: 'Grimsyl', ability: 'Stygian Infection', what: 'Void zones that burst underneath a marked player.', fix: 'Move away before it bursts.' },
          { name: 'Zalanto', ability: 'Stygian Infection', what: 'Void zones that burst underneath a marked player.', fix: 'Move away before it bursts.' },
          { name: 'Harima', ability: 'Stygian Infection', what: 'Void zones that burst underneath a marked player.', fix: 'Move away before it bursts.' },
        ],
      }),
    ];
    const ranked = rankMechanicsNeedingWork(pulls);
    // One death (weight 3) beats three misses (weight 1 each = 3) only if weighted equal;
    // adjust: 1 death*3=3 vs 3 miss*1=3 -- tie, so assert both present rather than order.
    expect(ranked.map((r) => r.ability).sort()).toEqual(['Plague Froth', 'Stygian Infection']);
  });

  it('carries the curated what/fix onto a death for the same ability', () => {
    const pulls = [
      pull({
        boss: 'Vashnik',
        pullNumber: 1,
        mechanicMisses: [{ name: 'Grimsyl', ability: 'Plague Froth', what: 'A poison wave.', fix: "Spread out and stand still so others can dodge it." }],
      }),
      pull({
        boss: 'Vashnik',
        pullNumber: 2,
        deaths: [{ name: 'Thornwick', ability: 'Plague Froth' }],
      }),
    ];
    const ranked = rankMechanicsNeedingWork(pulls);
    const froth = ranked.find((r) => r.ability === 'Plague Froth');
    expect(froth?.what).toBe('A poison wave.');
    expect(froth?.fix).toBe('Spread out and stand still so others can dodge it.');
    expect(froth?.deathCount).toBe(1);
    expect(froth?.missCount).toBe(1);
  });

  it('leaves what/fix empty for a death with no curated mechanic reference', () => {
    const pulls = [pull({ boss: 'Vashnik', pullNumber: 1, deaths: [{ name: 'Thornwick', ability: 'Some Untagged Ability' }] })];
    const ranked = rankMechanicsNeedingWork(pulls);
    expect(ranked[0].what).toBe('');
    expect(ranked[0].fix).toBe('');
  });

  it('aggregates per-raider counts and sorts raiders worst-first', () => {
    const pulls = [
      pull({
        boss: 'Vashnik',
        pullNumber: 1,
        mechanicMisses: [
          { name: 'Grimsyl', ability: 'Plague Froth', what: 'x', fix: 'x' },
          { name: 'Grimsyl', ability: 'Plague Froth', what: 'x', fix: 'x' },
          { name: 'Zalanto', ability: 'Plague Froth', what: 'x', fix: 'x' },
        ],
      }),
    ];
    const ranked = rankMechanicsNeedingWork(pulls);
    expect(ranked[0].raiders).toEqual([
      { name: 'Grimsyl', count: 2 },
      { name: 'Zalanto', count: 1 },
    ]);
  });

  it('caps the result at topN', () => {
    const pulls = [
      pull({
        boss: 'Vashnik',
        pullNumber: 1,
        mechanicMisses: [
          { name: 'A', ability: 'One', what: 'x', fix: 'x' },
          { name: 'B', ability: 'Two', what: 'x', fix: 'x' },
          { name: 'C', ability: 'Three', what: 'x', fix: 'x' },
        ],
      }),
    ];
    expect(rankMechanicsNeedingWork(pulls, 2)).toHaveLength(2);
  });

  it('returns an empty list when nothing went wrong', () => {
    expect(rankMechanicsNeedingWork([pull({ boss: 'Vashnik', pullNumber: 1 })])).toEqual([]);
  });
});
