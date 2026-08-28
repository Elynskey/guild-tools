import type { DeathCause, Raider } from './scoring/types';
import type { CraftRequest, MemberProfessions, RecipeCatalogue } from './professions/types';
import type { RawLootRecord, RawTradeRecord } from './raid/lootLogic';

export interface RealmMismatch {
  name: string;
  wowauditRealm: string;
  observedRealms: string[];
}

export interface LiveRosterResult {
  raiders: Raider[];
  fetchedAt: string;
  heroicBossesKilled: number;
  realmMismatches: RealmMismatch[];
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

export interface RaidNight {
  code: string;
  date: string;
}

export interface PullRaider {
  name: string;
  role: 'tank' | 'healer' | 'dps' | null;
  metric: 'dps' | 'hps' | 'rankPercent' | null;
  value: number | null;
}

export interface PullDeath {
  name: string;
  ability: string;
}

export interface PullMechanicMiss {
  name: string;
  ability: string;
  what: string;
  fix: string;
}

export interface Pull {
  fightId: number;
  pullNumber: number;
  boss: string;
  kill: boolean;
  bossPercentage: number | null;
  durationMs: number;
  raiders: PullRaider[];
  deaths: PullDeath[];
  mechanicMisses: PullMechanicMiss[];
}

export interface PullFeedbackResult {
  pulls: Pull[];
}

export interface NightSnapshotEntry {
  nightParse: number;
  nightDeaths: number;
  nightPulls: number;
  nightDeathCauses: DeathCause[];
}

export interface AuthState {
  provider: 'discord' | 'battlenet';
  displayName: string;
  id: string | number;
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
  listCraftRequests: () => Promise<CraftRequest[]>;
  addCraftRequest: (requester: string, profession: string, description: string) => Promise<CraftRequest[]>;
  toggleCraftRequestFulfilled: (id: string) => Promise<CraftRequest[]>;
  removeCraftRequest: (id: string) => Promise<CraftRequest[]>;
  getLootLog: () => Promise<{ records: RawLootRecord[]; trades: RawTradeRecord[]; status: 'ok' | 'not_configured' | 'addon_not_installed' }>;
  getWowPathConfig: () => Promise<{ configured: string | null; resolved: string | null; valid: boolean }>;
  setWowPath: (wowPath: string) => Promise<{ configured: string | null; resolved: string | null; valid: boolean }>;
  pickWowFolder: () => Promise<string | null>;
  installLootAddon: () => Promise<{ ok: true; dest: string } | { ok: false; error: string }>;
  listRaidNights: () => Promise<RaidNight[] | null>;
  getPullFeedback: (code: string) => Promise<PullFeedbackResult | null>;
  getNightSnapshot: (code: string) => Promise<Record<string, NightSnapshotEntry> | null>;
  getAuthState: () => Promise<AuthState | null>;
  signIn: () => Promise<AuthState>;
  signInDiscord: () => Promise<AuthState>;
  signOut: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
  /** Injected at build time from package.json's version — see vite.config.ts's `define`. */
  const __APP_VERSION__: string;
}
