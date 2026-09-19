import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchItemDetails, normalizeSlot } from './bossLootTable.cjs';
import { fillGapsFrom, isStale, missingItemIds, normalizeSlots, INCOMPLETE_RETRY_MS } from './bossLootTableCache.cjs';

const noWait = () => Promise.resolve();
const http = (status, retryAfterMs) => Object.assign(new Error(`HTTP ${status}`), { status, retryAfterMs });

describe('fetchItemDetails', () => {
  it('returns every item when all lookups succeed', async () => {
    const { details, failedIds } = await fetchItemDetails([1, 2, 3], { get: async (id) => ({ name: `Item ${id}` }), sleep: noWait });
    expect([...details.keys()].sort()).toEqual([1, 2, 3]);
    expect(failedIds).toEqual([]);
  });

  it('never has more lookups in flight than the concurrency limit (the burst that got rate-limited)', async () => {
    let inFlight = 0;
    let peak = 0;
    const get = async (id) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
      return { name: `Item ${id}` };
    };
    const ids = Array.from({ length: 131 }, (_, i) => i + 1);
    const { details } = await fetchItemDetails(ids, { get, concurrency: 6, sleep: noWait });
    expect(details.size).toBe(131);
    expect(peak).toBeLessThanOrEqual(6);
  });

  it('retries a rate-limited (429) lookup and succeeds, honouring Retry-After', async () => {
    const waits = [];
    const get = vi.fn().mockRejectedValueOnce(http(429, 1500)).mockResolvedValueOnce({ name: 'Font of Venomous Rage' });
    const { details, failedIds } = await fetchItemDetails([270168], { get, sleep: async (ms) => void waits.push(ms) });
    expect(details.get(270168).name).toBe('Font of Venomous Rage');
    expect(failedIds).toEqual([]);
    expect(waits).toEqual([1500]);
  });

  it('backs off exponentially when there is no Retry-After, then gives up and REPORTS the id after the last attempt', async () => {
    const waits = [];
    const get = vi.fn().mockRejectedValue(http(503));
    const { details, failedIds } = await fetchItemDetails([7], { get, maxAttempts: 4, sleep: async (ms) => void waits.push(ms) });
    expect(get).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([400, 800, 1600]);
    expect(details.size).toBe(0);
    expect(failedIds).toEqual([7]);
  });

  it('does not retry a permanent failure (404) and still finishes the other items', async () => {
    const get = vi.fn(async (id) => {
      if (id === 2) throw http(404);
      return { name: `Item ${id}` };
    });
    const { details, failedIds } = await fetchItemDetails([1, 2, 3], { get, sleep: noWait });
    expect(get).toHaveBeenCalledTimes(3);
    expect([...details.keys()].sort()).toEqual([1, 3]);
    expect(failedIds).toEqual([2]);
  });
});

describe('missing-detail handling in the loot table cache', () => {
  const table = (over = {}) => ({
    bosses: [{ id: 1, name: "Ula'tek" }],
    lootByBoss: { "Ula'tek": [10, 20, 30] },
    items: { 10: { name: 'A', slot: 'Head' } },
    instanceIds: [1317, 1320],
    fetchedAt: new Date().toISOString(),
    ...over,
  });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('finds ids a boss lists that have no details -- including in a table cached before missingItemIds existed', () => {
    expect(missingItemIds(table())).toEqual([20, 30]);
    expect(missingItemIds(table({ items: { 10: {}, 20: {}, 30: {} } }))).toEqual([]);
  });

  it('a complete table stays fresh for the normal week', () => {
    const complete = table({ items: { 10: {}, 20: {}, 30: {} } });
    vi.setSystemTime(Date.now() + 3 * 24 * 3600 * 1000);
    expect(isStale(complete, [1317, 1320])).toBe(false);
  });

  it('an incomplete table is NOT rebuilt on every request, but IS once ten minutes have passed', () => {
    const incomplete = table();
    vi.setSystemTime(Date.now() + INCOMPLETE_RETRY_MS - 1000);
    expect(isStale(incomplete, [1317, 1320])).toBe(false); // no fetch storm while Blizzard is struggling
    vi.setSystemTime(Date.now() + 2000);
    expect(isStale(incomplete, [1317, 1320])).toBe(true);
  });

  it('a rotated-out tier is still stale regardless', () => {
    expect(isStale(table({ items: { 10: {}, 20: {}, 30: {} } }), [9999])).toBe(true);
  });

  it('a rebuild that failed some lookups borrows their details from the previous table, never getting worse', () => {
    const rebuilt = table({ items: { 10: { name: 'A', slot: 'Head' } }, missingItemIds: [20, 30] });
    const previous = table({ items: { 10: { name: 'OLD A' }, 20: { name: 'B', slot: 'Legs' } } });
    const merged = fillGapsFrom(rebuilt, previous);
    expect(merged.items[10].name).toBe('A'); // fresh data wins
    expect(merged.items[20]).toEqual({ name: 'B', slot: 'Legs' }); // gap filled from the old table
    expect(merged.missingItemIds).toEqual([30]); // still honestly reported as missing
  });

  it('with no previous table there is nothing to borrow and the table is returned as is', () => {
    const rebuilt = table();
    expect(fillGapsFrom(rebuilt, null)).toBe(rebuilt);
  });
});

describe('slot vocabulary', () => {
  it('maps the "Non-equippable" label from Blizzard to the "Other" the addon records, and leaves real slots alone', () => {
    expect(normalizeSlot('Non-equippable')).toBe('Other');
    expect(normalizeSlot(undefined)).toBe('Other');
    expect(normalizeSlot('Trinket')).toBe('Trinket');
  });

  it('fixes already-cached tables on read', () => {
    const t = normalizeSlots({ items: { 1: { name: 'Curio', slot: 'Non-equippable' }, 2: { name: 'Ring', slot: 'Finger' } } });
    expect(t.items[1].slot).toBe('Other');
    expect(t.items[2].slot).toBe('Finger');
  });
});
