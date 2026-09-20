import { describe, expect, it } from 'vitest';
import { evaluateVerification, VERIFY_WINDOW_MS } from './chatLogVerify';

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
