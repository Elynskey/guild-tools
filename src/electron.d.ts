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

export interface ProfessionsProgress {
  phase: 'activity' | 'professions';
  done: number;
  total: number;
}

export interface ElectronAPI {
  getRoster: () => Promise<LiveRosterResult | null>;
  getProfessions: () => Promise<LiveProfessionsResult | null>;
  getCachedProfessions: () => Promise<LiveProfessionsResult | null>;
  onProfessionsProgress: (callback: (progress: ProfessionsProgress) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
