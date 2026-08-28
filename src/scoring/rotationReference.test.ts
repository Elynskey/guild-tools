import { describe, expect, it } from 'vitest';
import { getRotationTip, ROTATION_PRIORITY } from './rotationReference';

// Confirmed against Blizzard's playable-specialization API, 2026-08-29 -- see the
// comment in rotationReference.ts for why this isn't assumed from memory.
const ALL_40_SPECS: [string, string][] = [
  ['Death Knight', 'Blood'],
  ['Death Knight', 'Frost'],
  ['Death Knight', 'Unholy'],
  ['Demon Hunter', 'Havoc'],
  ['Demon Hunter', 'Vengeance'],
  ['Demon Hunter', 'Devourer'],
  ['Druid', 'Feral'],
  ['Druid', 'Guardian'],
  ['Druid', 'Balance'],
  ['Druid', 'Restoration'],
  ['Evoker', 'Devastation'],
  ['Evoker', 'Preservation'],
  ['Evoker', 'Augmentation'],
  ['Hunter', 'Beast Mastery'],
  ['Hunter', 'Marksmanship'],
  ['Hunter', 'Survival'],
  ['Mage', 'Frost'],
  ['Mage', 'Arcane'],
  ['Mage', 'Fire'],
  ['Paladin', 'Holy'],
  ['Paladin', 'Retribution'],
  ['Paladin', 'Protection'],
  ['Priest', 'Holy'],
  ['Priest', 'Shadow'],
  ['Priest', 'Discipline'],
  ['Rogue', 'Subtlety'],
  ['Rogue', 'Assassination'],
  ['Rogue', 'Outlaw'],
  ['Shaman', 'Elemental'],
  ['Shaman', 'Enhancement'],
  ['Shaman', 'Restoration'],
  ['Warlock', 'Affliction'],
  ['Warlock', 'Destruction'],
  ['Warlock', 'Demonology'],
  ['Warrior', 'Arms'],
  ['Warrior', 'Fury'],
  ['Warrior', 'Protection'],
  ['Monk', 'Mistweaver'],
  ['Monk', 'Brewmaster'],
  ['Monk', 'Windwalker'],
];

describe('ROTATION_PRIORITY', () => {
  it('covers all 40 current specs', () => {
    expect(Object.keys(ROTATION_PRIORITY)).toHaveLength(40);
  });

  it.each(ALL_40_SPECS)('has a non-empty tip for %s %s', (cls, spec) => {
    const tip = getRotationTip(cls, spec);
    expect(tip).toBeTruthy();
    expect(tip!.length).toBeGreaterThan(10);
  });
});

describe('getRotationTip', () => {
  it('returns null for an unknown class/spec instead of throwing', () => {
    expect(getRotationTip('Made Up Class', 'Made Up Spec')).toBeNull();
  });
});
