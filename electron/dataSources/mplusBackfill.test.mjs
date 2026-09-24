import { describe, expect, it } from 'vitest';
import { upgradesFor } from './mplusBackfill.cjs';

describe('upgradesFor', () => {
  it('turns a clear time into keystone chests against the dungeon par time', () => {
    expect(upgradesFor(1_900_000, 1_800_000)).toBe(0);
    expect(upgradesFor(1_800_000, 1_800_000)).toBe(1);
    expect(upgradesFor(1_440_000, 1_800_000)).toBe(2);
    expect(upgradesFor(1_080_000, 1_800_000)).toBe(3);
  });

  it('says 0 when the par time is unknown', () => {
    expect(upgradesFor(1_000_000, undefined)).toBe(0);
  });
});
