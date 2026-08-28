import { SAMPLE_RAID_NIGHTS, getSamplePullFeedback } from './sampleRaidData';
import type { PullFeedbackResult, RaidNight } from '../electron';

/**
 * Swappable data-access seam, same pattern as src/data/rosterSource.ts. Falls back to
 * fabricated sample data outside Electron or when the live pipeline isn't configured,
 * so the page always renders something instead of a broken empty state.
 */
export async function listRaidNights(): Promise<RaidNight[]> {
  if (window.electronAPI) {
    const live = await window.electronAPI.listRaidNights();
    if (live) return live;
  }
  return SAMPLE_RAID_NIGHTS;
}

export async function getPullFeedback(code: string): Promise<PullFeedbackResult> {
  if (window.electronAPI) {
    const live = await window.electronAPI.getPullFeedback(code);
    if (live) return live;
  }
  return getSamplePullFeedback(code);
}
