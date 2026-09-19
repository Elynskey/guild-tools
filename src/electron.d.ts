import type { DeathCause, Raider } from './scoring/types';
import type { CraftRequest, MemberProfessions, RecipeCatalogue } from './professions/types';
import type { RawLootRecord, RawNeedLossRecord, RawTradeRecord } from './raid/lootLogic';

export interface ManualLootRecordInput {
  winner: string;
  itemName: string;
  boss?: string;
  slot?: string;
  /** Unix seconds. Omitted (or left at its default) means "now" -- set explicitly when logging a night after the fact, so it groups into the right night instead of today's. */
  time?: number;
  /** Set only when itemName came from the smart picker (a real item in this tier's loot table) -- lets a manual add still resolve a real icon via getItemIconUrls instead of always going iconless. Omitted/null for the free-text fallback fields. */
  itemId?: number | null;
  /** "Normal" | "Heroic", officer-picked -- optional, since not every manual correction knows or needs one. */
  difficulty?: string | null;
}

export interface LootRecordPatch {
  winner?: string;
  itemName?: string;
  boss?: string;
  slot?: string;
  difficulty?: string | null;
}

export interface BossLootItem {
  name: string;
  slot: string;
  /** Cloth/Leather/Mail/Plate, or null for a non-Armor item (weapons, trinkets, rings, necks, cloaks, ...) eligible for every class. */
  armorWeight: string | null;
}

export interface BossLootTable {
  bosses: { id: number; name: string }[];
  /** Boss name -> item IDs that drop from it. */
  lootByBoss: Record<string, number[]>;
  items: Record<number, BossLootItem>;
}

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

export interface WowPathConfig {
  configured: string | null;
  resolved: string | null;
  valid: boolean;
  /** The character this PC plays, used to resolve the chat log's anonymous "You" wins. Detected from the client (see lootLog.cjs) unless `characterOverride` is set. */
  characterName: string | null;
  characterSource: 'manual' | 'addon' | 'wtf' | null;
  characterOverride: string | null;
}

export interface AddonVersionInfo {
  /** The addon copy carried by this build of the app. */
  bundled: string | null;
  /** What's installed in this PC's WoW folder right now (on disk -- the game only loads it on /reload or login). */
  installed: string | null;
  status: 'current' | 'outdated' | 'not_installed' | 'no_wow';
}

export interface RaidNight {
  code: string;
  date: string;
}

