import { computeStats } from './scoring';
import type { DeathCause } from './types';

export interface DeathMechanicEntry {
  boss: string;
  ability: string;
  totalDeaths: number;
  byRaider: { name: string; count: number }[]; // sorted desc by count, tie-broken by name
}

/** The only two fields this actually needs -- deliberately narrower than ScoredRaider (which satisfies this structurally, no cast needed) so a caller with just the plain roster (Pull Feedback, no scoring/gates/bands pipeline) can build this too, not only Raider Status. */
export interface DeathMechanicsSource {
  name: string;
  deathCausesInWindow: DeathCause[];
}

/**
 * "Who is dying to what" across the FULL roster (not whatever's currently visible
 * after role/band/search filters), grouped by boss + ability, sorted by frequency.
 * Pure, same reasoning as scoring.ts/directoryLogic.ts — a UI component just renders
 * whatever this returns. Ineligible raiders are included too: a death is a fact about
 * what happened in the raid, not about scoring eligibility.
 */
export function buildDeathMechanicsReport(rows: DeathMechanicsSource[]): DeathMechanicEntry[] {
  const map = new Map<string, DeathMechanicEntry>();
  for (const r of rows) {
    for (const cause of r.deathCausesInWindow) {
      const key = `${cause.boss}::${cause.ability}`;
      let entry = map.get(key);
      if (!entry) {
        entry = { boss: cause.boss, ability: cause.ability, totalDeaths: 0, byRaider: [] };
        map.set(key, entry);
      }
      entry.totalDeaths++;
      const existing = entry.byRaider.find((b) => b.name === r.name);
      if (existing) existing.count++;
      else entry.byRaider.push({ name: r.name, count: 1 });
    }
  }

  const list = [...map.values()];
  for (const entry of list) entry.byRaider.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  // Grouped by boss first (so everything killing the raid on one fight reads together),
  // worst mechanic within that boss still first.
  list.sort((a, b) => a.boss.localeCompare(b.boss) || b.totalDeaths - a.totalDeaths);
  return list;
}

/** The only two fields buildDeathRateComparison needs -- same minimal-interface reasoning as DeathMechanicsSource, so a caller with the plain roster can build this without the scoring/gates/bands pipeline. */
export interface DeathRateSource {
  name: string;
  deathsInWindow: number;
  pullsInWindow: number;
}

export interface DeathRateComparisonRow {
  name: string;
  deathRate: number; // 0-1
  pullsInWindow: number;
  /** Std devs from the roster's own average this window -- same comparison scoring.ts's death cap uses, surfaced here as a ranked list across the whole roster instead of one raider's band. Positive = dying more than average. */
  z: number;
}

/**
 * "Are you dying more or less than everyone else" -- every raider's death rate this
 * window, ranked against the roster's own average (see scoring.ts's
 * computeDeathRateStats, which this shares its math with). Worst (most above
 * average) first. Raiders with no pulls this window are omitted -- no rate to
 * compare.
 */
export function buildDeathRateComparison(rows: DeathRateSource[]): DeathRateComparisonRow[] {
  const withPulls = rows.filter((r) => r.pullsInWindow > 0);
  const stats = computeStats(withPulls.map((r) => r.deathsInWindow / r.pullsInWindow));
  return withPulls
    .map((r) => {
      const deathRate = r.deathsInWindow / r.pullsInWindow;
      return { name: r.name, deathRate, pullsInWindow: r.pullsInWindow, z: stats.stdDev > 0 ? (deathRate - stats.mean) / stats.stdDev : 0 };
    })
    .sort((a, b) => b.z - a.z || b.deathRate - a.deathRate);
}

/** Died to the same mechanic this many times or more -- a pattern, not a one-off mistake. */
export const REPEAT_MECHANIC_THRESHOLD = 2;

export interface RepeatOffender {
  name: string;
  mechanics: { boss: string; ability: string; count: number }[]; // sorted desc by count
}

/**
 * "Who's missing critical mechanics" -- raiders who died to the SAME mechanic
 * REPEAT_MECHANIC_THRESHOLD+ times this window. A single death to something is a
 * mistake; dying to it twice or more is the raid not learning it. Sorted by whoever
 * has the most repeat mechanics, then by their worst single repeat count.
 */
export function findRepeatOffenders(entries: DeathMechanicEntry[]): RepeatOffender[] {
  const byName = new Map<string, RepeatOffender>();
  for (const entry of entries) {
    for (const b of entry.byRaider) {
      if (b.count < REPEAT_MECHANIC_THRESHOLD) continue;
      const existing = byName.get(b.name);
      const mechanic = { boss: entry.boss, ability: entry.ability, count: b.count };
      if (existing) existing.mechanics.push(mechanic);
      else byName.set(b.name, { name: b.name, mechanics: [mechanic] });
    }
  }
  const list = [...byName.values()];
  for (const r of list) r.mechanics.sort((a, b) => b.count - a.count);
  list.sort((a, b) => b.mechanics.length - a.mechanics.length || b.mechanics[0].count - a.mechanics[0].count || a.name.localeCompare(b.name));
  return list;
}
