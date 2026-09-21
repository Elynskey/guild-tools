import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { planNeedLossCleanup } = require('./needLossCleanup.cjs');

const link = (name, id = 100) => `|cnIQ4:|Hitem:${id}::::|h[${name}]|h|r`;
const loss = (name, time, over = {}) => ({ itemId: 100, itemLink: link('Crown'), name, time, ...over });
const win = (winner, time, over = {}) => ({ itemId: 100, itemLink: link('Crown'), winner, time, ...over });

describe('planNeedLossCleanup', () => {
  it('two officer copies of one roll (seconds apart, one copy of the item won) are one roll: the later is removed', () => {
    const a = loss('Odasa', 1000);
    const b = loss('Odasa', 1002);
    const plan = planNeedLossCleanup([a, b], [win('Greedy', 1000)]);
    expect(plan.remove).toEqual([b]);
    expect(plan.groups).toEqual([{ itemId: 100, name: 'Odasa', item: 'Crown', entries: 2, copies: 1, remove: 1 }]);
  });

  it('two copies of the item were won: rolling Need on both and losing both is legitimate, nothing is removed', () => {
    const plan = planNeedLossCleanup([loss('Odasa', 1000), loss('Odasa', 1001)], [win('Greedy', 1000), win('Other', 1000)]);
    expect(plan.remove).toEqual([]);
  });

  it('four entries (two officers x two copies) with two copies won: the two duplicates go', () => {
    const entries = [loss('Odasa', 1000), loss('Odasa', 1001), loss('Odasa', 1002), loss('Odasa', 1003)];
    expect(planNeedLossCleanup(entries, [win('A', 1000), win('B', 1000)]).remove).toHaveLength(2);
  });

  it('the same roller and item on different nights are separate (far apart, never a burst)', () => {
    expect(planNeedLossCleanup([loss('Odasa', 1000), loss('Odasa', 1000 + 24 * 3600)], [win('A', 1000), win('A', 1000 + 24 * 3600)]).remove).toEqual([]);
  });

  it('different rollers or different items are never merged', () => {
    expect(planNeedLossCleanup([loss('Odasa', 1000), loss('Beep', 1001), loss('Odasa', 1002, { itemId: 200, itemLink: link('Boots', 200) })], [win('A', 1000)]).remove).toEqual([]);
  });

  it('entries that carry the game drop ID are left alone (the store identifies those exactly)', () => {
    const a = loss('Odasa', 1000, { encounterId: 3470, lootListId: 1 });
    const b = loss('Odasa', 1002, { encounterId: 3470, lootListId: 2 });
    expect(planNeedLossCleanup([a, b], [win('A', 1000)]).remove).toEqual([]);
  });

  it('a win that was never captured is treated as one copy (the conservative direction for what stays is documented, not silent)', () => {
    expect(planNeedLossCleanup([loss('Odasa', 1000), loss('Odasa', 1001)], []).remove).toHaveLength(1);
  });

  it('empty and missing inputs are fine', () => {
    expect(planNeedLossCleanup([], [])).toEqual({ remove: [], groups: [] });
    expect(planNeedLossCleanup(undefined, undefined)).toEqual({ remove: [], groups: [] });
  });
});

describe('cleanupNeedLosses on the store', () => {
  let dir;
  let store;
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'gt-cleanup-'));
    process.env.DATA_DIR = dir;
    vi.resetModules();
    store = await import('./lootRecordsStore.cjs');
  });
  afterEach(() => {
    delete process.env.DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  const seed = () => {
    store.sync([win('Greedy', 1000)], [], [loss('Odasa', 1000), loss('Odasa', 1002), loss('Beep', 1000)]);
  };

  it('a dry run reports the plan and changes nothing', () => {
    seed();
    const before = readFileSync(path.join(dir, 'loot-records.json'), 'utf8');
    const r = store.cleanupNeedLosses('prod');
    expect(r.applied).toBe(false);
    expect(r.remove).toHaveLength(1);
    expect(readFileSync(path.join(dir, 'loot-records.json'), 'utf8')).toBe(before);
    expect(readdirSync(dir).filter((f) => f.includes('.bak-'))).toEqual([]);
  });

  it('applying makes a backup first, removes the duplicate, and keeps everything else', () => {
    seed();
    const r = store.cleanupNeedLosses('prod', { apply: true });
    expect(r.applied).toBe(true);
    expect(existsSync(r.backup)).toBe(true);
    expect(JSON.parse(readFileSync(r.backup, 'utf8')).needLosses).toHaveLength(3);
    const after = store.load('prod').needLosses;
    expect(after.map((l) => `${l.name}@${l.time}`).sort()).toEqual(['Beep@1000', 'Odasa@1000']);
  });

  it('the officer whose copy was removed cannot re-add it on their next sync, and a genuinely new loss still lands', () => {
    seed();
    store.cleanupNeedLosses('prod', { apply: true });
    const again = store.sync([], [], [loss('Odasa', 1002), loss('Odasa', 1000), loss('Newcomer', 5000)]);
    expect(again.needLosses.map((l) => l.name).sort()).toEqual(['Beep', 'Newcomer', 'Odasa']);
  });

  it('applying with nothing to remove writes no backup', () => {
    store.sync([], [], [loss('Odasa', 1000)]);
    const r = store.cleanupNeedLosses('prod', { apply: true });
    expect(r).toMatchObject({ applied: false, backup: null });
  });

  it('works on the test store without touching the real one', () => {
    store.sync([win('Greedy', 1000)], [], [loss('Odasa', 1000), loss('Odasa', 1002)], 'test');
    expect(store.cleanupNeedLosses('test', { apply: true }).remove).toHaveLength(1);
    expect(store.load('prod').needLosses).toHaveLength(0);
  });
});
