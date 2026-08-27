import { describe, expect, it } from 'vitest';
import { DEFAULT_GATES, evaluateGates, applyDeathCap, weightedScore, scoreRaider, rosterSummary, sortWorstFirst, sortBestFirst } from './scoring';
import type { Raider } from './types';

// dps: perf is %-of-the-guild's-minimum-DPS (rescale formula applies).
const baseDps: Raider = {
  name: 'Testrock',
  role: 'dps',
  class: 'Warrior',
  spec: 'Arms',
  rioCurrent: 1500,
  rioHighestThisSeason: 1500,
  ilvlEquipped: 700,
  ilvlHighestThisSeason: 700,
  perf: 100,
  gearCompletion: 90,
  parseTrend: 0,
  deaths: 0,
  nightParse: 60,
};

// healer/tank: perf is a 0-100 percentile within role (no rescale).
const baseHealer: Raider = { ...baseDps, name: 'Testheal', role: 'healer', spec: 'Holy', class: 'Priest', perf: 80 };
const baseTank: Raider = { ...baseDps, name: 'Testtank', role: 'tank', spec: 'Protection', class: 'Warrior', perf: 80 };

describe('evaluateGates', () => {
  it('passes both gates when above threshold', () => {
    const g = evaluateGates(baseDps, DEFAULT_GATES);
    expect(g.ineligible).toBe(false);
    expect(g.rioFail).toBe(false);
    expect(g.ilvlFail).toBe(false);
  });

  it('fails right at the boundary (< gate, not <=)', () => {
    const atGate = evaluateGates({ ...baseDps, rioCurrent: 1000, rioHighestThisSeason: 1000 }, DEFAULT_GATES);
    expect(atGate.rioFail).toBe(false); // exactly at gate passes
    const belowGate = evaluateGates({ ...baseDps, rioCurrent: 999, rioHighestThisSeason: 999 }, DEFAULT_GATES);
    expect(belowGate.rioFail).toBe(true);
  });

  it('uses max(current, highest this season) for both gates', () => {
    const swappedSpec = evaluateGates({ ...baseDps, rioCurrent: 500, rioHighestThisSeason: 1200, ilvlEquipped: 650, ilvlHighestThisSeason: 700 }, DEFAULT_GATES);
    expect(swappedSpec.rioBest).toBe(1200);
    expect(swappedSpec.ilvlBest).toBe(700);
    expect(swappedSpec.ineligible).toBe(false);
  });

  it('flags ineligible when either gate fails', () => {
    const rioOnly = evaluateGates({ ...baseDps, rioCurrent: 500, rioHighestThisSeason: 500 }, DEFAULT_GATES);
    expect(rioOnly.ineligible).toBe(true);
    expect(rioOnly.rioFail).toBe(true);
    expect(rioOnly.ilvlFail).toBe(false);
  });
});

describe('weightedScore', () => {
  it('computes dps perf as a rescale of %-of-minimum-DPS from [80,115] to [0,100]', () => {
    const s = weightedScore({ ...baseDps, perf: 97.5, gearCompletion: 100, parseTrend: 0 }, 'rolled');
    expect(s.perfScore).toBe(50); // (97.5-80)/35*100 = 50
    expect(s.gearScore).toBe(100);
    expect(s.trendScore).toBe(50); // flat trend -> midpoint
    expect(s.score).toBe(Math.round(50 * 0.5 + 100 * 0.3 + 50 * 0.2));
  });

  it('uses healer perf directly as a percentile, not rescaled', () => {
    const s = weightedScore(baseHealer, 'rolled');
    expect(s.perfScore).toBe(80);
  });

  it('uses tank perf directly as a survivability percentile, not rescaled — tanks are never judged on DPS', () => {
    const s = weightedScore(baseTank, 'rolled');
    expect(s.perfScore).toBe(80);
  });

  it('rolled trend uses parseTrend; night trend uses nightParse', () => {
    const rolled = weightedScore({ ...baseDps, parseTrend: 5 }, 'rolled');
    expect(rolled.trendScore).toBe(80); // 50 + 5*6
    const night = weightedScore({ ...baseDps, nightParse: 33 }, 'night');
    expect(night.trendScore).toBe(33);
  });

  it('clamps all three sub-scores to [0,100]', () => {
    const s = weightedScore({ ...baseDps, perf: 1000, gearCompletion: 500, parseTrend: 100 }, 'rolled');
    expect(s.perfScore).toBe(100);
    expect(s.gearScore).toBe(100);
    expect(s.trendScore).toBe(100);
  });
});

describe('applyDeathCap', () => {
  it('leaves band unchanged at 0 deaths', () => {
    expect(applyDeathCap('green', 0)).toBe('green');
    expect(applyDeathCap('yellow', 0)).toBe('yellow');
    expect(applyDeathCap('red', 0)).toBe('red');
  });

  it('caps exactly 1 death: only downgrades green to yellow, leaves yellow/red untouched', () => {
    expect(applyDeathCap('green', 1)).toBe('yellow');
    expect(applyDeathCap('yellow', 1)).toBe('yellow');
    expect(applyDeathCap('red', 1)).toBe('red');
  });

  it('forces red at 2+ deaths regardless of prior band', () => {
    expect(applyDeathCap('green', 2)).toBe('red');
    expect(applyDeathCap('yellow', 3)).toBe('red');
    expect(applyDeathCap('red', 2)).toBe('red');
  });
});

