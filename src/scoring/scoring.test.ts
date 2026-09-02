import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GATES,
  DEATH_RATE_YELLOW_SIGMA,
  DEATH_RATE_RED_SIGMA,
  evaluateGates,
  applyDeathCap,
  computeStats,
  weightedScore,
  scoreRaider,
  scoreRoster,
  rosterSummary,
  sortWorstFirst,
  sortBestFirst,
} from './scoring';
import type { DeathRateStats } from './scoring';
import type { Raider } from './types';

// dps: perf is %-of-the-guild's-minimum-DPS (rescale formula applies).
// pulls/nightPulls give deaths a denominator -- 20 tier pulls, 8 night pulls, so
// tests can express "2 deaths" as an intentional rate (2/20 = 10%, under the
// 15% yellow threshold) rather than an ambiguous raw count.
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
  perfRaw: null,
  gearCompletion: 90,
  gearDetail: null,
  portraitUrl: null,
  mythicPlusRuns: [],
  parseTrend: 0,
  deaths: 0,
  pulls: 20,
  deathCauses: [],
  nightParse: 60,
  nightDeaths: 0,
  nightPulls: 8,
  nightDeathCauses: [],
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

// applyDeathCap's second argument is a z-score (std devs from the roster's own
// average death rate this window, see computeDeathRateStats) since the cap is
// relative to the guild, not a fixed percentage -- see scoring.ts's comment above
// DEATH_RATE_YELLOW_SIGMA/DEATH_RATE_RED_SIGMA.
describe('applyDeathCap', () => {
  it('leaves band unchanged at exactly the guild average (z = 0)', () => {
    expect(applyDeathCap('green', 0)).toBe('green');
    expect(applyDeathCap('yellow', 0)).toBe('yellow');
    expect(applyDeathCap('red', 0)).toBe('red');
  });

  it('never caps for dying LESS than the guild average, however far below', () => {
    expect(applyDeathCap('green', -3)).toBe('green');
  });

  it('leaves band unchanged within 1 std dev above average', () => {
    expect(applyDeathCap('green', 0.9)).toBe('green');
  });

  it('caps a z-score just over the yellow sigma: only downgrades green to yellow, leaves yellow/red untouched', () => {
    expect(applyDeathCap('green', 1.1)).toBe('yellow');
    expect(applyDeathCap('yellow', 1.1)).toBe('yellow');
    expect(applyDeathCap('red', 1.1)).toBe('red');
  });

  it('leaves band unchanged exactly at the yellow sigma (boundary is exclusive)', () => {
    expect(applyDeathCap('green', DEATH_RATE_YELLOW_SIGMA)).toBe('green');
  });

  it('forces red above the red sigma regardless of prior band', () => {
    expect(applyDeathCap('green', 2.1)).toBe('red');
    expect(applyDeathCap('yellow', 5)).toBe('red');
    expect(applyDeathCap('red', 2.1)).toBe('red');
  });

  it('leaves band unchanged exactly at the red sigma (boundary is exclusive)', () => {
    expect(applyDeathCap('yellow', DEATH_RATE_RED_SIGMA)).toBe('yellow');
  });
});

describe('computeStats', () => {
  it('computes the population mean and standard deviation of a set of rates', () => {
    const s = computeStats([0, 0.1, 0.2]);
    expect(s.mean).toBeCloseTo(0.1, 5);
    expect(s.stdDev).toBeCloseTo(0.0816, 3);
  });

  it('returns zeroed stats for an empty set -- nothing to compare against', () => {
    expect(computeStats([])).toEqual({ mean: 0, stdDev: 0 });
  });

  it('a set with no spread has zero std dev', () => {
    const s = computeStats([0.2, 0.2, 0.2]);
    expect(s.mean).toBeCloseTo(0.2, 10);
    expect(s.stdDev).toBeCloseTo(0, 10);
  });
});

