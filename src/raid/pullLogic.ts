import type { Pull } from '../electron';

export interface BossGroup {
  boss: string;
  pulls: Pull[];
}

/** Pulls grouped by boss, in first-seen order (matches pull order within the night). */
export function groupPullsByBoss(pulls: Pull[]): BossGroup[] {
  const order: string[] = [];
  const byBoss = new Map<string, Pull[]>();
  for (const p of pulls) {
    if (!byBoss.has(p.boss)) {
      byBoss.set(p.boss, []);
      order.push(p.boss);
    }
    byBoss.get(p.boss)!.push(p);
  }
  return order.map((boss) => ({ boss, pulls: byBoss.get(boss)! }));
}

export function formatPullDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface MechanicNeedingWork {
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

/**
 * Ranks mechanics by how much they're actually costing the raid across every pull
 * in the window (deaths weighted above survived misses), worst first. Framed as a
 * direct "this needs work" list, not a log-review prompt -- the point is telling an
 * officer where to spend practice time, not sending them back into WCL.
 */
export function rankMechanicsNeedingWork(pulls: Pull[], topN = 5): MechanicNeedingWork[] {
  const byAbility = new Map<string, MechanicNeedingWork>();

  const get = (ability: string) => {
    let entry = byAbility.get(ability);
    if (!entry) {
      entry = { ability, what: '', fix: '', deathCount: 0, missCount: 0, raiders: [] };
      byAbility.set(ability, entry);
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
      const entry = get(m.ability);
      entry.what = m.what;
      entry.fix = m.fix;
      entry.missCount += 1;
      bumpRaider(entry, m.name);
    }
  }
  for (const p of pulls) {
    for (const d of p.deaths) {
      const entry = get(d.ability);
      entry.deathCount += 1;
      bumpRaider(entry, d.name);
    }
  }

  const ranked = [...byAbility.values()];
  for (const entry of ranked) entry.raiders.sort((a, b) => b.count - a.count);
  ranked.sort((a, b) => b.deathCount * DEATH_WEIGHT + b.missCount * MISS_WEIGHT - (a.deathCount * DEATH_WEIGHT + a.missCount * MISS_WEIGHT));
  return ranked.slice(0, topN);
}
