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
    expect(heartbeats.listActiveHeartbeats()).toEqual([{ officerName: 'Vitaezra', chatLogActive: true, lastSeenAt: expect.any(Number) }]);
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
