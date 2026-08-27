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
