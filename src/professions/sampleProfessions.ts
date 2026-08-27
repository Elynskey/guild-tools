import type { MemberProfessions } from './types';

/** Fabricated demo data — shown when the live pipeline (Blizzard API) isn't configured. */
export const SAMPLE_MEMBERS: MemberProfessions[] = [
  {
    mainName: 'Vadailla',
    characters: [
      {
        characterName: 'Vadailla',
        realm: 'The Scryers',
        class: 'Warrior',
        lastLoginDaysAgo: 1,
        professions: [
          {
            profession: 'Blacksmithing',
            tiers: [{ tierName: 'Khaz Algar Blacksmithing', skillPoints: 68, maxSkillPoints: 100, knownRecipes: ['Charged Bulwark Armor', 'Charged Fists', 'Titan-Forged Sword'] }],
          },
          { profession: 'Mining', tiers: [{ tierName: 'Khaz Algar Mining', skillPoints: 90, maxSkillPoints: 100, knownRecipes: [] }] },
        ],
      },
    ],
  },
  {
    mainName: 'Perseffonee',
    characters: [
      {
        characterName: 'Perseffonee',
        realm: 'The Scryers',
        class: 'Priest',
        lastLoginDaysAgo: 0,
        professions: [
          {
            profession: 'Tailoring',
            tiers: [{ tierName: 'Khaz Algar Tailoring', skillPoints: 100, maxSkillPoints: 100, knownRecipes: ['Duskweave Robe', 'Sureweave Cord', 'Silksteel Cloak'] }],
          },
          {
            profession: 'Enchanting',
            tiers: [{ tierName: 'Khaz Algar Enchanting', skillPoints: 85, maxSkillPoints: 100, knownRecipes: ['Enchant Cloak - Homebound Speed', 'Enchant Weapon - Authority of Radiant Power'] }],
          },
        ],
      },
      { characterName: 'Perseffskin', realm: 'The Scryers', class: 'Rogue', lastLoginDaysAgo: 4, professions: [{ profession: 'Skinning', tiers: [{ tierName: 'Khaz Algar Skinning', skillPoints: 100, maxSkillPoints: 100, knownRecipes: [] }] }] },
    ],
  },
  {
    mainName: 'Zalanto',
    characters: [
      {
        characterName: 'Zalanto',
        realm: 'The Scryers',
        class: 'Warlock',
        lastLoginDaysAgo: 2,
        professions: [
          { profession: 'Alchemy', tiers: [{ tierName: 'Khaz Algar Alchemy', skillPoints: 72, maxSkillPoints: 100, knownRecipes: ['Potion of Unwavering Focus', 'Cauldron of Fervor'] }] },
          { profession: 'Herbalism', tiers: [{ tierName: 'Khaz Algar Herbalism', skillPoints: 100, maxSkillPoints: 100, knownRecipes: [] }] },
        ],
      },
    ],
  },
  {
    mainName: 'Hotchick',
    characters: [
      {
        characterName: 'Hotchick',
        realm: 'The Scryers',
        class: 'Hunter',
        lastLoginDaysAgo: 1,
        professions: [
          { profession: 'Leatherworking', tiers: [{ tierName: 'Khaz Algar Leatherworking', skillPoints: 55, maxSkillPoints: 100, knownRecipes: ['Dawnwoven Vest', 'Reinforced Dawnwoven Boots'] }] },
          { profession: 'Skinning', tiers: [{ tierName: 'Khaz Algar Skinning', skillPoints: 100, maxSkillPoints: 100, knownRecipes: [] }] },
        ],
      },
    ],
  },
  {
    mainName: 'Torvyn',
    characters: [
      {
        characterName: 'Torvyn',
        realm: 'The Scryers',
        class: 'Demon Hunter',
        lastLoginDaysAgo: 6,
        professions: [{ profession: 'Engineering', tiers: [{ tierName: 'Khaz Algar Engineering', skillPoints: 40, maxSkillPoints: 100, knownRecipes: ['Explosive Decoy'] }] }],
      },
    ],
  },
  {
    mainName: 'Duskwren',
    characters: [
      {
        characterName: 'Duskwren',
        realm: 'The Scryers',
        class: 'Priest',
        lastLoginDaysAgo: 3,
        professions: [{ profession: 'Inscription', tiers: [{ tierName: 'Khaz Algar Inscription', skillPoints: 63, maxSkillPoints: 100, knownRecipes: ['Contract: Council of Dornogal', 'Darkmoon Deck Box'] }] }],
      },
    ],
  },
  {
    mainName: 'Kaldresh',
    characters: [
      {
        characterName: 'Kaldresh',
        realm: 'The Scryers',
        class: 'Paladin',
        lastLoginDaysAgo: 12,
        professions: [{ profession: 'Jewelcrafting', tiers: [{ tierName: 'Khaz Algar Jewelcrafting', skillPoints: 78, maxSkillPoints: 100, knownRecipes: ['Ruby Ring Setting', 'Carved Ivory Ring'] }] }],
      },
    ],
  },
];
