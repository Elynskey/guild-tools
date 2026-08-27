import { SAMPLE_MEMBERS } from './sampleProfessions';
import type { ProfessionsResult } from './types';
import type { ProfessionsProgress } from '../electron';

/**
 * Swappable data-access seam, same pattern as src/data/rosterSource.ts. Live data
 * comes from Blizzard's Battle.net API via the Electron main process
 * (electron/dataSources/professions.cjs) — the whole active guild, not just the
 * raid-tracked roster. Falls back to sample data if unconfigured or unavailable.
 */
export async function getProfessions(): Promise<ProfessionsResult> {
  if (window.electronAPI) {
    const live = await window.electronAPI.getProfessions();
    if (live) return { members: live.members, fetchedAt: live.fetchedAt, source: 'live' };
  }
  return { members: SAMPLE_MEMBERS, fetchedAt: new Date().toISOString(), source: 'sample' };
}

/** Instant-paint seam: the last successful scan, persisted to disk (electron/dataSources/professionsCache.cjs). */
export async function getCachedProfessions(): Promise<ProfessionsResult | null> {
  if (window.electronAPI) {
    const cached = await window.electronAPI.getCachedProfessions();
    if (cached) return { members: cached.members, fetchedAt: cached.fetchedAt, source: 'live' };
  }
  return null;
}

/** No-op (returns a no-op unsubscribe) outside Electron, e.g. plain-browser/sample-data mode. */
export function subscribeProfessionsProgress(callback: (progress: ProfessionsProgress) => void): () => void {
  if (window.electronAPI) return window.electronAPI.onProfessionsProgress(callback);
  return () => {};
}
