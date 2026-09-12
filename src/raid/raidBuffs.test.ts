import { describe, expect, it } from 'vitest';
import { getRaidUtility, utilityGainedBy, raidBuffCoverage, dpsRangeForClass, dpsRangeForSpec } from './raidBuffs';

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

describe('raidBuffCoverage', () => {
  it('marks every tag covered when the roster brings all of them', () => {
    const coverage = raidBuffCoverage(['Shaman', 'Death Knight', 'Demon Hunter', 'Monk', 'Druid']);
    expect(coverage.every((c) => c.covered)).toBe(true);
  });

  it('marks a tag uncovered when nobody in the roster brings it', () => {
    const coverage = raidBuffCoverage(['Rogue', 'Warrior']);
    expect(coverage.find((c) => c.tag === 'Bloodlust/Heroism')?.covered).toBe(false);
    expect(coverage.find((c) => c.tag === 'Chaos Brand')?.covered).toBe(false);
  });

  it('covers Bloodlust/Heroism from any one of the classes that bring it', () => {
    const coverage = raidBuffCoverage(['Mage']);
    expect(coverage.find((c) => c.tag === 'Bloodlust/Heroism')?.covered).toBe(true);
  });
});

describe('dpsRangeForClass', () => {
  it('classifies single-DPS-spec classes unambiguously', () => {
    expect(dpsRangeForClass('Warrior')).toBe('melee');
    expect(dpsRangeForClass('Mage')).toBe('ranged');
    expect(dpsRangeForClass('Priest')).toBe('ranged');
    expect(dpsRangeForClass('Demon Hunter')).toBe('melee');
  });

  it('treats classes with both a melee and a ranged DPS spec as ambiguous rather than guessing', () => {
    expect(dpsRangeForClass('Hunter')).toBe('ambiguous');
    expect(dpsRangeForClass('Shaman')).toBe('ambiguous');
    expect(dpsRangeForClass('Druid')).toBe('ambiguous');
  });

  it('treats an unrecognized class as ambiguous rather than throwing', () => {
    expect(dpsRangeForClass('Not A Class')).toBe('ambiguous');
  });
});

describe('dpsRangeForSpec', () => {
  it('resolves the three class-level-ambiguous classes precisely once spec is known', () => {
    expect(dpsRangeForSpec('Hunter', 'Survival')).toBe('melee');
    expect(dpsRangeForSpec('Hunter', 'Beast Mastery')).toBe('ranged');
    expect(dpsRangeForSpec('Hunter', 'Marksmanship')).toBe('ranged');
    expect(dpsRangeForSpec('Shaman', 'Enhancement')).toBe('melee');
    expect(dpsRangeForSpec('Shaman', 'Elemental')).toBe('ranged');
    expect(dpsRangeForSpec('Druid', 'Feral')).toBe('melee');
    expect(dpsRangeForSpec('Druid', 'Balance')).toBe('ranged');
  });

  it('does not confuse a spec name that collides across classes (Frost)', () => {
    expect(dpsRangeForSpec('Death Knight', 'Frost')).toBe('melee');
    expect(dpsRangeForSpec('Mage', 'Frost')).toBe('ranged');
  });

  it('falls back to the class-level heuristic when spec is null', () => {
    expect(dpsRangeForSpec('Warrior', null)).toBe('melee');
    expect(dpsRangeForSpec('Hunter', null)).toBe('ambiguous');
  });

  it('falls back to the class-level heuristic when spec is unrecognized', () => {
    expect(dpsRangeForSpec('Hunter', 'Not A Real Spec')).toBe('ambiguous');
  });
});
