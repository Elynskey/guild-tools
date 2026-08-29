export type ArmorWeight = 'Cloth' | 'Leather' | 'Mail' | 'Plate';

const CLASS_ARMOR_WEIGHT: Record<string, ArmorWeight> = {
  Warrior: 'Plate',
  Paladin: 'Plate',
  'Death Knight': 'Plate',
  Hunter: 'Mail',
  Shaman: 'Mail',
  Evoker: 'Mail',
  Rogue: 'Leather',
  Druid: 'Leather',
  'Demon Hunter': 'Leather',
  Monk: 'Leather',
  Mage: 'Cloth',
  Priest: 'Cloth',
  Warlock: 'Cloth',
};

/** Armor weight a class can equip, or null for an unrecognized class name. */
export function armorWeightFor(className: string): ArmorWeight | null {
  return CLASS_ARMOR_WEIGHT[className] ?? null;
}

/**
 * Whether a class can equip an item with the given armor weight. `null` (non-Armor
 * items -- weapons, trinkets, rings, necks, cloaks, ...) has no restriction: those are
 * eligible for every class, per guild policy this loot picker doesn't judge weapon-type
 * restrictions (a Fury Warrior needing an off-hand axe vs. a Frost Mage needing a wand
 * are both just "a weapon" here).
 */
export function classCanEquip(className: string, itemArmorWeight: string | null): boolean {
  if (itemArmorWeight == null) return true;
  return armorWeightFor(className) === itemArmorWeight;
}
