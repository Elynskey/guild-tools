import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir;
let store;

const vote = (postId, voterId, nomineeId) => store.recordVote(postId, { voterId, voterUsername: `voter-${voterId}`, nomineeId, nomineeUsername: `nominee-${nomineeId}` }, 'test');

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-gotm-'));
  process.env.DATA_DIR = dir;
  vi.resetModules();
  store = await import('./gotmStore.cjs');
  // create() only posts to Discord when a channel is configured; none is, so this stays offline.
  await store.create('Officer', 'Voting is open', 'test');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const postId = () => store.load('test')[0].id;

describe('officer tie-break', () => {
  it('a tie with officerTieBreak closes voting but picks NO winner and lists who tied', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    vote(id, 'v3', 'C');
    vote(id, 'v4', 'C');
    vote(id, 'v5', 'A');
    vote(id, 'v6', 'B');
    const entry = store.resolveWinner(id, 'test', { officerTieBreak: true });
    expect(entry.tieBreakPending).toBe(true);
    expect(entry.winnerId).toBeNull();
    expect(entry.closedAt).toBeNull();
    expect(entry.tiedNominees.map((t) => t.id).sort()).toEqual(['A', 'B', 'C']);
  });

  it('votes stop counting once a tie-break is pending', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    store.resolveWinner(id, 'test', { officerTieBreak: true });
    expect(vote(id, 'v3', 'A')).toBeNull();
    expect(store.get(id, 'test').votes).toHaveLength(2);
  });

  it('the officer picks the winner from those who tied, and the vote closes', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    vote(id, 'v3', 'C');
    store.resolveWinner(id, 'test', { officerTieBreak: true });
    const entry = store.chooseTieWinner(id, 'B', 'Elishan#1107', 'test');
    expect(entry.winnerId).toBe('B');
    expect(entry.winnerUsername).toBe('nominee-B');
    expect(entry.winnerChosenBy).toBe('Elishan#1107');
    expect(entry.winnerTieBrokeAmong.map((t) => t.id).sort()).toEqual(['A', 'B', 'C']);
    expect(entry.tieBreakPending).toBe(false);
    expect(entry.closedAt).not.toBeNull();
  });

  it('cannot pick someone who did not tie', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    vote(id, 'v3', 'A');
    vote(id, 'v4', 'B');
    vote(id, 'v5', 'C');
    store.resolveWinner(id, 'test', { officerTieBreak: true });
    expect(() => store.chooseTieWinner(id, 'C', 'Elishan#1107', 'test')).toThrow(/tied/);
    expect(store.get(id, 'test').closedAt).toBeNull();
  });

  it('a second pick (double click, two officers) keeps the first winner', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    store.resolveWinner(id, 'test', { officerTieBreak: true });
    store.chooseTieWinner(id, 'A', 'One', 'test');
    const again = store.chooseTieWinner(id, 'B', 'Two', 'test');
    expect(again.winnerId).toBe('A');
    expect(again.winnerChosenBy).toBe('One');
  });

  it('closing again while a tie-break is pending does not reset or pick anything', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    const first = store.resolveWinner(id, 'test', { officerTieBreak: true });
    const second = store.resolveWinner(id, 'test', { officerTieBreak: true });
    expect(second.tiedNominees).toEqual(first.tiedNominees);
    expect(second.winnerId).toBeNull();
  });

  it('a clear winner is decided immediately, no tie-break needed', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'A');
    vote(id, 'v3', 'B');
    const entry = store.resolveWinner(id, 'test', { officerTieBreak: true });
    expect(entry.winnerId).toBe('A');
    expect(entry.tieBreakPending).toBeUndefined();
    expect(entry.winnerTieBrokeAmong).toBeNull();
    expect(entry.closedAt).not.toBeNull();
  });

  it('there is nothing to break when the vote is not tied', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    expect(() => store.chooseTieWinner(id, 'A', 'Elishan#1107', 'test')).toThrow(/no tie/);
  });

  it('an older app that does not ask for officer tie-breaks still gets the random draw (backward compatible)', () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    const entry = store.resolveWinner(id, 'test');
    expect(['A', 'B']).toContain(entry.winnerId);
    expect(entry.closedAt).not.toBeNull();
    expect(entry.winnerTieBrokeAmong).toHaveLength(2);
    expect(entry.tieBreakPending).toBeUndefined();
  });

  it('the announcement is refused until the officer has picked', async () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    store.resolveWinner(id, 'test', { officerTieBreak: true });
    await expect(store.announceWinner(id, 'Congrats!', 'test')).rejects.toThrow(/closed/);
  });

  it('reminders are refused while a tie-break is pending', async () => {
    const id = postId();
    vote(id, 'v1', 'A');
    vote(id, 'v2', 'B');
    store.resolveWinner(id, 'test', { officerTieBreak: true });
    await expect(store.sendReminder(id, 'Vote!', 'test')).rejects.toThrow(/closed/);
  });
});
