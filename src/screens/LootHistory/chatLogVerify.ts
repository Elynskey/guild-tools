/**
 * "Is chat logging really writing?" check. The game can say chat logging is ON while
 * nothing reaches WoWChatLog.txt, and a quiet stretch (no chat lines for a few minutes)
 * looks the same from the file's timestamp alone. So the officer says something in chat
 * while the app watches the file: a NEW write after the check started proves it, and
 * nothing within the window means it is not being written.
 */
export const VERIFY_WINDOW_MS = 30_000;

export interface ChatLogSnapshot {
  exists: boolean;
  lastWriteAt: number | null;
  sizeBytes: number | null;
}

export type VerifyResult = 'waiting' | 'verified' | 'failed';

/** `baseline` is the file as it stood when the check began; `current` is a fresh reading. */
export function evaluateVerification(baseline: ChatLogSnapshot, current: ChatLogSnapshot, elapsedMs: number, windowMs: number = VERIFY_WINDOW_MS): VerifyResult {
  const grew = current.exists && (current.sizeBytes ?? 0) > (baseline.sizeBytes ?? 0);
  const touched = current.exists && current.lastWriteAt !== null && (baseline.lastWriteAt === null || current.lastWriteAt > baseline.lastWriteAt);
  // A file that appeared after the check began (chat logging just got switched on) counts as written.
  if (grew || touched) return 'verified';
  return elapsedMs >= windowMs ? 'failed' : 'waiting';
}

/**
 * Raid-wide version: one line said in raid or party chat lands in EVERY officer's log at once,
 * so a single check can verify all the loggers. Each officer's app reports its chat log's size
 * with its heartbeat and the proxy notes when it changed (server clock), so an officer counts as
 * verified if their log changed after this check began -- no clock comparison between PCs.
 */
export const RAID_VERIFY_WINDOW_MS = 45_000;

export type OfficerVerifyStatus = 'verified' | 'waiting' | 'failed';

export interface OfficerWrite {
  officerName: string;
  lastWriteSeenAt?: number | null;
}

export function evaluateRaidVerification(startedAtServer: number, officers: OfficerWrite[], elapsedMs: number, windowMs: number = RAID_VERIFY_WINDOW_MS) {
  const expired = elapsedMs >= windowMs;
  const results = officers.map((o) => ({
    name: o.officerName,
    status: ((o.lastWriteSeenAt ?? 0) > startedAtServer ? 'verified' : expired ? 'failed' : 'waiting') as OfficerVerifyStatus,
  }));
  return { officers: results, allVerified: results.every((r) => r.status === 'verified'), expired };
}
