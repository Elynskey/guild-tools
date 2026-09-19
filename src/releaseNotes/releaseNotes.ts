/**
 * "What's new" notes shown once, in a popup, the first time an officer opens a build that
 * has notes they haven't seen (see ReleaseNotesDialog). One entry per release that has
 * something an officer would notice; a release with no entry simply shows no popup.
 *
 * Written for officers who raid, not developers: what changed FOR THEM, no jargon, and
 * anything that needs an action ("re-check your Minimum DPS") called out in `heads-up`.
 * Added by the guild-tools-update skill (stage 5) as part of every release -- keep the
 * newest entry first.
 */
export interface ReleaseNote {
  /** Matches package.json's version for that release, e.g. "1.1.3". */
  version: string;
  /** ISO date the release went out, e.g. "2026-09-20". */
  date: string;
  /** One short line: the theme of the release. */
  title: string;
  /** The changes an officer will notice, most important first. Aim for 3-5. */
  highlights: { heading: string; body: string }[];
  /** Something to do or re-check after updating (a setting, a /reload, ...). Omit if none. */
  headsUp?: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [];

/** Compares dotted numeric versions ("1.10.0" > "1.9.9"); anything non-numeric counts as 0, same tolerance as the updater's isNewer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** The most notes shown at once -- someone who skipped many releases gets the latest few, not a wall. */
export const MAX_NOTES_SHOWN = 3;

/**
 * Which notes to show now, newest first.
 *  - Nothing recorded yet as seen (first launch with this feature, or a fresh install):
 *    just the current version's own entry, if it has one.
 *  - Otherwise every entry newer than what they last saw, up to and including the current
 *    version, so skipping a release doesn't skip its notes.
 * Entries newer than the running build are never shown (a note written for a release that
 * hasn't shipped yet).
 */
export function notesToShow(notes: ReleaseNote[], currentVersion: string, lastSeenVersion: string | null): ReleaseNote[] {
  const upToCurrent = notes.filter((n) => compareVersions(n.version, currentVersion) <= 0);
  const wanted = lastSeenVersion === null ? upToCurrent.filter((n) => compareVersions(n.version, currentVersion) === 0) : upToCurrent.filter((n) => compareVersions(n.version, lastSeenVersion) > 0);
  return wanted.sort((a, b) => compareVersions(b.version, a.version)).slice(0, MAX_NOTES_SHOWN);
}
