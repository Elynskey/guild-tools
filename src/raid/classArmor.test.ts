import { describe, expect, it } from 'vitest';
import { armorWeightFor, classCanEquip } from './classArmor';

describe('armorWeightFor', () => {
  it('resolves each armor weight to a representative class', () => {
    expect(armorWeightFor('Warrior')).toBe('Plate');
    expect(armorWeightFor('Hunter')).toBe('Mail');
    expect(armorWeightFor('Rogue')).toBe('Leather');
    expect(armorWeightFor('Mage')).toBe('Cloth');
  });

  it('returns null for an unrecognized class name', () => {
    expect(armorWeightFor('Not A Class')).toBeNull();
  });
});

describe('classCanEquip', () => {
  it('allows any class to equip a non-Armor item (null armor weight)', () => {
    expect(classCanEquip('Mage', null)).toBe(true);
    expect(classCanEquip('Warrior', null)).toBe(true);
  });

  it('allows a class to equip armor matching its own weight', () => {
    expect(classCanEquip('Warrior', 'Plate')).toBe(true);
    expect(classCanEquip('Druid', 'Leather')).toBe(true);
  });

  it('blocks a class from equipping armor of a different weight', () => {
    expect(classCanEquip('Mage', 'Plate')).toBe(false);
    expect(classCanEquip('Warrior', 'Cloth')).toBe(false);
  });

  it('blocks an unrecognized class from any armor weight', () => {
    expect(classCanEquip('Not A Class', 'Cloth')).toBe(false);
  });
});
