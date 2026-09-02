export type Role = 'tank' | 'healer' | 'dps';
export type Window = 'rolled' | 'night';
export type Band = 'green' | 'yellow' | 'red' | 'ineligible';

/** Per-slot breakdown behind gearCompletion -- what's actually empty, not just the rounded %. Null when the source data doesn't carry it (sample mode). */
export interface GearDetail {
  /** Display names of enchantable slots (Back, Chest, Wrist, Legs, Feet, rings, weapons) with no enchant applied. */
  missingEnchants: string[];
  emptySockets: number;
  totalSockets: number;
}

/** One death event's primary cause — the top-damage ability in Warcraft Logs' per-death breakdown, joined to the boss it happened on. */
export interface DeathCause {
  boss: string;
  ability: string;
}

/** One completed Mythic+ run, from Raider.IO's mythic_plus_recent_runs (confirmed live -- newest first, capped at 10). */
export interface MythicPlusRun {
  dungeon: string;
  level: number;
  /** ISO timestamp. */
  completedAt: string;
  score: number;
  /** 0-3 -- how many keystone upgrade chests this run earned (timed how far under par). */
  upgrades: number;
  iconUrl: string;
  /** Raider.IO's own page for this specific run. */
  url: string;
}

export interface Raider {
  name: string;
  role: Role;
  class: string;
  spec: string;
  rioCurrent: number;
  rioHighestThisSeason: number;
  ilvlEquipped: number;
  ilvlHighestThisSeason: number;
  /** Newest first, capped at 10 -- see MythicPlusRun. */
  mythicPlusRuns: MythicPlusRun[];
  /** DPS: % of the guild's minimum DPS while alive. Healers/tanks: HPS/survivability percentile 0-100, pooled across the season so far (see warcraftlogs.cjs). */
  perf: number;
  /** Raw metric behind perf -- dps: raw damage/s from the same report perf uses; healer: season-average healing/s; tank: season-average damage taken/s (lower is better -- less damage taken is more survivable). Null when unavailable (sample mode falls back to a synthesized value; a real fetch can still be null for a brand-new raider with too little logged history). */
  perfRaw: number | null;
  /** % of gem/enchant slots correct vs the monthly reference table. */
  gearCompletion: number;
  /** What's behind gearCompletion -- which slots lack an enchant, how many sockets are empty. Null when unavailable. */
  gearDetail: GearDetail | null;
  /** Real character avatar (Blizzard's Character Media API "avatar" asset -- a real pre-cropped face portrait, not a rendered shot). Null when unavailable (hidden profile, API hiccup, sample mode). */
  portraitUrl: string | null;
  /** Slope of parse percentile across the tier, in points. Can be negative. */
  parseTrend: number;
  /** Tier-to-date raw death count (kill pulls only — same scope as perf/gear). */
  deaths: number;
  /** Tier-to-date kill-pull count this raider was present for — the denominator for deaths. */
  pulls: number;
  /** Most recent death causes this tier, newest first, capped — not one per death. */
  deathCauses: DeathCause[];
  /** Percentile for the single-night window only. */
  nightParse: number;
  /** Raw death count for the most recent raid night only. */
  nightDeaths: number;
  /** Kill-pull count for the most recent raid night only. */
  nightPulls: number;
  /** Death causes from the most recent raid night only. */
  nightDeathCauses: DeathCause[];
}

export interface Gates {
  rio: number;
  ilvl: number;
  green: number;
  yellow: number;
}

export interface GateEvaluation {
  rioBest: number;
  ilvlBest: number;
  rioFail: boolean;
  ilvlFail: boolean;
  ineligible: boolean;
}

export interface ScoreParts {
  perfScore: number;
  gearScore: number;
  trendScore: number;
  score: number;
}

export type ScoreDimension = 'perf' | 'gear' | 'trend';

export interface FeedbackBreakdownItem {
  dimension: ScoreDimension;
  label: string;
  value: string;
  score: number;
  verdict: 'strong' | 'mid' | 'weak';
  text: string;
}

export interface Feedback {
  strongest: ScoreDimension;
  weakest: ScoreDimension;
  /** Full per-metric breakdown (perf/gear/trend), sorted strongest to weakest — backs the "See overall performance" view. */
  breakdown: FeedbackBreakdownItem[];
  status: string;
  working: string;
  attention: string;
  action: string;
}

export interface ScoredRaider extends Raider {
  window: Window;
  band: Band;
  bandLabel: string;
  severity: number;
  scored: boolean;
  score: number | null;
  scoreParts: ScoreParts;
  rioBest: number;
  ilvlBest: number;
  rioFail: boolean;
  ilvlFail: boolean;
  deathCapped: boolean;
  deathCapNote: string;
  /** Deaths/pulls for whichever window is active — night uses nightDeaths/nightPulls, rolled uses deaths/pulls. */
  deathsInWindow: number;
  pullsInWindow: number;
  /** Death causes for whichever window is active — night uses nightDeathCauses, rolled uses deathCauses. */
  deathCausesInWindow: DeathCause[];
  /** deathsInWindow / pullsInWindow, 0-1 (0 if pullsInWindow is 0). */
  deathRate: number;
  /** Std devs deathRate sits from the roster's own average this window -- what the death cap actually judges now (see DEATH_RATE_YELLOW_SIGMA/RED_SIGMA). 0 when there's no peer comparison (see scoreRaider's deathStats default). Positive = dying more than the guild average. */
  deathRateZ: number;
  /** Roster average deathRate this window (0-1), for display alongside deathRate -- "are you dying more or less than everyone else." */
  deathRateAvg: number;
  /** Average perfRaw among scored raiders in the same role, for display alongside perfRaw -- "average HPS/DTPS/DPS this tier." Null when no role peer has a perfRaw value. */
  perfRawAvg: number | null;
  icon: string;
  subline: string;
  feedback: Feedback;
}

export interface RoleSection {
  key: Role;
  label: string;
  icon: string;
  perfHeader: string;
}

export interface RosterSummary {
  counts: Record<Band, number>;
  average: number;
  headline: string;
  goingWell: string;
  stoppingUs: string;
  unscored: string;
}
