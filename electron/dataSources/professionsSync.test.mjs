import { describe, expect, it, vi } from 'vitest';
import { createProfessionsSync, HOUR_MS } from './professionsSync.cjs';

const quiet = { log: () => {}, error: () => {} };
const iso = (ms) => new Date(ms).toISOString();

/** A sync wired to a fake clock and a fake cache that a successful scan advances. */
function setup({ fetchedAt, scanSucceeds = true, scanning = false } = {}) {
  const state = { now: Date.UTC(2026, 8, 19, 22, 0, 0), fetchedAt, scanning };
  const scan = vi.fn(async () => {
    if (scanSucceeds) state.fetchedAt = iso(state.now);
  });
  const sync = createProfessionsSync({
    getLastFetchedAt: () => state.fetchedAt,
    scan,
    isScanning: () => state.scanning,
    now: () => state.now,
    logger: quiet,
  });
  return { state, scan, sync };
}

describe('hourly professions sync', () => {
  it('does nothing while the cached scan is under an hour old', async () => {
    const { state, scan, sync } = setup({ fetchedAt: iso(Date.UTC(2026, 8, 19, 21, 30, 0)) });
    expect(await sync.tick()).toBe('fresh');
    state.now += 29 * 60 * 1000; // 59 minutes after that scan
    expect(await sync.tick()).toBe('fresh');
    expect(scan).not.toHaveBeenCalled();
  });

  it('scans once the cached scan is an hour old, and not again until another hour passes', async () => {
    const { state, scan, sync } = setup({ fetchedAt: iso(Date.UTC(2026, 8, 19, 21, 0, 0)) });
    expect(await sync.tick()).toBe('synced');
    expect(scan).toHaveBeenCalledTimes(1);
    state.now += 5 * 60 * 1000;
    expect(await sync.tick()).toBe('fresh');
    state.now += HOUR_MS;
    expect(await sync.tick()).toBe('synced');
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('scans straight away when there is no cache at all', async () => {
    const { scan, sync } = setup({ fetchedAt: undefined });
    expect(await sync.tick()).toBe('synced');
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('a scan an officer just ran by hand counts as this hour\'s sync (judged from the cache timestamp)', async () => {
    const { state, scan, sync } = setup({ fetchedAt: iso(Date.UTC(2026, 8, 19, 20, 0, 0)) });
    state.fetchedAt = iso(state.now - 10 * 60 * 1000); // a manual refresh finished 10 minutes ago
    expect(await sync.tick()).toBe('fresh');
    expect(scan).not.toHaveBeenCalled();
  });

  it('never overlaps a scan that is already running', async () => {
    const { scan, sync } = setup({ fetchedAt: iso(Date.UTC(2026, 8, 19, 18, 0, 0)), scanning: true });
    expect(await sync.tick()).toBe('busy');
    expect(scan).not.toHaveBeenCalled();
  });

  it('a failed scan keeps the old data and is not retried for an hour', async () => {
    const stale = iso(Date.UTC(2026, 8, 19, 20, 0, 0));
    const { state, scan, sync } = setup({ fetchedAt: stale, scanSucceeds: false });
    expect(await sync.tick()).toBe('failed');
    expect(state.fetchedAt).toBe(stale);
    state.now += 5 * 60 * 1000;
    expect(await sync.tick()).toBe('fresh'); // no hammering Battle.net every check
    state.now += HOUR_MS;
    expect(await sync.tick()).toBe('failed');
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('treats a scan that throws as a failure too', async () => {
    const sync = createProfessionsSync({
      getLastFetchedAt: () => undefined,
      scan: async () => {
        throw new Error('boom');
      },
      isScanning: () => false,
      now: () => 1_000_000_000_000,
      logger: quiet,
    });
    expect(await sync.tick()).toBe('failed');
    expect(await sync.tick()).toBe('fresh');
  });
});
