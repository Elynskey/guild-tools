import type { CraftRequest } from './types';

export interface LeaderboardEntry {
  crafter: string;
  count: number;
}

/** Fulfilled requests grouped by who fulfilled them, sorted most-to-fewest. */
export function buildCraftLeaderboard(requests: CraftRequest[]): LeaderboardEntry[] {
  const counts = new Map<string, number>();
  for (const r of requests) {
    if (!r.fulfilled || !r.fulfilledBy) continue;
    counts.set(r.fulfilledBy, (counts.get(r.fulfilledBy) ?? 0) + 1);
  }
  return [...counts.entries()].map(([crafter, count]) => ({ crafter, count })).sort((a, b) => b.count - a.count);
}
