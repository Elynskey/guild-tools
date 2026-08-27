import type { Raider } from './scoring/types';
import type { MemberProfessions } from './professions/types';

export interface LiveRosterResult {
  raiders: Raider[];
  fetchedAt: string;
  heroicBossesKilled: number;
}

export interface LiveProfessionsResult {
  members: MemberProfessions[];
  fetchedAt: string;
}

export interface ElectronAPI {
  getRoster: () => Promise<LiveRosterResult | null>;
  getProfessions: () => Promise<LiveProfessionsResult | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
