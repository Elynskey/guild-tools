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

export interface Raider {
  name: string;
  role: Role;
  class: string;
  spec: string;
  rioCurrent: number;
  rioHighestThisSeason: number;
  ilvlEquipped: number;
  ilvlHighestThisSeason: number;
  /** DPS/tank: % of per-boss threshold while alive. Healers: HPS percentile 0-100. */
  perf: number;
  /** % of gem/enchant slots correct vs the monthly reference table. */
  gearCompletion: number;
  /** What's behind gearCompletion -- which slots lack an enchant, how many sockets are empty. Null when unavailable. */
  gearDetail: GearDetail | null;
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
  /** deathsInWindow / pullsInWindow, 0-1 (0 if pullsInWindow is 0). What the death cap actually judges. */
  deathRate: number;
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
