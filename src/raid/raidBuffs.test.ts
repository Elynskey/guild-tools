import { describe, expect, it } from 'vitest';
import { getRaidUtility, utilityGainedBy } from './raidBuffs';

describe('getRaidUtility', () => {
  it('returns the known tags for a tracked class', () => {
    expect(getRaidUtility('Shaman')).toEqual(['Bloodlust/Heroism']);
  });

  it('returns an empty array for a class with no tracked utility', () => {
    expect(getRaidUtility('Rogue')).toEqual([]);
  });

  it('returns an empty array for an unrecognized class rather than throwing', () => {
    expect(getRaidUtility('Not A Class')).toEqual([]);
  });
});

describe('utilityGainedBy', () => {
  it('returns tags the candidate brings that nothing in the existing group covers', () => {
    expect(utilityGainedBy('Shaman', ['Rogue', 'Warrior'])).toEqual(['Bloodlust/Heroism']);
  });

  it('excludes tags already covered by the existing group', () => {
    expect(utilityGainedBy('Mage', ['Shaman'])).toEqual([]);
  });

  it('returns an empty array when the candidate brings nothing tracked', () => {
    expect(utilityGainedBy('Rogue', [])).toEqual([]);
  });
});
