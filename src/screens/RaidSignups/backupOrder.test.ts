import { describe, expect, it } from 'vitest';
import type { RaidAssignment } from '../../electron';
import { backupRank, backupsInOrder, moveBackup } from './backupOrder';

const p = (id: string): RaidAssignment => ({ discordUserId: id, tier: 'primary' });
const b = (id: string): RaidAssignment => ({ discordUserId: id, tier: 'backup' });
const ids = (list: RaidAssignment[]) => list.map((a) => a.discordUserId);

describe('backup call-up order', () => {
  it('is the order backups sit in the list, ignoring primaries between them', () => {
    const list = [b('A'), p('X'), b('B'), p('Y'), b('C')];
    expect(ids(backupsInOrder(list))).toEqual(['A', 'B', 'C']);
    expect(backupRank(list, 'A')).toBe(1);
    expect(backupRank(list, 'C')).toBe(3);
    expect(backupRank(list, 'X')).toBeNull();
    expect(backupRank(list, 'nobody')).toBeNull();
  });

  it('moves a backup earlier or later while primaries keep their slots', () => {
    const list = [b('A'), p('X'), b('B'), p('Y'), b('C')];
    expect(moveBackup(list, 'C', 'up')).toEqual([b('A'), p('X'), b('C'), p('Y'), b('B')]);
    expect(moveBackup(list, 'A', 'down')).toEqual([b('B'), p('X'), b('A'), p('Y'), b('C')]);
  });

  it('does nothing past either end, for a primary, or for someone not in the list', () => {
    const list = [b('A'), p('X'), b('B')];
    expect(moveBackup(list, 'A', 'up')).toBe(list);
    expect(moveBackup(list, 'B', 'down')).toBe(list);
    expect(moveBackup(list, 'X', 'up')).toBe(list);
    expect(moveBackup(list, 'ghost', 'down')).toBe(list);
  });

  it('never mutates the list it is given', () => {
    const list = [b('A'), b('B')];
    const snapshot = JSON.stringify(list);
    moveBackup(list, 'B', 'up');
    expect(JSON.stringify(list)).toBe(snapshot);
  });

  it('a newly assigned backup lands last (setAssignment appends)', () => {
    const list = [b('A'), b('B')];
    const withNew = [...list, b('C')];
    expect(backupRank(withNew, 'C')).toBe(3);
  });
});
