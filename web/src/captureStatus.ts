import type { HeartbeatRow, StoredLootRecord } from './api';

/**
 * "Is loot being captured right now, and did it reach Discord?" for the phone, judged from what the shared server can see:
 * which officers' apps are reporting in, and what has landed in the loot store. It cannot see inside anyone's game, so it says
 * only what the store and the officers' apps show.
 *
 * Note on chat logging: WoW writes the chat log file only when a player logs out, so "logging on" here means the officer's app
 * reports it on (recently written, or the game itself says it is on), not that the file is being written live.
 */
const RECENT_MS = 6 * 60 * 60 * 1000;
const STALE_UNCONFIRMED_MS = 10 * 60 * 1000;
const EXPECT_POSTED_MS = 2 * 60 * 1000;

const isPlaceholder = (r: StoredLootRecord) => r.source === 'chat-tail' || r.source === 'live';

export interface OfficerView {
  name: string;
  loggingOn: boolean;
  seenSecondsAgo: number;
}

export type Tone = 'ok' | 'watch' | 'quiet';

export interface CaptureView {
  officers: OfficerView[];
  loggingCount: number;
  /** Unix seconds of the newest win in the store, or null. */
  newestWinAt: number | null;
  recentWins: number;
  /** Wins captured live but still waiting for an officer's addon to confirm the boss (they arrive at that officer's next reload). */
  waitingOnAddon: number;
  /** Confirmed wins with a boss and difficulty in the last 6 hours, how many of them were posted, and how many are overdue. */
  postable: number;
  posted: number;
  overdue: number;
  headline: { tone: Tone; text: string };
}

const short = (name: string) => name.split('#')[0];

export function buildCaptureView(records: StoredLootRecord[], heartbeats: HeartbeatRow[], nowMs: number): CaptureView {
  const officers = heartbeats
    .map((h) => ({ name: short(h.officerName), loggingOn: h.chatLogActive, seenSecondsAgo: Math.max(0, Math.round((nowMs - h.lastSeenAt) / 1000)) }))
    .sort((a, b) => Number(b.loggingOn) - Number(a.loggingOn) || a.name.localeCompare(b.name));
  const loggingCount = officers.filter((o) => o.loggingOn).length;

  const recent = records.filter((r) => nowMs - r.time * 1000 <= RECENT_MS);
  const newestWinAt = records.reduce<number | null>((max, r) => (max === null || r.time > max ? r.time : max), null);
  const waitingOnAddon = recent.filter((r) => isPlaceholder(r) && nowMs - r.time * 1000 > STALE_UNCONFIRMED_MS).length;
  const eligible = recent.filter((r) => !isPlaceholder(r) && r.boss && r.difficulty);
  const posted = eligible.filter((r) => r.discordPostedAt).length;
  const overdue = eligible.filter((r) => !r.discordPostedAt && nowMs - r.time * 1000 > EXPECT_POSTED_MS).length;

  let headline: CaptureView['headline'];
  if (overdue > 0) headline = { tone: 'watch', text: `${overdue} confirmed win${overdue === 1 ? '' : 's'} not posted to Discord yet.` };
  else if (waitingOnAddon > 0) headline = { tone: 'watch', text: `${waitingOnAddon} win${waitingOnAddon === 1 ? ' is' : 's are'} waiting for an officer's addon to confirm the boss.` };
  else if (officers.length === 0) headline = { tone: 'quiet', text: "No officer's Guild Tools app is open right now." };
  else if (recent.length === 0) headline = { tone: 'quiet', text: 'Nothing captured in the last 6 hours.' };
  else headline = { tone: 'ok', text: 'Everything captured recently is confirmed and posted.' };

  return { officers, loggingCount, newestWinAt, recentWins: recent.length, waitingOnAddon, postable: eligible.length, posted, overdue, headline };
}