export interface PullRaider {
  name: string;
  role: 'tank' | 'healer' | 'dps' | null;
  metric: 'dps' | 'hps' | 'survivalPercent' | null;
  /** DPS/HPS: damage or healing per second over the fight time this raider was ALIVE (time after a death doesn't count; a battle rez brings them back). Survivability: a within-role percentile. */
  value: number | null;
  /** DPS/HPS only: the same total over time actually spent dealing it -- drops idle gaps while alive too, so it always reads higher than `value`. */
  activeValue?: number | null;
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

export interface GuildToolsSettings {
  raidSignupsChannelId: string;
  lootLogChannelId: string;
  gotmChannelId: string;
  /** Where a "Guild Tools (Test)" install posts Raid Signups/GOTM instead of the channels above -- e.g. CRD-TEST. Only ever read by a test-mode build; a normal install ignores these entirely. */
  testRaidSignupsChannelId: string;
  testGotmChannelId: string;
  gates: { rio: number; ilvl: number };
  minDps: number;
  /** Officer-wide: post addon-verified Need wins to the loot channel automatically as they sync in. Off by default. */
  autoPostLoot: boolean;
  /** Boss names excluded from the DPS check this tier -- deaths/healer/tank percentile/pulls are unaffected. */
  excludedBossesFromDps: string[];
}

export type RaidRole = 'tank' | 'healer' | 'dps';
export type TeamType = 'heroic' | 'alt';
export type AssignmentTier = 'primary' | 'backup';

export interface RaidSignupEntry {
  discordUserId: string;
  discordUsername: string;
  characterName: string;
  role: RaidRole;
  /** Self-reported at signup time (a real class picked from Discord, not a roster lookup) -- null for signups made before this field existed. */
  class: string | null;
  /** Self-reported alongside class, scoped to specs valid for that class+role (auto-filled with no extra prompt when only one spec is valid there). Can list more than one spec of the same role (e.g. flexible between Arms and Fury) -- never a mix of roles, since the spec list is already scoped to whichever role was picked first. Null only for signups made before this field existed. */
  specs: string[] | null;
  signedUpAt: string;
}

export interface RaidAssignment {
  discordUserId: string;
  tier: AssignmentTier;
}

export interface RaidSignupPost {
  id: string;
  raidName: string;
  teamType: TeamType;
  signupText: string;
  createdAt: string;
  discordChannelId: string | null;
  discordMessageId: string | null;
  signups: RaidSignupEntry[];
  assignments: Record<RaidRole, RaidAssignment[]>;
  finalizedAt: string | null;
}

export interface GotmVote {
  voterId: string;
  voterUsername: string;
  nomineeId: string;
  nomineeUsername: string;
  votedAt: string;
}

export interface GotmTallyEntry {
  nomineeId: string;
  nomineeUsername: string;
  count: number;
}

export interface GotmTieEntry {
  id: string;
  username: string;
}

export interface GotmPost {
  id: string;
  month: string;
  openedBy: string | null;
  introText: string;
  createdAt: string;
  discordChannelId: string | null;
  discordMessageId: string | null;
  votes: GotmVote[];
  tally?: GotmTallyEntry[];
  closedAt: string | null;
  winnerId: string | null;
  winnerUsername: string | null;
  winnerTieBrokeAmong: GotmTieEntry[] | null;
  winnerAnnounceText: string | null;
  winnerAnnounceMessageId: string | null;
}

export interface AnalyticsEvent {
  id: string;
  event: string;
  screen: string | null;
  displayName: string | null;
  appVersion: string | null;
  mode: 'prod' | 'test';
  meta: Record<string, unknown> | null;
  at: string;
}

export interface ElectronAPI {
  /** True only in a "Guild Tools (Test)" build -- Raid Signups/GOTM tag every request as test-mode when this is true. Everything else in the app is unaffected. */
  isTestMode: () => Promise<boolean>;
  /** Sends feedback as a direct Discord message to the maintainer -- same destination from the real app or a test-mode build, since the whole point is it always reaches the same person. `screen` is whatever the feedback button was open on (e.g. "Raid Signups"), `sender` the signed-in officer's display name if known. */
  sendFeedback: (message: string, screen: string, sender?: string | null) => Promise<{ ok: true }>;
  /** Logs one usage event (a screen visit or a key officer action) -- fire-and-forget, never throws in a way the caller needs to handle. `screen` and `meta` are optional context; `displayName`/`appVersion`/`mode` are filled in server-side, never passed from here. */
  trackEvent: (event: string, screen?: string | null, meta?: Record<string, unknown> | null) => Promise<{ ok: true }>;
  /** Raw, already-trimmed usage log for the Analytics screen -- scoped to this build's own mode (a test-mode build only ever sees test-mode events, same isolation as Raid Signups/GOTM). */
  listAnalyticsEvents: () => Promise<AnalyticsEvent[]>;
  getRoster: () => Promise<LiveRosterResult | null>;
  getProfessions: () => Promise<LiveProfessionsResult | null>;
  getCachedProfessions: () => Promise<LiveProfessionsResult | null>;
  onProfessionsProgress: (callback: (progress: ProfessionsProgress) => void) => () => void;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  openReleasePage: (url: string) => Promise<void>;
  openWarcraftLogsReport: (code: string) => Promise<void>;
  downloadAndInstallUpdate: () => Promise<{ ok: true }>;
  getCachedRecipeCatalogue: () => Promise<LiveRecipeCatalogueResult | null>;
  getRecipeCatalogue: () => Promise<LiveRecipeCatalogueResult | null>;
  copyToClipboard: (text: string) => Promise<void>;
  listCraftRequests: () => Promise<CraftRequest[]>;
  addCraftRequest: (requester: string, profession: string, description: string) => Promise<CraftRequest[]>;
  fulfillCraftRequest: (id: string, fulfilledBy: string) => Promise<CraftRequest[]>;
  removeCraftRequest: (id: string) => Promise<CraftRequest[]>;
  getLootLog: () => Promise<{ records: RawLootRecord[]; trades: RawTradeRecord[]; needLosses: RawNeedLossRecord[]; status: 'ok' | 'not_configured' | 'addon_not_installed' }>;
  addManualLootRecord: (record: ManualLootRecordInput) => Promise<RawLootRecord[]>;
  updateLootRecord: (id: string, patch: LootRecordPatch) => Promise<RawLootRecord[]>;
  removeLootRecord: (id: string) => Promise<RawLootRecord[]>;
  removeLootTrade: (id: string) => Promise<RawTradeRecord[]>;
  deleteLootNight: (
    startTime: number,
    endTime: number,
  ) => Promise<{ records: RawLootRecord[]; trades: RawTradeRecord[]; needLosses: RawNeedLossRecord[]; removed: { records: number; trades: number; needLosses: number } }>;
  getItemIconUrls: (itemIds: number[]) => Promise<Record<number, string | null>>;
  getBossLootTable: () => Promise<BossLootTable | null>;
  postLootNightToDiscord: (messages: string[]) => Promise<{ posted: number }>;
  getWowPathConfig: () => Promise<WowPathConfig>;
  setWowPath: (wowPath: string) => Promise<WowPathConfig>;
  /** Sets (or, with an empty string, clears) the manual override -- detection from the client is the default. */
  setCharacterName: (name: string) => Promise<WowPathConfig>;
  getAddonVersionInfo: () => Promise<AddonVersionInfo>;
  getChatTailStatus: () => Promise<{
    lastPollAt: number | null;
    lastStatus: 'ok' | 'not_configured' | 'error' | null;
    capturedThisSession: number;
    lastCaptureAt: number | null;
    chatLog: { path: string | null; exists: boolean; active: boolean };
    /** The combat log is what tells Guild Tools which boss was just killed, so a win can be attributed (and auto-posted) with no /reload. */
    combatLog: { exists: boolean; active: boolean; lastKill: { boss: string; difficultyId: number; endedAt: number } | null };
  }>;
  getLootCaptureHeartbeats: () => Promise<{ heartbeats: { officerName: string; chatLogActive: boolean; lastSeenAt: number }[] }>;
  pickWowFolder: () => Promise<string | null>;
  installLootAddon: () => Promise<{ ok: true; dest: string } | { ok: false; error: string }>;
  getSettings: () => Promise<GuildToolsSettings>;
  saveSettings: (settings: GuildToolsSettings) => Promise<GuildToolsSettings>;
  getDiscordInviteUrl: () => Promise<string>;
  openDiscordInvite: () => Promise<void>;
  listRaidSignups: () => Promise<RaidSignupPost[]>;
  getRaidSignup: (id: string) => Promise<RaidSignupPost | null>;
  createRaidSignup: (raidName: string, teamType: TeamType, signupText: string) => Promise<RaidSignupPost>;
  setRaidSignupAssignments: (id: string, assignments: Record<RaidRole, RaidAssignment[]>) => Promise<RaidSignupPost | null>;
  finalizeRaidSignup: (id: string) => Promise<RaidSignupPost | null>;
  listGotmPosts: () => Promise<GotmPost[]>;
  getGotmPost: (id: string) => Promise<GotmPost | null>;
  getCurrentGotmPost: () => Promise<GotmPost | null>;
  createGotmPost: (openedBy: string | null, introText: string) => Promise<GotmPost>;
  remindGotmVoters: (id: string, reminderText: string) => Promise<GotmPost | null>;
  closeGotmVoting: (id: string) => Promise<GotmPost | null>;
  announceGotmWinner: (id: string, winnerAnnounceText: string) => Promise<GotmPost | null>;
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
