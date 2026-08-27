import type { ScoredRaider } from './types';

export interface DeathMechanicEntry {
  boss: string;
  ability: string;
  totalDeaths: number;
  byRaider: { name: string; count: number }[]; // sorted desc by count, tie-broken by name
}

/**
 * Roster-wide "who is dying to what" — aggregates every raider's death causes in the
 * active window (deathCausesInWindow already resolves to tier-to-date or the most
 * recent raid night, matching whichever window scoreRaider() was called with), grouped
 * by boss + ability, sorted by frequency. Pure, same reasoning as scoring.ts/
 * directoryLogic.ts — a UI component just renders whatever this returns.
 *
 * Computed off the FULL roster (not whatever's currently visible after role/band/search
 * filters), same as rosterSummary() — this answers "what's actually killing the raid",
 * not "what's killing the raiders currently on screen". Ineligible raiders are included
 * too: a death is a fact about what happened in the raid, not about scoring eligibility.
 */
export function buildDeathMechanicsReport(rows: ScoredRaider[]): DeathMechanicEntry[] {
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
  list.sort((a, b) => b.totalDeaths - a.totalDeaths || a.boss.localeCompare(b.boss));
  return list;
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