describe('scoreRaider', () => {
  it('ineligibility overrides score and death cap entirely', () => {
    const r = scoreRaider({ ...baseDps, rioCurrent: 100, rioHighestThisSeason: 100, perf: 150, gearCompletion: 100, deaths: 0 }, 'rolled', DEFAULT_GATES);
    expect(r.band).toBe('ineligible');
    expect(r.scored).toBe(false);
    expect(r.score).toBeNull();
  });

  it('precedence is weighted score -> death cap -> gate ineligibility', () => {
    // High score, 2 deaths, but gates clear: death cap forces red, not ineligible.
    const r = scoreRaider({ ...baseDps, perf: 120, gearCompletion: 100, parseTrend: 10, deaths: 2 }, 'rolled', DEFAULT_GATES);
    expect(r.band).toBe('red');
    expect(r.scored).toBe(true);
    expect(typeof r.score).toBe('number');
  });

  it('bands correctly at the configured cutoffs', () => {
    const green = scoreRaider({ ...baseDps, perf: 115, gearCompletion: 100, parseTrend: 5 }, 'rolled', DEFAULT_GATES);
    expect(green.band).toBe('green');
    const red = scoreRaider({ ...baseDps, perf: 80, gearCompletion: 20, parseTrend: -10 }, 'rolled', DEFAULT_GATES);
    expect(red.band).toBe('red');
  });

  it('feedback.breakdown covers all three dimensions, sorted strongest to weakest', () => {
    const r = scoreRaider({ ...baseDps, perf: 115, gearCompletion: 40, parseTrend: 0 }, 'rolled', DEFAULT_GATES);
    const dims = r.feedback.breakdown.map((b) => b.dimension);
    expect(dims).toEqual(['perf', 'trend', 'gear']);
    expect(r.feedback.breakdown[0].verdict).toBe('strong');
    expect(r.feedback.breakdown.find((b) => b.dimension === 'gear')?.verdict).toBe('weak');
  });
});

describe('sorting', () => {
  const rows = [
    scoreRaider({ ...baseDps, name: 'A', perf: 115, gearCompletion: 100, parseTrend: 5 }, 'rolled', DEFAULT_GATES), // green
    scoreRaider({ ...baseDps, name: 'B', perf: 80, gearCompletion: 20, parseTrend: -10 }, 'rolled', DEFAULT_GATES), // red
    scoreRaider({ ...baseDps, name: 'C', rioCurrent: 1, rioHighestThisSeason: 1 }, 'rolled', DEFAULT_GATES), // ineligible
  ];

  it('worst-first orders red, yellow, ineligible, green by severity', () => {
    const sorted = [...rows].sort(sortWorstFirst);
    expect(sorted.map((r) => r.name)).toEqual(['B', 'C', 'A']);
  });

  it('best-first orders by descending score, ineligible (null score) last among ties', () => {
    const sorted = [...rows].sort(sortBestFirst);
    expect(sorted[0].name).toBe('A');
  });
});

describe('rosterSummary', () => {
  it('derives the "Red on damage alone" claim from data instead of hardcoding it', () => {
    const cleanRoster = [
      scoreRaider({ ...baseDps, name: 'A', perf: 115, gearCompletion: 100, parseTrend: 5 }, 'rolled', DEFAULT_GATES),
      scoreRaider({ ...baseDps, name: 'B', perf: 110, gearCompletion: 95, parseTrend: 4 }, 'rolled', DEFAULT_GATES),
    ];
    const clean = rosterSummary(cleanRoster, 'rolled');
    expect(clean.goingWell).toContain('nobody is Red on damage alone');

    // A raider who is Red purely on score (no deaths) must be named, not hidden behind the old hardcoded claim.
    const redRoster = [
      scoreRaider({ ...baseDps, name: 'A', perf: 115, gearCompletion: 100, parseTrend: 5 }, 'rolled', DEFAULT_GATES),
      scoreRaider({ ...baseDps, name: 'Weakling', perf: 80, gearCompletion: 20, parseTrend: -10, deaths: 0 }, 'rolled', DEFAULT_GATES),
    ];
    const withRed = rosterSummary(redRoster, 'rolled');
    expect(withRed.goingWell).toContain('Weakling is Red on damage alone');
    expect(withRed.goingWell).not.toContain('nobody is Red on damage alone');
  });

  it('uses plural "are" when more than one raider is Red on damage alone', () => {
    const rows = [
      scoreRaider({ ...baseDps, name: 'A', perf: 80, gearCompletion: 20, parseTrend: -10, deaths: 0 }, 'rolled', DEFAULT_GATES),
      scoreRaider({ ...baseDps, name: 'B', perf: 80, gearCompletion: 20, parseTrend: -10, deaths: 0 }, 'rolled', DEFAULT_GATES),
    ];
    const summary = rosterSummary(rows, 'rolled');
    expect(summary.goingWell).toContain('A and B are Red on damage alone');
  });

  it('counts bands and computes average over scored rows only', () => {
    const rows = [
      scoreRaider({ ...baseDps, name: 'A', perf: 115, gearCompletion: 100, parseTrend: 5 }, 'rolled', DEFAULT_GATES), // green
      scoreRaider({ ...baseDps, name: 'C', rioCurrent: 1, rioHighestThisSeason: 1 }, 'rolled', DEFAULT_GATES), // ineligible
    ];
    const summary = rosterSummary(rows, 'rolled');
    expect(summary.counts.green).toBe(1);
    expect(summary.counts.ineligible).toBe(1);
    expect(summary.headline).toContain('2 raiders');
  });
});
