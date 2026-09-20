import { describe, expect, it } from 'vitest';
import { evaluateRaidVerification, evaluateVerification, RAID_VERIFY_WINDOW_MS, VERIFY_WINDOW_MS } from './chatLogVerify';

const file = (lastWriteAt: number | null, sizeBytes: number | null, exists = true) => ({ exists, lastWriteAt, sizeBytes });

describe('evaluateVerification', () => {
  const baseline = file(1_000_000, 5000);

  it('keeps waiting while nothing has been written and the window is open', () => {
    expect(evaluateVerification(baseline, file(1_000_000, 5000), 5_000)).toBe('waiting');
  });

  it('verifies as soon as the file grows', () => {
    expect(evaluateVerification(baseline, file(1_004_000, 5120), 4_000)).toBe('verified');
  });

  it('verifies when the timestamp moves even if the size reading did not change', () => {
    expect(evaluateVerification(baseline, file(1_004_000, 5000), 4_000)).toBe('verified');
  });

  it('fails only once the window has passed with no new write', () => {
    expect(evaluateVerification(baseline, file(1_000_000, 5000), VERIFY_WINDOW_MS - 1)).toBe('waiting');
    expect(evaluateVerification(baseline, file(1_000_000, 5000), VERIFY_WINDOW_MS)).toBe('failed');
  });

  it('a write that lands right at the end still wins over the timeout', () => {
    expect(evaluateVerification(baseline, file(1_029_000, 5200), VERIFY_WINDOW_MS + 500)).toBe('verified');
  });

  it('counts a log file that did not exist at the start but does now (logging just switched on)', () => {
    expect(evaluateVerification(file(null, null, false), file(2_000_000, 300), 3_000)).toBe('verified');
  });

  it('a file that vanishes or never exists is not verified', () => {
    expect(evaluateVerification(file(null, null, false), file(null, null, false), 1_000)).toBe('waiting');
    expect(evaluateVerification(baseline, file(null, null, false), VERIFY_WINDOW_MS)).toBe('failed');
  });
});

describe('evaluateRaidVerification (one chat line verifies every officer at once)', () => {
  const START = 1_000_000;
  const officers = [
    { officerName: 'Quixhea', lastWriteSeenAt: START + 4_000 },
    { officerName: 'LordHeretic', lastWriteSeenAt: START + 7_000 },
    { officerName: 'Shrty', lastWriteSeenAt: null },
    { officerName: 'Perseffonee', lastWriteSeenAt: START - 60_000 }, // wrote earlier, not because of this check
  ];

  it('marks officers whose log changed after the check began as verified and the rest as waiting', () => {
    const r = evaluateRaidVerification(START, officers, 10_000);
    expect(r.officers.map((o) => [o.name, o.status])).toEqual([
      ['Quixhea', 'verified'],
      ['LordHeretic', 'verified'],
      ['Shrty', 'waiting'],
      ['Perseffonee', 'waiting'],
    ]);
    expect(r.allVerified).toBe(false);
    expect(r.expired).toBe(false);
  });

  it('when the window ends, everyone who never wrote is failed', () => {
    const r = evaluateRaidVerification(START, officers, RAID_VERIFY_WINDOW_MS);
    expect(r.expired).toBe(true);
    expect(r.officers.filter((o) => o.status === 'failed').map((o) => o.name)).toEqual(['Shrty', 'Perseffonee']);
  });

  it('reports allVerified once every officer has written', () => {
    const all = officers.map((o) => ({ ...o, lastWriteSeenAt: START + 5_000 }));
    expect(evaluateRaidVerification(START, all, 6_000).allVerified).toBe(true);
  });

  it('a write exactly at the start does not count (it happened before the check)', () => {
    expect(evaluateRaidVerification(START, [{ officerName: 'A', lastWriteSeenAt: START }], 3_000).officers[0].status).toBe('waiting');
  });

  it('an empty officer list is trivially all-verified (nobody else is reporting)', () => {
    expect(evaluateRaidVerification(START, [], 3_000).allVerified).toBe(true);
  });
});
