import type { Pull } from '../electron';

export interface BossGroup {
  boss: string;
  pulls: Pull[];
}

/** Bosses in first-seen order (matches pull order within the night). */
function bossOrder(pulls: Pull[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const p of pulls) {
    if (!seen.has(p.boss)) {
      seen.add(p.boss);
      order.push(p.boss);
    }
  }
  return order;
}

/** Pulls grouped by boss, in first-seen order (matches pull order within the night). */
export function groupPullsByBoss(pulls: Pull[]): BossGroup[] {
  const byBoss = new Map<string, Pull[]>();
  for (const p of pulls) {
    if (!byBoss.has(p.boss)) byBoss.set(p.boss, []);
    byBoss.get(p.boss)!.push(p);
  }
  return bossOrder(pulls).map((boss) => ({ boss, pulls: byBoss.get(boss)! }));
}

export function formatPullDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface MechanicNeedingWork {
  boss: string;
  ability: string;
  /** What the mechanic actually is. Empty when only raw deaths fed this entry -- no curated reference for that ability yet. */
  what: string;
  /** The action that avoids it. Empty when only raw deaths fed this entry -- no curated reference for that ability yet. */
  fix: string;
  deathCount: number;
  missCount: number;
  raiders: { name: string; count: number }[];
}

// Deaths count for more than survived-but-missed hits -- a death is the mechanic
// actually ending the pull, a miss is a near-miss that didn't. Both feed the same
// ranking so officers see what to drill on, worst first, in one list.
const DEATH_WEIGHT = 3;
const MISS_WEIGHT = 1;
const severity = (e: MechanicNeedingWork) => e.deathCount * DEATH_WEIGHT + e.missCount * MISS_WEIGHT;

function rankMechanics(pulls: Pull[]): MechanicNeedingWork[] {
  // Keyed by boss+ability, not ability alone -- two different bosses could in
  // principle share an ability name, and each boss needs its own grouped entry now.
  const byKey = new Map<string, MechanicNeedingWork>();

  const get = (boss: string, ability: string) => {
    const key = `${boss}::${ability}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { boss, ability, what: '', fix: '', deathCount: 0, missCount: 0, raiders: [] };
      byKey.set(key, entry);
    }
    return entry;
  };
  const bumpRaider = (entry: MechanicNeedingWork, name: string) => {
    const raider = entry.raiders.find((r) => r.name === name);
    if (raider) raider.count += 1;
    else entry.raiders.push({ name, count: 1 });
  };

  // Misses first so a curated what/fix (from the mechanic reference) is in place
  // before any death-only entries get created -- deaths carry no reference text.
  for (const p of pulls) {
    for (const m of p.mechanicMisses) {
      const entry = get(p.boss, m.ability);
      entry.what = m.what;
      entry.fix = m.fix;
      entry.missCount += 1;
      bumpRaider(entry, m.name);
    }
  }
  for (const p of pulls) {
    for (const d of p.deaths) {
      const entry = get(p.boss, d.ability);
      entry.deathCount += 1;
      bumpRaider(entry, d.name);
    }
  }

  const ranked = [...byKey.values()];
  for (const entry of ranked) entry.raiders.sort((a, b) => b.count - a.count);
  ranked.sort((a, b) => severity(b) - severity(a));
  return ranked;
}

export interface BossMechanics {
  boss: string;
  mechanics: MechanicNeedingWork[];
}

/**
 * Mechanics needing the most work, grouped by boss (in the same first-seen order as
 * the pull log below it) so one rough boss doesn't crowd every other fight's misses
 * out of the list -- worst mechanic first within each boss. Framed as a direct
 * "this needs work" list, not a log-review prompt -- the point is telling an officer
 * where to spend practice time, not sending them back into WCL.
 */
export function groupMechanicsNeedingWorkByBoss(pulls: Pull[], topNPerBoss = 5): BossMechanics[] {
  const ranked = rankMechanics(pulls);
  return bossOrder(pulls)
    .map((boss) => ({ boss, mechanics: ranked.filter((m) => m.boss === boss).slice(0, topNPerBoss) }))
    .filter((g) => g.mechanics.length > 0);
}
