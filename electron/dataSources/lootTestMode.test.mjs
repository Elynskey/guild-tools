import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir;
let store;
let autoPost;

const rec = (over = {}) => ({ itemId: 100, itemLink: '[Worn Shortsword]', winner: 'Thundoor', boss: "Ula'tek", slot: 'One-Hand', time: 1_800_000_000, difficulty: 'Heroic', ...over });

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-loot-'));
  process.env.DATA_DIR = dir;
  vi.resetModules();
  store = await import('./lootRecordsStore.cjs');
  autoPost = await import('./lootAutoPost.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('test-mode loot is a completely separate store', () => {
  it('a sync in test mode writes only the test file, never the real loot log', () => {
    store.sync([rec()], [], [], 'test');
    expect(fs.existsSync(path.join(dir, 'loot-records.test.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'loot-records.json'))).toBe(false);
    expect(store.load('test').records).toHaveLength(1);
    expect(store.load().records).toHaveLength(0);
    expect(store.load('prod').records).toHaveLength(0);
  });

  it('a real sync never shows up in the test store', () => {
    store.sync([rec({ winner: 'Ranikina' })], [], []);
    expect(store.load().records).toHaveLength(1);
    expect(store.load('test').records).toHaveLength(0);
  });

  it('the same win can exist in both stores independently (no cross-dedupe)', () => {
    store.sync([rec()], [], [], 'test');
    store.sync([rec()], [], []);
    expect(store.load('test').records).toHaveLength(1);
    expect(store.load().records).toHaveLength(1);
  });

  it('edits, removals, trades and night deletes act only on the store they were sent to', () => {
    store.sync([rec({ winner: 'A', time: 1_800_000_000 }), rec({ winner: 'B', itemId: 101, itemLink: '[Other]', time: 1_800_000_500 })], [], [], 'test');
    store.sync([rec({ winner: 'A', time: 1_800_000_000 })], [], []);
    const testA = store.load('test').records.find((r) => r.winner === 'A');

    store.update(testA.id, { slot: 'Head' }, 'test');
    expect(store.load('test').records.find((r) => r.winner === 'A').slot).toBe('Head');
    expect(store.load().records.find((r) => r.winner === 'A').slot).toBe('One-Hand');

    store.manualAdd({ winner: 'C', itemName: 'Manual Item' }, 'test');
    expect(store.load('test').records).toHaveLength(3);
    expect(store.load().records).toHaveLength(1);

    store.deleteNight(1_799_999_000, 1_800_001_000, 'test');
    expect(store.load('test').records.find((r) => r.winner === 'A')).toBeUndefined();
    expect(store.load().records).toHaveLength(1);

    store.remove(store.load().records[0].id);
    expect(store.load().records).toHaveLength(0);
  });

  it('markPosted stamps only the store it is told about', () => {
    store.sync([rec()], [], [], 'test');
    store.sync([rec()], [], []);
    store.markPosted([store.load('test').records[0].id], 'test');
    expect(store.load('test').records[0].discordPostedAt).toBeDefined();
    expect(store.load().records[0].discordPostedAt).toBeUndefined();
  });
});

describe('test-mode auto-post goes to the TEST channel only', () => {
  const NOW = 1_800_000_060;
  const settings = { autoPostLoot: true, lootLogChannelId: 'REAL', testLootLogChannelId: 'TEST' };
  const verified = () => [{ id: 'r1', winner: 'Thundoor', itemLink: '[Worn Shortsword]', boss: "Ula'tek", difficulty: 'Heroic', slot: 'One-Hand', time: NOW - 30, source: undefined }];

  it('a test-mode win posts to the test channel, and is marked in the test store', async () => {
    const post = vi.fn(async () => ({}));
    const mark = vi.fn();
    const result = await autoPost.announceVerified(verified(), { nowSeconds: NOW, settings, post, mark, mode: 'test' });
    expect(result.posted).toBe(1);
    expect(post).toHaveBeenCalledWith('TEST', expect.any(Object));
    expect(post).not.toHaveBeenCalledWith('REAL', expect.anything());
  });

  it('a real win still posts to the real channel', async () => {
    const post = vi.fn(async () => ({}));
    await autoPost.announceVerified(verified(), { nowSeconds: NOW, settings, post, mark: vi.fn() });
    expect(post).toHaveBeenCalledWith('REAL', expect.any(Object));
  });

  it('test mode with no test channel set posts NOTHING (it never falls back to the real channel)', async () => {
    const post = vi.fn(async () => ({}));
    const result = await autoPost.announceVerified(verified(), { nowSeconds: NOW, settings: { ...settings, testLootLogChannelId: '' }, post, mark: vi.fn(), mode: 'test' });
    expect(result.posted).toBe(0);
    expect(result.skipped).toMatch(/no loot channel/);
    expect(post).not.toHaveBeenCalled();
  });

  it('the default mark (no override) stamps the test store when in test mode', async () => {
    store.sync([rec({ id: undefined })], [], [], 'test');
    const stored = store.load('test').records[0];
    const post = vi.fn(async () => ({}));
    await autoPost.announceVerified([{ ...stored, boss: "Ula'tek", difficulty: 'Heroic', slot: 'One-Hand', time: NOW - 30 }], { nowSeconds: NOW, settings, post, mode: 'test' });
    expect(store.load('test').records[0].discordPostedAt).toBeDefined();
    expect(store.load().records).toHaveLength(0);
  });
});
