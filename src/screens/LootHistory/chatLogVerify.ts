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
