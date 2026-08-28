import { SAMPLE_ROSTER } from './sampleRoster';
import type { Raider } from '../scoring/types';
import type { RealmMismatch } from '../electron';

export interface RosterResult {
  raiders: Raider[];
  fetchedAt: string;
  /** null in sample-data mode — there's no real kill data to report. */
  heroicBossesKilled: number | null;
  source: 'live' | 'sample';
  /** Characters where wowaudit's realm disagrees with what Warcraft Logs' combat log actually shows. Always empty in sample mode. */
  realmMismatches: RealmMismatch[];
}

/**
 * Swappable data-access seam. Everything under src/screens/ imports the roster
 * through getRoster() — never sampleRoster.ts directly.
 *
 * In the Electron build, the real pipeline (Warcraft Logs / Raider.IO / wowaudit /
 * Blizzard) runs in the main process (electron/dataSources/) and is reached over the
 * contextBridge in electron/preload.cjs — credentials never enter this renderer
 * code or ship in a VITE_* env var. If that pipeline isn't fully configured yet
 * (see electron/dataSources/fetchRoster.cjs), or this is running as a plain
 * browser page with no Electron API at all, this falls back to the sample roster
 * so the app never shows a broken half-real, half-fake result.
 */
export async function getRoster(): Promise<RosterResult> {
  if (window.electronAPI) {
    const live = await window.electronAPI.getRoster();
    if (live) return { raiders: live.raiders, fetchedAt: live.fetchedAt, heroicBossesKilled: live.heroicBossesKilled, source: 'live', realmMismatches: live.realmMismatches };
  }
  return { raiders: SAMPLE_ROSTER, fetchedAt: new Date().toISOString(), heroicBossesKilled: null, source: 'sample', realmMismatches: [] };
}