describe('scoreRaider', () => {
  it('ineligibility overrides score and death cap entirely', () => {
    const r = scoreRaider({ ...baseDps, rioCurrent: 100, rioHighestThisSeason: 100, perf: 150, gearCompletion: 100, deaths: 0 }, 'rolled', DEFAULT_GATES);
    expect(r.band).toBe('ineligible');
    expect(r.scored).toBe(false);
    expect(r.score).toBeNull();
  });

  // scoreRaider's 4th arg is the roster's death-rate mean/std-dev for the window
  // (see computeDeathRateStats) -- omitting it (as the ineligibility test above
  // does) means no peer comparison, so the cap never triggers. These fixtures
  // stand in for a guild where most people rarely die (mean 5%, std dev 3pts),
  // making a 35% rate a clear outlier (z ~= 10, past DEATH_RATE_RED_SIGMA) and a
  // 20% rate a lesser one (z = 1.5, between the yellow and red sigma) -- picked to
  // reproduce the same "yellow zone" vs "red zone" narrative the old fixed
  // 15%/30% thresholds tested, now expressed relative to a peer group.
  const redZoneStats: DeathRateStats = { mean: 0.05, stdDev: 0.03 };
  const yellowZoneStats: DeathRateStats = { mean: 0.05, stdDev: 0.1 };

  it('precedence is weighted score -> death cap -> gate ineligibility', () => {
    // High score, 7 deaths on 20 pulls (35%, a clear outlier against redZoneStats),
    // but gates clear: death cap forces red, not ineligible.
    const r = scoreRaider({ ...baseDps, perf: 120, gearCompletion: 100, parseTrend: 10, deaths: 7, pulls: 20 }, 'rolled', DEFAULT_GATES, redZoneStats);
    expect(r.band).toBe('red');
    expect(r.scored).toBe(true);
    expect(typeof r.score).toBe('number');
    expect(r.deathCapped).toBe(true);
  });

  it('death cap is window-scoped: night uses nightDeaths/nightPulls, rolled uses deaths/pulls', () => {
    const raider = { ...baseDps, perf: 120, gearCompletion: 100, deaths: 7, pulls: 20, nightDeaths: 0, nightPulls: 8 };
    expect(scoreRaider(raider, 'rolled', DEFAULT_GATES, redZoneStats).band).toBe('red'); // 7/20 = 35%, z ~= 10
    expect(scoreRaider(raider, 'night', DEFAULT_GATES, redZoneStats).band).toBe('green'); // 0/8 = 0%, below average, no cap
  });

  it('deathCapped reflects whether the cap actually changed the band, not just "any deaths"', () => {
    // Already Red on score alone; a death rate in the yellow zone doesn't "cap" anything further.
    const r = scoreRaider({ ...baseDps, perf: 80, gearCompletion: 20, parseTrend: -10, deaths: 4, pulls: 20 }, 'rolled', DEFAULT_GATES, yellowZoneStats);
    expect(r.band).toBe('red');
    expect(r.deathCapped).toBe(false);
  });

  it('death-cap feedback names the actual mechanic when Warcraft Logs has a cause on record', () => {
    const r = scoreRaider(
      { ...baseDps, perf: 80, gearCompletion: 20, parseTrend: -10, deaths: 7, pulls: 20, deathCauses: [{ boss: 'Sszorak', ability: 'Venomous Detonation' }] },
      'rolled',
      DEFAULT_GATES,
      redZoneStats,
    );
    expect(r.feedback.status).toContain('Venomous Detonation on Sszorak');
    expect(r.feedback.attention).toContain('Venomous Detonation on Sszorak');
    expect(r.feedback.action).toContain('Sszorak');
    // The generic "watch a log with an officer" phrasing should not appear once a real cause is known.
    expect(r.feedback.action).not.toContain('Survivability only this week');
    expect(r.feedback.action).not.toContain('One mechanic, one pull');
  });

  it('death-cap feedback falls back to generic phrasing when no cause is on record', () => {
    const r = scoreRaider({ ...baseDps, perf: 80, gearCompletion: 20, parseTrend: -10, deaths: 7, pulls: 20, deathCauses: [] }, 'rolled', DEFAULT_GATES, redZoneStats);
    expect(r.feedback.status).not.toContain('most recently');
    expect(['Survivability only this week. The damage is already there.', 'One mechanic, one pull, with an officer before Saturday. Nothing else.']).toContain(r.feedback.action);
  });

  it('death-cause feedback is window-scoped, same as the death rate itself', () => {
    // perf/gear are strong enough to score Green in both windows on their own (perf and
    // gearCompletion apply to both) -- isolates the death cap/cause as the only variable.
    const raider = {
      ...baseDps,
      perf: 115,
      gearCompletion: 100,
      parseTrend: 5,
      deaths: 7,
      pulls: 20,
      deathCauses: [{ boss: 'Sszorak', ability: 'Venomous Detonation' }],
      nightParse: 90,
      nightDeaths: 0,
      nightPulls: 8,
      nightDeathCauses: [],
    };
    // Tier-to-date: 7/20 (35%, z ~= 10 against redZoneStats) forces Red via the cap despite a green-worthy score.
    const rolledResult = scoreRaider(raider, 'rolled', DEFAULT_GATES, redZoneStats);
    expect(rolledResult.band).toBe('red');
    expect(rolledResult.feedback.action).toContain('Sszorak');
    // Clean that night (0/8, below average, no cap at all) -- the tier-wide cause must not leak into a green-band raider's feedback.
    const nightResult = scoreRaider(raider, 'night', DEFAULT_GATES, redZoneStats);
    expect(nightResult.band).toBe('green');
    expect(nightResult.feedback.action).not.toContain('Sszorak');
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

// No peer death-rate comparison needed for these perfRaw-focused tests --
// EMPTY_DEATH_STATS keeps the death cap a no-op so it can't interfere.
const EMPTY_DEATH_STATS: DeathRateStats = { mean: 0, stdDev: 0 };

describe('perfRaw context (why the percentile/trend is what it is)', () => {
  it('folds the raw metric and role average into the perf dimension text and value when perfRaw is known', () => {
    const healer = scoreRaider({ ...baseHealer, perf: 72, perfRaw: 41300 }, 'rolled', DEFAULT_GATES, EMPTY_DEATH_STATS, 36800);
    const perfDim = healer.feedback.breakdown.find((b) => b.dimension === 'perf')!;
    expect(perfDim.value).toContain('41,300');
    expect(perfDim.text).toContain('41,300 HPS');
    expect(perfDim.text).toContain('guild average 36,800');
  });

  it('omits the raw-metric parenthetical entirely when perfRaw is unavailable, rather than showing a hole', () => {
    const healer = scoreRaider({ ...baseHealer, perf: 72, perfRaw: null }, 'rolled', DEFAULT_GATES);
    const perfDim = healer.feedback.breakdown.find((b) => b.dimension === 'perf')!;
    expect(perfDim.value).not.toContain('(');
    expect(perfDim.text).not.toContain('guild average');
  });

  it('tank raw metric is labeled "damage taken/s", not DPS or HPS', () => {
    const tank = scoreRaider({ ...baseTank, perf: 65, perfRaw: 38900 }, 'rolled', DEFAULT_GATES, EMPTY_DEATH_STATS, 40200);
    const perfDim = tank.feedback.breakdown.find((b) => b.dimension === 'perf')!;
    expect(perfDim.text).toContain('38,900 damage taken/s');
  });

  it('dps raw metric is labeled DPS and sits alongside the existing %-of-minimum framing', () => {
    const dps = scoreRaider({ ...baseDps, perf: 114, perfRaw: 214500 }, 'rolled', DEFAULT_GATES, EMPTY_DEATH_STATS, 188000);
    const perfDim = dps.feedback.breakdown.find((b) => b.dimension === 'perf')!;
    expect(perfDim.text).toContain('114% of the guild');
    expect(perfDim.text).toContain('214,500 DPS');
    expect(perfDim.text).toContain('guild average 188,000');
  });
});

describe('scoreRoster', () => {
  it('computes perfRawAvg per role and feeds it to every raider of that role, excluding other roles and nulls', () => {
    const roster: Raider[] = [
      { ...baseHealer, name: 'H1', perfRaw: 30000 },
      { ...baseHealer, name: 'H2', perfRaw: 40000 },
      { ...baseHealer, name: 'H3', perfRaw: null }, // excluded from the average, still gets one back
      { ...baseDps, name: 'D1', perfRaw: 200000 }, // different role -- must not leak into the healer average
    ];
    const scored = scoreRoster(roster, 'rolled', DEFAULT_GATES);
    const byName = new Map(scored.map((r) => [r.name, r]));
    expect(byName.get('H1')!.perfRawAvg).toBe(35000);
    expect(byName.get('H2')!.perfRawAvg).toBe(35000);
    expect(byName.get('H3')!.perfRawAvg).toBe(35000);
    expect(byName.get('D1')!.perfRawAvg).toBe(200000);
  });

  it('perfRawAvg is null for a role where nobody has a perfRaw value', () => {
    const roster: Raider[] = [{ ...baseTank, name: 'T1', perfRaw: null }];
    const scored = scoreRoster(roster, 'rolled', DEFAULT_GATES);
    expect(scored[0].perfRawAvg).toBeNull();
  });

  it('caps a raider dying well above the roster average, but not one dying below it -- "are you dying more or less than everyone else"', () => {
    // 5 raiders at a steady 5% plus one outlier at 50% -- enough peers that the
    // outlier doesn't itself drag the mean/std-dev up far enough to mask its own
    // z-score (the same small-n distortion warcraftlogs.cjs's percentile math has
    // to guard against; too few peers and the "outlier" barely reads as one).
    const roster: Raider[] = [
      { ...baseDps, name: 'Average1', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 1, pulls: 20 }, // 5%
      { ...baseDps, name: 'Average2', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 1, pulls: 20 }, // 5%
      { ...baseDps, name: 'Average3', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 1, pulls: 20 }, // 5%
      { ...baseDps, name: 'Average4', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 1, pulls: 20 }, // 5%
      { ...baseDps, name: 'Average5', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 1, pulls: 20 }, // 5%
      { ...baseDps, name: 'Outlier', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 10, pulls: 20 }, // 50%, way above the rest
    ];
    const scored = scoreRoster(roster, 'rolled', DEFAULT_GATES);
    const outlier = scored.find((r) => r.name === 'Outlier')!;
    const average = scored.find((r) => r.name === 'Average1')!;
    expect(outlier.deathRateZ).toBeGreaterThan(DEATH_RATE_RED_SIGMA);
    expect(outlier.band).toBe('red');
    expect(outlier.deathCapped).toBe(true);
    expect(average.deathRateZ).toBeLessThan(0); // below the roster's own average
    expect(average.deathCapped).toBe(false);
    expect(average.band).toBe('green');
  });

  it('a roster with identical death rates has zero spread -- nobody is capped even if everyone dies constantly', () => {
    const roster: Raider[] = [
      { ...baseDps, name: 'A', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 10, pulls: 20 },
      { ...baseDps, name: 'B', perf: 115, gearCompletion: 100, parseTrend: 5, deaths: 10, pulls: 20 },
    ];
    const scored = scoreRoster(roster, 'rolled', DEFAULT_GATES);
    expect(scored.every((r) => r.deathRateZ === 0 && r.band === 'green')).toBe(true);
  });

  it('deathRateAvg on every scored raider matches the roster-wide average, for display alongside their own rate', () => {
    const roster: Raider[] = [
      { ...baseDps, name: 'A', deaths: 0, pulls: 20 }, // 0%
      { ...baseDps, name: 'B', deaths: 4, pulls: 20 }, // 20%
    ];
    const scored = scoreRoster(roster, 'rolled', DEFAULT_GATES);
    expect(scored.every((r) => r.deathRateAvg === 0.1)).toBe(true); // (0 + 0.2) / 2
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
