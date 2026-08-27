import type { Raider } from './scoring/types';
import type { MemberProfessions, RecipeCatalogue } from './professions/types';

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

export interface UpdateInfo {
  version: string;
  releaseUrl: string;
}

export interface LiveRecipeCatalogueResult {
  catalogue: RecipeCatalogue;
  fetchedAt: string;
}

export interface ElectronAPI {
  getRoster: () => Promise<LiveRosterResult | null>;
  getProfessions: () => Promise<LiveProfessionsResult | null>;
  getCachedProfessions: () => Promise<LiveProfessionsResult | null>;
  onProfessionsProgress: (callback: (progress: ProfessionsProgress) => void) => () => void;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  openReleasePage: (url: string) => Promise<void>;
  getCachedRecipeCatalogue: () => Promise<LiveRecipeCatalogueResult | null>;
  getRecipeCatalogue: () => Promise<LiveRecipeCatalogueResult | null>;
  copyToClipboard: (text: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
  /** Injected at build time from package.json's version — see vite.config.ts's `define`. */
  const __APP_VERSION__: string;
}
