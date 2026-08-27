export interface ProfessionTier {
  tierName: string;
  skillPoints: number;
  maxSkillPoints: number;
  knownRecipes: string[];
}

export interface ProfessionEntry {
  profession: string;
  tiers: ProfessionTier[];
}

export interface CharacterProfessions {
  characterName: string;
  realm: string;
  class: string;
  lastLoginDaysAgo: number;
  professions: ProfessionEntry[];
}

export interface MemberProfessions {
  mainName: string;
  characters: CharacterProfessions[];
}

export interface ProfessionsResult {
  members: MemberProfessions[];
  fetchedAt: string;
  source: 'live' | 'sample';
}

export interface CraftRequest {
  id: string;
  requester: string;
  profession: string;
  description: string;
  createdAt: string;
  fulfilled: boolean;
}

/**
 * Canonical recipe list per profession per expansion, from Blizzard's Profession Game Data
 * API (electron/dataSources/recipeCatalogue.cjs) — a guild-independent fact (what recipes
 * EXIST), not per-character data (what a character KNOWS). Keys are profession names and
 * expansion labels in the same format as ProfessionEntry/deriveExpansionLabel.
 */
export type RecipeCatalogue = Record<string, Record<string, string[]>>;

export interface RecipeCatalogueResult {
  catalogue: RecipeCatalogue;
  fetchedAt: string;
}
