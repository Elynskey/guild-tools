import type { RecipeCatalogue } from './types';

/**
 * Fabricated demo data — shown when the live pipeline (Blizzard API) isn't configured.
 * Ported from the design handoff's sample `BOOK`, with expansion keys translated from the
 * design's marketing names to this app's real Blizzard-derived tier labels (see
 * src/professions/expansions.ts) — "The War Within" content is tagged "Khaz Algar" in
 * Blizzard's own tier names, "Dragonflight" is "Dragon Isles", etc.
 */
export const SAMPLE_RECIPE_CATALOGUE: RecipeCatalogue = {
  Alchemy: {
    'Khaz Algar': ['Flask of Alchemical Chaos', 'Algari Healing Potion', 'Tempered Potion', 'Potion of Unwavering Focus', "Cavedweller's Delight", 'Sustaining Alchemist Stone'],
    'Dragon Isles': ['Phial of Tepid Versatility', 'Potion of Frozen Fatality'],
    Shadowlands: ['Spiritual Healing Potion'],
    Legion: ['Flask of the Whispered Pact'],
    Classic: ['Elixir of the Mongoose'],
  },
  Blacksmithing: {
    'Khaz Algar': ['Charged Slicer', 'Everforged Breastplate', "Beledar's Bulwark", 'Ironclaw Greatsword', 'Sanctified Chain Coif', 'Charged Alloy Whetstone'],
    'Dragon Isles': ['Obsidian Seared Claymore', 'Khaz Algar Alloy Plating'],
    Shadowlands: ['Shadowsteel Girdle'],
    Legion: ['Demonsteel Bar'],
    Classic: ['Thorium Armor'],
  },
  Enchanting: {
    'Khaz Algar': [
      'Enchant Weapon — Authority of Air',
      'Enchant Ring — Radiant Critical Strike',
      "Enchant Chest — Council's Guile",
      'Algari Mana Oil',
      "Enchant Boots — Defender's March",
      'Enchant Cloak — Chant of Winged Grace',
    ],
    'Dragon Isles': ['Enchant Weapon — Wafting Devotion', 'Illusory Adornment: Dreams'],
    Shadowlands: ['Enchant Ring — Tenet of Haste'],
    Legion: ['Enchant Cloak — Word of Strength'],
    Classic: ['Enchant Weapon — Crusader'],
  },
  Engineering: {
    'Khaz Algar': ['Algari Repair Bot', 'Sonic Locator', 'Overengineered Sleep Deprivor', 'Pactspeaker Sight', 'Rocket-Powered Jump Boots', 'Zapthrottle Soul Inhaler'],
    'Dragon Isles': ['Wyrmhole Generator', 'Tinker: Plane Displacer'],
    Shadowlands: ['Sinvyr Camera'],
    Legion: ['Reaves Module'],
    Classic: ['Gnomish Death Ray'],
  },
  Inscription: {
    'Khaz Algar': [
      'Vantus Rune — Nerub-ar Palace',
      'Algari Missive of the Feverflare',
      "Weathered Explorer's Stave",
      'Darkmoon Deck: Symbiosis',
      'Scroll of Sacred Shielding',
      'Codified Blueprint',
    ],
    'Dragon Isles': ['Draconic Missive of the Peerless', 'Darkmoon Deck: Rime'],
    Shadowlands: ['Contract: The Undying Army'],
    Legion: ['Tome of the Tranquil Mind'],
    Classic: ['Glyph of Fortitude'],
  },
  Jewelcrafting: {
    'Khaz Algar': ['Elusive Blasphemite', 'Culminating Blasphemite', 'Ruby Ring of Nobility', 'Deepstone Chisel', 'Fractured Gemstone Loupe', 'Insightful Blasphemite'],
    'Dragon Isles': ['Fierce Illimited Diamond', 'Crafty Alexstraszite'],
    Shadowlands: ['Shaded Jewel Doublet'],
    Legion: ['Deep Amber Pendant'],
    Classic: ['Ruby Serpent'],
  },
  Leatherworking: {
    'Khaz Algar': ['Duskthread Lining', 'Stormbound Armor Kit', 'Adorned Scale Vest', 'Everstable Barding', 'Weavercloth Satchel', 'Fanged Axe Grip'],
    'Dragon Isles': ['Toxic Thorn Footwraps', 'Fang Adornments'],
    Shadowlands: ['Pallid Bone Bracers'],
    Legion: ['Dreadleather Jerkin'],
    Classic: ['Devilsaur Gauntlets'],
  },
  Tailoring: {
    'Khaz Algar': ['Weavercloth Bolt', 'Dawnthread Lining', 'Consecrated Cloth Robe', 'Sanctified Weavercloth Bag', 'Chrono-Threaded Gloves', 'Gralthos Cloak of Light'],
    'Dragon Isles': ['Azureweave Slippers', 'Chronocloth Reagent Bag'],
    Shadowlands: ['Shrouded Cloth Cape'],
    Legion: ['Imbued Silkweave Bag'],
    Classic: ['Mooncloth Robe'],
  },
};
