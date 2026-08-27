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
