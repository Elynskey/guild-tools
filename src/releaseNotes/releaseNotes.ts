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
    version: '1.1.7',
    date: '2026-09-23',
    title: 'Consumable trades are no longer tracked',
    highlights: [
      {
        heading: 'Flasks, potions, runes and food are ignored in trades',
        body: 'Trades of consumables no longer show up in Loot History, so the trade list is only gear and other loot changing hands. Trades of items nobody tracks were also cleaned out of the shared list.',
      },
      {
        heading: 'Raider Status fits narrow windows',
        body: 'On a narrow window, the Raider Status header wraps and the table scrolls sideways instead of running off the screen.',
      },
    ],
    headsUp: 'On Loot History, press "Update addon now" and type /reload in game to get addon v1.8.',
  },
  {
    version: '1.1.6',
    date: '2026-09-23',
    title: 'Loot that is logged once, with its boss, and shows up faster',
    highlights: [
      {
        heading: 'No more doubled wins or double Discord posts',
        body: 'Each win is now stamped with the time it really happened, and wins that only appear in an old chat log are ignored instead of being counted as new loot. A busy night no longer records or posts the same win twice.',
      },
      {
        heading: '/gtloot is now a window with buttons',
        body: 'Type /gtloot in game to open it: stop or start logging, scan Loot History for missed wins and restart chat logging are buttons, and it shows whether logging and chat logging are on. The old /gtloot on, off, scan and chatlog commands are gone. The addon now shows our crest too.',
      },
      {
        heading: 'Every win and lost roll knows its boss and its drop',
        body: 'The addon now records which boss and which drop each win and lost roll came from. Two officers logging the same raid merge into one list, and someone who rolled Need on two copies of an item is counted twice, as they should be.',
      },
      {
        heading: 'Loot shows up within seconds of your reload',
        body: 'Guild Tools now picks up your addon\'s loot as soon as the game saves it (on /reload or logout), without pressing anything.',
      },
      {
        heading: 'Chat logging status is honest',
        body: 'WoW only writes the chat log when you log out, so a quiet log used to look like "not logging". Loot History now says "on, buffered" when the game reports logging is on.',
      },
    ],
    headsUp: 'On Loot History, press "Update addon now", then restart WoW once so the crest loads (or /reload if you can wait for the crest). Type /gtloot to see the new window.',
  },
  {
    version: '1.1.5',
    date: '2026-09-20',
    title: 'Officers break the Guildie tie, and auto-post moves to Settings',
    highlights: [
      {
        heading: 'Officers break a Guildie of the Month tie',
        body: 'When voting closes with a tie for first, nobody is picked at random. Voting closes, the tied nominees are listed, and an officer chooses the winner. The result shows who chose.',
      },
      {
        heading: 'Anyone in the Discord server can be voted for',
        body: 'A vote can now be a write-in for anyone in the server, not only people with a member role. Voting itself still needs a member role, and bots cannot be picked.',
      },
      {
        heading: 'Auto-post to Discord is on by default, and lives in Settings',
        body: 'The switch moved from Loot History to Settings. It is on for all officers unless someone turns it off, and nothing posts until a loot channel is set. Loot History still shows whether it is on.',
      },
    ],
  },
  {
    version: '1.1.4',
    date: '2026-09-19',
    title: 'Season loot is just your raiders, and chat logging you can verify',
    highlights: [
      {
        heading: 'One-night guests are hidden',
        body: 'People who were in a raid group but are not on the roster or in the guild, and only showed up on a single night (pugs and visitors), no longer fill the Season Loot Report. A switch above the table shows them again, tagged Guest.',
      },
      {
        heading: 'Verify chat logging for the whole raid, and restart it if it is not writing',
        body: 'Press Verify chat logging on Loot History, then say one line in raid or party chat: it lands in every officer log at once, and the card shows who is really writing and who is not. If the game says logging is ON but nothing is written, /gtloot chatlog restarts it. The status card also shows when the last chat line was written instead of just "off", and an officer who wrote in the last 15 minutes still counts as logging through a quiet stretch.',
      },
      {
        heading: 'Real raiders stay',
        body: 'Everyone on the roster, every guild character, and anyone who raided with the team on two or more nights stays in the report, even if they have since left or gone inactive.',
      },
    ],
    headsUp: 'On Loot History, press "Update addon now" and type /reload in game to get addon v1.6 (it adds /gtloot chatlog).',
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
