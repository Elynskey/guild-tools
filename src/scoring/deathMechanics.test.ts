import { describe, expect, it } from 'vitest';
import { buildDeathMechanicsReport, findRepeatOffenders } from './deathMechanics';
import type { ScoredRaider } from './types';

function scoredRaider(name: string, deathCausesInWindow: { boss: string; ability: string }[]): ScoredRaider {
  return {
    name,
    role: 'dps',
    class: 'Warrior',
    spec: 'Arms',
    rioCurrent: 1500,
    rioHighestThisSeason: 1500,
    ilvlEquipped: 700,
    ilvlHighestThisSeason: 700,
    perf: 100,
    gearCompletion: 90,
    gearDetail: null,
    parseTrend: 0,
    deaths: deathCausesInWindow.length,
    pulls: 20,
    deathCauses: deathCausesInWindow,
    nightParse: 60,
    nightDeaths: 0,
    nightPulls: 8,
    nightDeathCauses: [],
    window: 'rolled',
    band: 'green',
    bandLabel: 'Green',
    severity: 3,
    scored: true,
    score: 90,
    scoreParts: { perfScore: 90, gearScore: 90, trendScore: 90, score: 90 },
    rioBest: 1500,
    ilvlBest: 700,
    rioFail: false,
    ilvlFail: false,
    deathCapped: false,
    deathCapNote: '',
    deathsInWindow: deathCausesInWindow.length,
    pullsInWindow: 20,
    deathRate: deathCausesInWindow.length / 20,
    deathCausesInWindow,
    icon: '',
    subline: '',
    feedback: { strongest: 'perf', weakest: 'gear', breakdown: [], status: '', working: '', attention: '', action: '' },
  };
}

describe('buildDeathMechanicsReport', () => {
  it('groups deaths by boss + ability across the whole roster', () => {
    const rows = [
      scoredRaider('A', [{ boss: 'Sszorak', ability: 'Venomous Detonation' }]),
      scoredRaider('B', [{ boss: 'Sszorak', ability: 'Venomous Detonation' }]),
      scoredRaider('C', [{ boss: 'The Twin Fangs', ability: 'Fang Sweep' }]),
    ];
    const report = buildDeathMechanicsReport(rows);
    expect(report).toHaveLength(2);
    expect(report[0]).toMatchObject({ boss: 'Sszorak', ability: 'Venomous Detonation', totalDeaths: 2 });
  });

  it('sorts entries by total deaths descending', () => {
    const rows = [
      scoredRaider('A', [{ boss: 'BossOne', ability: 'X' }]),
      scoredRaider('B', [
        { boss: 'BossTwo', ability: 'Y' },
        { boss: 'BossTwo', ability: 'Y' },
      ]),
    ];
    const report = buildDeathMechanicsReport(rows);
    expect(report[0].boss).toBe('BossTwo');
    expect(report[0].totalDeaths).toBe(2);
  });

  it('sorts each entry\'s byRaider list by count descending', () => {
    const rows = [
      scoredRaider('LowCount', [{ boss: 'Boss', ability: 'Ability' }]),
      scoredRaider('HighCount', [
        { boss: 'Boss', ability: 'Ability' },
        { boss: 'Boss', ability: 'Ability' },
      ]),
    ];
    const report = buildDeathMechanicsReport(rows);
    expect(report[0].byRaider).toEqual([
      { name: 'HighCount', count: 2 },
      { name: 'LowCount', count: 1 },
    ]);
  });

  it('a raider with multiple deaths to the same mechanic counts once per raider entry, not once per death', () => {
    const rows = [
      scoredRaider('A', [
        { boss: 'Boss', ability: 'Ability' },
        { boss: 'Boss', ability: 'Ability' },
        { boss: 'Boss', ability: 'Ability' },
      ]),
    ];
    const report = buildDeathMechanicsReport(rows);
    expect(report[0].totalDeaths).toBe(3);
    expect(report[0].byRaider).toEqual([{ name: 'A', count: 3 }]);
  });

  it('an empty roster or a roster with no deaths returns an empty report', () => {
    expect(buildDeathMechanicsReport([])).toEqual([]);
    expect(buildDeathMechanicsReport([scoredRaider('Clean', [])])).toEqual([]);
  });

  it('includes ineligible/unscored raiders -- a death is a raid fact, not a scoring concern', () => {
    const ineligible = { ...scoredRaider('Bench', [{ boss: 'Boss', ability: 'Ability' }]), scored: false, score: null, band: 'ineligible' as const };
    const report = buildDeathMechanicsReport([ineligible]);
    expect(report[0].totalDeaths).toBe(1);
    expect(report[0].byRaider[0].name).toBe('Bench');
  });
});

describe('findRepeatOffenders', () => {
  it('flags a raider who died to the same mechanic 2+ times, not a single death', () => {
    const rows = [
      scoredRaider('OneOff', [{ boss: 'Boss', ability: 'Ability' }]),
      scoredRaider('Repeat', [
        { boss: 'Boss', ability: 'Ability' },
        { boss: 'Boss', ability: 'Ability' },
      ]),
    ];
    const report = buildDeathMechanicsReport(rows);
    const offenders = findRepeatOffenders(report);
    expect(offenders.map((o) => o.name)).toEqual(['Repeat']);
  });

  it('a raider repeating on multiple different mechanics gets one entry listing all of them', () => {
    const rows = [
      scoredRaider('Multi', [
        { boss: 'BossA', ability: 'AbilityA' },
        { boss: 'BossA', ability: 'AbilityA' },
        { boss: 'BossB', ability: 'AbilityB' },
        { boss: 'BossB', ability: 'AbilityB' },
        { boss: 'BossB', ability: 'AbilityB' },
      ]),
    ];
    const report = buildDeathMechanicsReport(rows);
    const offenders = findRepeatOffenders(report);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].mechanics).toEqual([
      { boss: 'BossB', ability: 'AbilityB', count: 3 },
      { boss: 'BossA', ability: 'AbilityA', count: 2 },
    ]);
  });

  it('sorts raiders with more repeat mechanics first, then by their worst single repeat', () => {
    const rows = [
      scoredRaider('TwoRepeats', [
        { boss: 'BossA', ability: 'X' },
        { boss: 'BossA', ability: 'X' },
        { boss: 'BossB', ability: 'Y' },
        { boss: 'BossB', ability: 'Y' },
      ]),
      scoredRaider('OneBigRepeat', [
        { boss: 'BossC', ability: 'Z' },
        { boss: 'BossC', ability: 'Z' },
        { boss: 'BossC', ability: 'Z' },
        { boss: 'BossC', ability: 'Z' },
      ]),
    ];
    const report = buildDeathMechanicsReport(rows);
    const offenders = findRepeatOffenders(report);
    expect(offenders.map((o) => o.name)).toEqual(['TwoRepeats', 'OneBigRepeat']); // 2 distinct mechanics beats 1, even a bigger one
  });

  it('an empty report or one with no repeats returns an empty list', () => {
    expect(findRepeatOffenders([])).toEqual([]);
    const rows = [scoredRaider('OnceEach', [{ boss: 'A', ability: 'X' }])];
    expect(findRepeatOffenders(buildDeathMechanicsReport(rows))).toEqual([]);
  });
});
