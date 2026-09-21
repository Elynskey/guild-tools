/**
 * "Is chat logging really writing?" check. A NEW write to WoWChatLog.txt after the check started proves it is. But WoW keeps
 * chat lines in memory and writes the file only when you log out (a /reload does not; confirmed live 2026-09-19), so during play no new
 * write is the NORMAL case, not a sign that logging is off. So silence within the window is only "failed" when logging is
 * not on as far as anyone can tell (the game says off, or there is no way to know); when the game says it is on, the answer
 * is "buffered": on, and the file catches up when you next log out.
 */
export const VERIFY_WINDOW_MS = 30_000;

export interface ChatLogSnapshot {
  exists: boolean;
  lastWriteAt: number | null;
  sizeBytes: number | null;
  /** Is logging on as far as anyone can tell: the file was written recently, or the game says it is on. */
  loggingOn?: boolean;
}

export type VerifyResult = 'waiting' | 'verified' | 'buffered' | 'failed';

/** `baseline` is the file as it stood when the check began; `current` is a fresh reading. */
export function evaluateVerification(baseline: ChatLogSnapshot, current: ChatLogSnapshot, elapsedMs: number, windowMs: number = VERIFY_WINDOW_MS): VerifyResult {
  const grew = current.exists && (current.sizeBytes ?? 0) > (baseline.sizeBytes ?? 0);
  const touched = current.exists && current.lastWriteAt !== null && (baseline.lastWriteAt === null || current.lastWriteAt > baseline.lastWriteAt);
  // A file that appeared after the check began (chat logging just got switched on) counts as written.
  if (grew || touched) return 'verified';
  if (elapsedMs < windowMs) return 'waiting';
  return current.loggingOn ? 'buffered' : 'failed';
}

/**
 * Raid-wide version: one line said in raid or party chat lands in EVERY officer's log at once,
 * so a single check can verify all the loggers. Each officer's app reports its chat log's size
 * with its heartbeat and the proxy notes when it changed (server clock), so an officer counts as
 * verified if their log changed after this check began -- no clock comparison between PCs.
 */
export const RAID_VERIFY_WINDOW_MS = 45_000;

export type OfficerVerifyStatus = 'verified' | 'waiting' | 'buffered' | 'failed';

export interface OfficerWrite {
  officerName: string;
  lastWriteSeenAt?: number | null;
  /** Their app reports logging as on (recently written, or the game says on). Without it, silence is a failure; with it, silence is buffering. */
  chatLogActive?: boolean;
}

export function evaluateRaidVerification(startedAtServer: number, officers: OfficerWrite[], elapsedMs: number, windowMs: number = RAID_VERIFY_WINDOW_MS) {
  const expired = elapsedMs >= windowMs;
  const results = officers.map((o) => ({
    name: o.officerName,
    status: ((o.lastWriteSeenAt ?? 0) > startedAtServer ? 'verified' : !expired ? 'waiting' : o.chatLogActive ? 'buffered' : 'failed') as OfficerVerifyStatus,
  }));
  return { officers: results, allVerified: results.every((r) => r.status === 'verified'), expired };
}
