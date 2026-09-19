import type { RaidAssignment } from '../../electron';

/**
 * Backups are a call-up queue, not a set: when a primary is out, the first backup in the
 * list is asked first. The order is simply the order backup entries sit in the role's
 * assignment list (the server stores that array as-is and the final roster reads it back
 * in the same order), so reordering never needs a new field.
 */

/** Backups in call-up order. */
export function backupsInOrder(list: RaidAssignment[]): RaidAssignment[] {
  return list.filter((a) => a.tier === 'backup');
}

/** 1-based place in the call-up order, or null if this person isn't a backup. */
export function backupRank(list: RaidAssignment[], discordUserId: string): number | null {
  const i = backupsInOrder(list).findIndex((a) => a.discordUserId === discordUserId);
  return i === -1 ? null : i + 1;
}

/** Moves a backup one place earlier ('up') or later ('down') in the call-up order. Primaries keep their slots; a move past either end returns the list unchanged. */
export function moveBackup(list: RaidAssignment[], discordUserId: string, direction: 'up' | 'down'): RaidAssignment[] {
  const backups = backupsInOrder(list);
  const from = backups.findIndex((a) => a.discordUserId === discordUserId);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= backups.length) return list;

  const reordered = [...backups];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  let next = 0;
  return list.map((a) => (a.tier === 'backup' ? reordered[next++] : a));
}
