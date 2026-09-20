import { describe, expect, it, vi } from 'vitest';
import { createRosterCache, MAX_STALE_MS, RETRY_AFTER_FAILURE_MS, TTL_MS } from './rosterCache.cjs';

const quiet = { log: () => {}, error: () => {} };
const roster = (tag) => ({ raiders: [{ name: tag }], fetchedAt: `at-${tag}`, heroicBossesKilled: 3, realmMismatches: [] });
const memoryStore = (initial = null) => {
  let saved = initial;
  return { load: () => saved, save: vi.fn((e) => (saved = e)), peek: () => saved };
};

function setup({ fetches, store = memoryStore() }) {
  const clock = { t: 1_000_000 };
  const fetchRoster = vi.fn(async () => {
    const next = fetches.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const cache = createRosterCache({ fetchRoster, store, now: () => clock.t, logger: quiet });
  return { cache, fetchRoster, clock, store };
}

describe('rosterCache', () => {
  it('serves a fresh roster from memory without another upstream fetch', async () => {
    const { cache, fetchRoster, clock } = setup({ fetches: [roster('A')] });
    expect((await cache.get()).fetchedAt).toBe('at-A');
    clock.t += TTL_MS - 1000;
    expect((await cache.get()).fetchedAt).toBe('at-A');
    expect(fetchRoster).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the roster is older than the TTL', async () => {
    const { cache, fetchRoster, clock } = setup({ fetches: [roster('A'), roster('B')] });
    await cache.get();
    clock.t += TTL_MS + 1;
    expect((await cache.get()).fetchedAt).toBe('at-B');
    expect(fetchRoster).toHaveBeenCalledTimes(2);
  });

  it('officers opening the app at the same moment share ONE upstream fetch (the rate-limit cause)', async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const { cache, fetchRoster } = setup({ fetches: [] });
    fetchRoster.mockImplementation(async () => {
      await gate;
      return roster('A');
    });
    const calls = Array.from({ length: 25 }, () => cache.get());
    release();
    const results = await Promise.all(calls);
    expect(fetchRoster).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => r.fetchedAt))).toEqual(new Set(['at-A']));
  });

  it('a failed fetch (null, i.e. the rate limit) serves the last good roster instead of nothing', async () => {
    const { cache, clock } = setup({ fetches: [roster('A'), null] });
    await cache.get();
    clock.t += TTL_MS + 1;
    expect((await cache.get()).fetchedAt).toBe('at-A');
  });

  it('a fetch that throws is treated the same way', async () => {
    const { cache, clock } = setup({ fetches: [roster('A'), new Error('429')] });
    await cache.get();
    clock.t += TTL_MS + 1;
    expect((await cache.get()).fetchedAt).toBe('at-A');
  });

  it('does not retry a failing upstream for a minute, then tries again', async () => {
    const { cache, fetchRoster, clock } = setup({ fetches: [roster('A'), null, roster('B')] });
    await cache.get();
    clock.t += TTL_MS + 1;
    await cache.get(); // fails
    for (let i = 0; i < 20; i++) await cache.get(); // a burst of officers: no more upstream calls
    expect(fetchRoster).toHaveBeenCalledTimes(2);
    clock.t += RETRY_AFTER_FAILURE_MS + 1;
    expect((await cache.get()).fetchedAt).toBe('at-B');
    expect(fetchRoster).toHaveBeenCalledTimes(3);
  });

  it('is null only when nothing has ever been fetched successfully', async () => {
    const { cache } = setup({ fetches: [null] });
    expect(await cache.get()).toBeNull();
  });

  it('will not serve a roster older than the stale limit, preferring the honest null', async () => {
    const { cache, clock } = setup({ fetches: [roster('A'), null] });
    await cache.get();
    clock.t += MAX_STALE_MS + 1;
    expect(await cache.get()).toBeNull();
  });

  it('keeps the last good roster on disk, so a restart during a rate limit still has real data', async () => {
    const store = memoryStore();
    const first = setup({ fetches: [roster('A')], store });
    await first.cache.get();
    expect(store.save).toHaveBeenCalledTimes(1);

    // "restart": a brand-new cache over the same store, whose first fetch is rate limited
    const second = setup({ fetches: [null], store });
    second.clock.t = first.clock.t + TTL_MS + 1;
    expect((await second.cache.get()).fetchedAt).toBe('at-A');
  });

  it('does not overwrite the saved roster with a failure', async () => {
    const { cache, clock, store } = setup({ fetches: [roster('A'), null] });
    await cache.get();
    clock.t += TTL_MS + 1;
    await cache.get();
    expect(store.peek().value.fetchedAt).toBe('at-A');
  });

  it('ignores a corrupt saved file', async () => {
    const store = { load: () => ({ value: null, at: 'yesterday' }), save: vi.fn() };
    const { cache } = setup({ fetches: [roster('A')], store });
    expect((await cache.get()).fetchedAt).toBe('at-A');
  });
});
