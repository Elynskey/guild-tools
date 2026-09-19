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

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.4',
    date: '2026-09-19',
    title: 'Season Loot Report is just your raiders',
    highlights: [
      {
        heading: 'One-night guests are hidden',
        body: 'People who were in a raid group but are not on the roster or in the guild, and only showed up on a single night (pugs and visitors), no longer fill the Season Loot Report. A switch above the table shows them again, tagged Guest.',
      },
      {
        heading: 'Real raiders stay',
        body: 'Everyone on the roster, every guild character, and anyone who raided with the team on two or more nights stays in the report, even if they have since left or gone inactive.',
      },
    ],
  },
  {
    version: '1.1.3',
    date: '2026-09-19',
    title: 'Live loot, DPS that matches Warcraft Logs, and more',
    highlights: [
      {
        heading: 'Loot shows up while you raid, no /reload',
        body: "Need wins reach Loot History within about 10 seconds, with the boss, slot and Normal/Heroic filled in. It needs chat logging and combat logging on at one officer's PC; the addon now turns chat logging on for you.",
      },
      {
        heading: 'DPS and HPS now match Warcraft Logs',
        body: 'Pull Feedback measures over the fight time you were alive, and shows the old "active time" figure beside it. Scores read lower than before for the same play.',
      },
      {
        heading: 'Need cap is counted per difficulty',
        body: '2 Normal + 1 Heroic in one night is within the 2-win cap, so it no longer shows red. The night chips show the split.',
      },
      {
        heading: 'Raid Signups: backups in call-up order, and a channel per post',
        body: 'Each role has a backup order list (first is asked first), the final roster numbers the backups, and every signup post can go to its own Discord channel.',
      },
      {
        heading: 'Optional auto-post of loot to Discord',
        body: 'A switch on Loot History, off by default and shared by all officers. One message per boss, headed by the difficulty.',
      },
    ],
    headsUp: 'On Loot History, press "Update addon now" and type /reload in game to get addon v1.5. Also re-check the Minimum DPS in Settings, since DPS scores now read lower.',
  },
];

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
