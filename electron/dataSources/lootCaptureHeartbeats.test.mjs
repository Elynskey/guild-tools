import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module keeps its Map at module scope, so each test needs a fresh import --
// vi.resetModules() + dynamic import gives every test its own isolated heartbeat map.
let heartbeats;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  heartbeats = await import('./lootCaptureHeartbeats.cjs');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lootCaptureHeartbeats', () => {
  it('reports an officer who just checked in', () => {
    heartbeats.recordHeartbeat('Vitaezra', true);
    expect(heartbeats.listActiveHeartbeats()).toEqual([{ officerName: 'Vitaezra', chatLogActive: true, writingNow: true, lastActiveAt: expect.any(Number), lastSeenAt: expect.any(Number) }]);
  });

  it('tracks multiple officers independently', () => {
    heartbeats.recordHeartbeat('Vitaezra', true);
    heartbeats.recordHeartbeat('Grimsyl', false);
    const list = heartbeats.listActiveHeartbeats();
    expect(list).toHaveLength(2);
    expect(list.find((h) => h.officerName === 'Vitaezra').chatLogActive).toBe(true);
    expect(list.find((h) => h.officerName === 'Grimsyl').chatLogActive).toBe(false);
  });

  it('a later heartbeat from the same officer overwrites the earlier one', () => {
    heartbeats.recordHeartbeat('Vitaezra', false);
    heartbeats.recordHeartbeat('Vitaezra', true);
    const list = heartbeats.listActiveHeartbeats();
    expect(list).toHaveLength(1);
    expect(list[0].chatLogActive).toBe(true);
  });

  it('drops a heartbeat once it goes stale', () => {
    heartbeats.recordHeartbeat('Vitaezra', true);
    vi.advanceTimersByTime(31 * 1000);
    expect(heartbeats.listActiveHeartbeats()).toEqual([]);
  });

  it('keeps a heartbeat that is old but not yet stale', () => {
    heartbeats.recordHeartbeat('Vitaezra', true);
    vi.advanceTimersByTime(29 * 1000);
    expect(heartbeats.listActiveHeartbeats()).toHaveLength(1);
  });

  it('ignores a heartbeat with no officer name', () => {
    heartbeats.recordHeartbeat(null, true);
    heartbeats.recordHeartbeat('', true);
    expect(heartbeats.listActiveHeartbeats()).toEqual([]);
  });
});

describe('an officer who was writing recently still counts as logging through a quiet stretch', () => {
  // The app re-reports every 10s; simulate that by beating repeatedly across the gap.
  const beatFor = (minutes, active, name = 'Quixhea') => {
    for (let i = 0; i < minutes * 6; i++) {
      heartbeats.recordHeartbeat(name, active);
      vi.advanceTimersByTime(10 * 1000);
    }
  };

  it('stays on when the raw reading drops to false (no chat for 5+ minutes)', () => {
    beatFor(1, true);
    beatFor(8, false);
    const [h] = heartbeats.listActiveHeartbeats();
    expect(h.writingNow).toBe(false);
    expect(h.chatLogActive).toBe(true);
  });

  it('goes off once the last active reading is older than the recent window', () => {
    beatFor(1, true);
    beatFor(16, false);
    const [h] = heartbeats.listActiveHeartbeats();
    expect(h.chatLogActive).toBe(false);
  });

  it('never counts an officer whose app has not reported a write at all', () => {
    beatFor(10, false, 'Shrty');
    const [h] = heartbeats.listActiveHeartbeats();
    expect(h.chatLogActive).toBe(false);
    expect(h.lastActiveAt).toBeNull();
  });

  it('a fresh write renews the window', () => {
    beatFor(1, true);
    beatFor(14, false);
    beatFor(1, true);
    beatFor(14, false);
    expect(heartbeats.listActiveHeartbeats()[0].chatLogActive).toBe(true);
  });

  it('an app that stops reporting still drops out entirely', () => {
    beatFor(1, true);
    vi.advanceTimersByTime(31 * 1000);
    expect(heartbeats.listActiveHeartbeats()).toEqual([]);
  });
});
