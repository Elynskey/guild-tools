import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// resolveDataDir() (dataDir.cjs) falls back to process.env.DATA_DIR outside Electron --
// a fresh temp dir per test gives real file-based isolation without mocking fs.
let tempDir;
let store;

beforeEach(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'gt-analytics-store-'));
  process.env.DATA_DIR = tempDir;
  // Re-imported fresh each test -- the module has no in-memory state of its own, but
  // Vitest's module registry would otherwise cache dataDir.cjs's resolved value across
  // tests, reusing the first temp dir forever. resetModules() forces a real re-evaluation.
  vi.resetModules();
  store = await import('./analyticsStore.cjs');
});

afterEach(() => {
  delete process.env.DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('record', () => {
  it('fills in id/at/mode and returns {ok: true}', () => {
    const result = store.record({ event: 'screen_view', screen: 'Landing', displayName: 'Ethan', appVersion: '0.9.37' });
    expect(result).toEqual({ ok: true });

    const [stored] = store.list('prod');
    expect(stored.id).toBeTruthy();
    expect(stored.event).toBe('screen_view');
    expect(stored.screen).toBe('Landing');
    expect(stored.displayName).toBe('Ethan');
    expect(stored.appVersion).toBe('0.9.37');
    expect(stored.mode).toBe('prod');
    expect(stored.at).toBeTruthy();
  });

  it('defaults screen/displayName/appVersion/meta to null when omitted', () => {
    store.record({ event: 'app_launch' });
    const [stored] = store.list('prod');
    expect(stored.screen).toBeNull();
    expect(stored.displayName).toBeNull();
    expect(stored.appVersion).toBeNull();
    expect(stored.meta).toBeNull();
  });

  it('throws when event is missing', () => {
    expect(() => store.record({})).toThrow(/event is required/);
  });

  it('keeps prod and test writes fully isolated from each other', () => {
    store.record({ event: 'screen_view', screen: 'Landing' }, 'prod');
    store.record({ event: 'screen_view', screen: 'Raid Signups' }, 'test');

    expect(store.list('prod')).toHaveLength(1);
    expect(store.list('prod')[0].screen).toBe('Landing');
    expect(store.list('prod')[0].mode).toBe('prod');

    expect(store.list('test')).toHaveLength(1);
    expect(store.list('test')[0].screen).toBe('Raid Signups');
    expect(store.list('test')[0].mode).toBe('test');
  });
});

describe('list', () => {
  it('returns an empty array before any file exists', () => {
    expect(store.list('prod')).toEqual([]);
  });
});

describe('retention trimming', () => {
  it('drops an event older than MAX_AGE_DAYS (120 days)', () => {
    store.record({ event: 'screen_view', screen: 'Landing' });
    const filePath = path.join(tempDir, 'analytics.json');
    const events = JSON.parse(readFileSync(filePath, 'utf8'));
    events[0].at = new Date(Date.now() - 121 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(filePath, JSON.stringify(events, null, 2));

    // Any subsequent record() re-trims and re-saves -- the stale event should be gone.
    store.record({ event: 'screen_view', screen: 'Settings' });
    const remaining = store.list('prod');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].screen).toBe('Settings');
  });

  it('keeps only the most recent MAX_EVENTS (15000) when the count cap is exceeded', () => {
    const filePath = path.join(tempDir, 'analytics.json');
    const now = Date.now();
    const seeded = Array.from({ length: 15000 }, (_, i) => ({
      id: `seed-${i}`,
      event: 'screen_view',
      screen: `seed-${i}`,
      displayName: null,
      appVersion: null,
      mode: 'prod',
      meta: null,
      at: new Date(now - (15000 - i) * 1000).toISOString(),
    }));
    writeFileSync(filePath, JSON.stringify(seeded, null, 2));

    store.record({ event: 'screen_view', screen: 'newest' });
    const all = store.list('prod');
    expect(all).toHaveLength(15000);
    expect(all[0].screen).toBe('seed-1');
    expect(all[all.length - 1].screen).toBe('newest');
  });
});
