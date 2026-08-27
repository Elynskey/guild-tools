import { SAMPLE_MEMBERS } from './sampleProfessions';
import type { ProfessionsResult } from './types';

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
