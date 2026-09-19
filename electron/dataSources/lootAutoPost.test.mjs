import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let tempDir;
let autoPost;
let store;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-autopost-'));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  store = await import('./lootRecordsStore.cjs');
  autoPost = await import('./lootAutoPost.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

const NOW = 1_800_000_000;
const ON = { autoPostLoot: true, lootLogChannelId: '999' };

function rec(over = {}) {
  return { id: over.id ?? 'r1', itemId: 1, itemLink: '[Sword of Flame]', winner: 'Ranikina', boss: "Ula'tek", slot: 'Main Hand', difficulty: 'Heroic', time: NOW - 60, ...over };
}

describe('announceVerified', () => {
  it('posts nothing when the toggle is off', async () => {
    const post = vi.fn();
    const r = await autoPost.announceVerified([rec()], { nowSeconds: NOW, settings: { autoPostLoot: false, lootLogChannelId: '999' }, post, mark: vi.fn() });
    expect(post).not.toHaveBeenCalled();
    expect(r).toEqual({ posted: 0, skipped: 'off' });
  });

  it('posts nothing when no loot channel is configured', async () => {
    const post = vi.fn();
    const r = await autoPost.announceVerified([rec()], { nowSeconds: NOW, settings: { autoPostLoot: true, lootLogChannelId: '' }, post, mark: vi.fn() });
    expect(post).not.toHaveBeenCalled();
    expect(r.skipped).toMatch(/no loot channel/);
  });

  it('posts one message per boss+difficulty, headed by the difficulty, and marks those records posted', async () => {
    const post = vi.fn().mockResolvedValue({});
    const mark = vi.fn();
    await autoPost.announceVerified(
      [rec({ id: 'a' }), rec({ id: 'b', winner: 'Devkra', itemLink: '[Shield]', slot: 'Off Hand' }), rec({ id: 'c', boss: 'Sszorak', difficulty: 'Normal' })],
      { nowSeconds: NOW, settings: ON, post, mark },
    );
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toBe('999');
    expect(post.mock.calls[0][1].content).toBe("**Ula'tek (Heroic)**\n🎲 Ranikina won Sword of Flame (Main Hand)\n🎲 Devkra won Shield (Off Hand)");
    expect(post.mock.calls[1][1].content).toBe('**Sszorak (Normal)**\n🎲 Ranikina won Sword of Flame (Main Hand)');
    expect(mark).toHaveBeenNthCalledWith(1, ['a', 'b']);
    expect(mark).toHaveBeenNthCalledWith(2, ['c']);
  });

  it('never posts an unverified chat-tail capture, or one with no boss or difficulty', async () => {
    const post = vi.fn().mockResolvedValue({});
    await autoPost.announceVerified([rec({ source: 'chat-tail' }), rec({ boss: null }), rec({ difficulty: null })], { nowSeconds: NOW, settings: ON, post, mark: vi.fn() });
    expect(post).not.toHaveBeenCalled();
  });

  it('skips wins older than six hours (an officer\'s first sync offers the addon\'s whole history)', async () => {
    const post = vi.fn().mockResolvedValue({});
    await autoPost.announceVerified([rec({ time: NOW - 7 * 3600 })], { nowSeconds: NOW, settings: ON, post, mark: vi.fn() });
    expect(post).not.toHaveBeenCalled();
  });

  it('skips a record already stamped as posted', async () => {
    const post = vi.fn().mockResolvedValue({});
    await autoPost.announceVerified([rec({ discordPostedAt: '2026-09-19T00:00:00Z' })], { nowSeconds: NOW, settings: ON, post, mark: vi.fn() });
    expect(post).not.toHaveBeenCalled();
  });

  it('does not mark a batch posted when Discord rejects it, and still sends the rest', async () => {
    const post = vi.fn().mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce({});
    const mark = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await autoPost.announceVerified([rec({ id: 'a' }), rec({ id: 'c', boss: 'Sszorak' })], { nowSeconds: NOW, settings: ON, post, mark });
    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledWith(['c']);
    expect(r.posted).toBe(1);
  });

  it('splits a boss with a huge loot list across messages under Discord\'s length cap', () => {
    const many = Array.from({ length: 90 }, (_, i) => rec({ id: `x${i}`, itemLink: `[A Fairly Long Item Name Number ${i}]`, winner: 'Sylvara-Argent Dawn' }));
    const batches = autoPost.formatBatches(many);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(b.content.length).toBeLessThanOrEqual(2000);
    expect(batches.flatMap((b) => b.ids)).toHaveLength(90);
  });
});

describe('end to end with the real store', () => {
  it('a chat-tail win posts only once the addon verifies it, exactly once, and the guessed self-win name is corrected', async () => {
    // Live capture: "You" won, app guessed the wrong character before a /reload.
    store.sync([{ itemId: null, itemLink: '[Sword of Flame]', winner: 'Elishock', boss: null, slot: null, difficulty: null, source: 'chat-tail', selfWin: true, time: NOW - 300 }], [], []);
    const first = store.sync([], [], []);
    expect(first.verifiedRecords).toEqual([]); // nothing verified yet -> nothing to announce

    // The addon's own sync arrives: real name, real boss, marked `self`.
    const post = vi.fn().mockResolvedValue({});
    const synced = store.sync([{ itemId: 5, itemLink: '|cff|Hitem:5|h[Sword of Flame]|h|r', winner: 'Elishaunt', boss: "Ula'tek", slot: 'Main Hand', difficulty: 'Heroic', self: true, time: NOW - 240 }], [], []);
    expect(synced.records).toHaveLength(1); // paired with the placeholder, not a duplicate
    expect(synced.records[0].winner).toBe('Elishaunt'); // guess corrected
    expect(synced.records[0].selfWin).toBeUndefined();
    expect(synced.verifiedRecords).toHaveLength(1);

    await autoPost.announceVerified(synced.verifiedRecords, { nowSeconds: NOW, settings: ON, post });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1].content).toContain('Elishaunt won Sword of Flame');
    expect(store.load().records[0].discordPostedAt).toBeTruthy();

    // The same data offered again on the next sync announces nothing new.
    const again = store.sync([{ itemId: 5, itemLink: '|cff|Hitem:5|h[Sword of Flame]|h|r', winner: 'Elishaunt', boss: "Ula'tek", slot: 'Main Hand', difficulty: 'Heroic', self: true, time: NOW - 240 }], [], []);
    expect(again.verifiedRecords).toEqual([]);
    await autoPost.announceVerified(again.verifiedRecords, { nowSeconds: NOW, settings: ON, post });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a self-win does not steal another raider\'s record of an identically named item', () => {
    store.sync([{ itemId: 5, itemLink: '[Curio]', winner: 'Silverhorn', boss: 'B', slot: 'Other', difficulty: 'Normal', time: NOW - 120 }], [], []);
    store.sync([{ itemId: null, itemLink: '[Curio]', winner: 'Elishaunt', boss: null, slot: null, difficulty: null, source: 'chat-tail', selfWin: true, time: NOW - 100 }], [], []);
    const all = store.load().records;
    expect(all).toHaveLength(2); // the addon's Silverhorn record has no `self` flag, so it does not pair
  });
});
