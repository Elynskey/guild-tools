/**
 * Raider Status — scoring + feedback engine.
 *
 * Ported near-verbatim from the design bundle's scoring.js: the three scoring
 * layers are the product, and the band a raider lands in must be reproducible
 * and auditable. Pure — no DOM, no framework, no I/O.
 */

import { specIcon } from './specIcons';
import { getRotationTip } from './rotationReference';
import type { Band, DeathCause, Feedback, GateEvaluation, Gates, Raider, RoleSection, RosterSummary, ScoreDimension, ScoreParts, ScoredRaider, Window } from './types';

export const DEFAULT_GATES: Gates = {
  rio: 1000, // Raider.IO score gate
  ilvl: 690, // item level gate (guild threshold)
  green: 75, // weighted score at or above this is Green
  yellow: 55, // ...at or above this is Yellow, below is Red
};

export const SEVERITY: Record<Band, number> = { red: 0, yellow: 1, ineligible: 2, green: 3 };

export const BAND_LABEL: Record<Band, string> = { green: 'Green', yellow: 'Yellow', red: 'Red', ineligible: 'Ineligible' };

// Layer 2 weights: performance 50% · gear completeness 30% · trend 20%.
const WEIGHT_PERF = 0.5;
const WEIGHT_GEAR = 0.3;
const WEIGHT_TREND = 0.2;

// DPS perf is %-of-the-guild's-minimum-DPS (a real, officer-set bar that rises as the
// tier progresses — see MIN_DPS_REQUIREMENT in the Electron data pipeline), rescaled
// from [PERF_RESCALE_FLOOR, +PERF_RESCALE_SPAN] into [0,100]. Healers and tanks are
// NOT judged against a global parse ranking — their perf is percentile *within their
// own role*, which already accounts for how much healing/damage-taken varies by pull.
const PERF_RESCALE_FLOOR = 80;
const PERF_RESCALE_SPAN = 35;

// Rolled-up trend score: flat trend (0) scores TREND_BASE; each point of trend is worth TREND_SLOPE_MULT.
const TREND_BASE = 50;
const TREND_SLOPE_MULT = 6;

// Feedback: how many gem/enchant slots are "missing" per point of gear shortfall.
const GEAR_SLOT_DIVISOR = 8;

// Deterministic per-name hash modulus (picks feedback phrasing variants).
const NAME_HASH_MODULUS = 9973;

// rosterSummary prose thresholds (display-only; distinct from the gear score bar's 95/80 thresholds in the UI).
const GEAR_SHORT_THRESHOLD = 90;
const TREND_RISING_THRESHOLD = 3;
const TREND_SLIPPING_THRESHOLD = -2;

// "See overall performance" breakdown verdict thresholds (display-only; deliberately mirrors the
// default green/yellow band cutoffs but kept separate since it labels a metric, not the whole raider).
const BREAKDOWN_STRONG_THRESHOLD = 75;
const BREAKDOWN_WEAK_THRESHOLD = 55;

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const up = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Stable per-name hash. Used only to vary phrasing deterministically. */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % NAME_HASH_MODULUS;
  return h;
};

/* ------------------------------------------------------------------ *
 * Layer 1 — Gates. Pass/fail, no partial credit.
 * Both read max(current, highest this season), which protects raiders
 * who swapped spec or gear sets mid-season.
 * ------------------------------------------------------------------ */
export function evaluateGates(r: Raider, gates: Gates = DEFAULT_GATES): GateEvaluation {
  const rioBest = Math.max(r.rioCurrent, r.rioHighestThisSeason ?? r.rioCurrent);
  const ilvlBest = Math.max(r.ilvlEquipped, r.ilvlHighestThisSeason ?? r.ilvlEquipped);
  const rioFail = rioBest < gates.rio;
  const ilvlFail = ilvlBest < gates.ilvl;
  return { rioBest, ilvlBest, rioFail, ilvlFail, ineligible: rioFail || ilvlFail };
}

/* ------------------------------------------------------------------ *
 * Layer 2 — Weighted score (0-100).
 *
 * Performance is deliberately NOT Warcraft Logs' default DPS stat:
 * damage is divided by time alive, not fight duration, so a death does
 * not double-penalise. Three different perf philosophies by role, per
 * guild policy ("we don't judge parses"):
 *   - dps:    %-of-the-guild's-minimum-DPS. A real, hard bar, not a
 *             ranking against other players' logs.
 *   - healer: HPS percentile among healers, pooled across the whole
 *             season so far (not just the latest pull) — healing load
 *             swings too much with comp/mechanics for a flat minimum,
 *             and a season's worth of data keeps the number stable even
 *             with only a handful of healers to compare against.
 *   - tank:   survivability/damage-taken percentile among tanks, same
 *             season-pooled reasoning — tanks also run much lower DPS
 *             than a DPS spec, so they were never judged on damage at
 *             all. Both percentiles are based on how far each raider's
 *             season average sits above/below the role's own average
 *             (standard deviations, not rank order) — see warcraftlogs.
 *             cjs's computeLocalPercentiles for why: rank order alone
 *             always puts someone at 0 and someone at 100 with a role
 *             as small as two tanks, no matter how close they actually
 *             are.
 * Trend still tracks each report individually (it needs multiple points
 * over time to show a slope, so it can't be season-pooled the same way):
 * dps trend tracks the slope of %-of-minimum across the tier; healer/
 * tank trend tracks the slope of their own per-report percentile —
 * still a within-role comparison, not a parse judgment.
 * ------------------------------------------------------------------ */
export function weightedScore(r: Raider, window: Window = 'rolled'): ScoreParts {
  const night = window === 'night';
  const perfScore = r.role === 'dps' ? clamp(Math.round(((r.perf - PERF_RESCALE_FLOOR) / PERF_RESCALE_SPAN) * 100)) : clamp(r.perf);
  const trendScore = night ? clamp(r.nightParse) : clamp(TREND_BASE + r.parseTrend * TREND_SLOPE_MULT);
  const gearScore = clamp(r.gearCompletion);
  return {
    perfScore,
    gearScore,
    trendScore,
    score: Math.round(perfScore * WEIGHT_PERF + gearScore * WEIGHT_GEAR + trendScore * WEIGHT_TREND),
  };
}

/* ------------------------------------------------------------------ *
 * Layer 3 — Death cap. Overrides the band regardless of score, so a
 * raider cannot post a strong score while dying repeatedly and still
 * show Green. Deaths stay a visible signal instead of being averaged
 * away inside the weighted score.
 *
 * Judged as a RATE (deaths / pulls), not a raw count — a raw count
 * conflates "died 3 times in 60 pulls" with "died 3 times in 10 pulls",
 * which aren't the same raider. Relative to the guild's OWN death rate
 * this window, not a fixed percentage: a flat "30% of pulls" cutoff
 * meant the same number capped a raid where everyone dies constantly
 * (mechanic-heavy tier) the same as one where nobody does. Judged in
 * standard deviations from the roster's own mean instead, so the
 * question is always "are you dying more than your guildmates," not
 * "are you above some number picked months ago."
 * ------------------------------------------------------------------ */
export const DEATH_RATE_YELLOW_SIGMA = 1; // more than 1 std dev above the guild's average death rate -> caps Green to Yellow only
export const DEATH_RATE_RED_SIGMA = 2; // more than 2 std devs above average -> Red, regardless of score

export interface DeathRateStats {
  mean: number;
  stdDev: number;
}

const EMPTY_STATS: DeathRateStats = { mean: 0, stdDev: 0 };

/** Population mean/std-dev of a set of 0-1 rates. */
export function computeStats(values: number[]): DeathRateStats {
  if (values.length === 0) return EMPTY_STATS;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

const windowPulls = (r: Raider, window: Window): number => (window === 'night' ? r.nightPulls : r.pulls);
const windowDeaths = (r: Raider, window: Window): number => (window === 'night' ? r.nightDeaths : r.deaths);

/** Roster-wide death-rate mean/std-dev for one window — computed once per roster
 * fetch (see scoreRoster), not per raider, so every raider is compared against the
 * same distribution. Raiders with no pulls this window are excluded (no rate to
 * pool, same reasoning as warcraftlogs.cjs's percentile computations). */
export function computeDeathRateStats(roster: Raider[], window: Window): DeathRateStats {
  return computeStats(roster.filter((r) => windowPulls(r, window) > 0).map((r) => windowDeaths(r, window) / windowPulls(r, window)));
}

const deathRateZ = (deathRate: number, stats: DeathRateStats): number => (stats.stdDev > 0 ? (deathRate - stats.mean) / stats.stdDev : 0);

export function applyDeathCap(band: Band, deathRateZScore: number): Band {
  if (deathRateZScore > DEATH_RATE_RED_SIGMA) return 'red';
  if (deathRateZScore > DEATH_RATE_YELLOW_SIGMA && band === 'green') return 'yellow';
  return band;
}

interface FeedbackDerived {
  band: Band;
  deathsInWindow: number;
  pullsInWindow: number;
  deathRate: number;
  deathRateZ: number;
  deathRateAvg: number;
  deathCausesInWindow: DeathCause[];
  perf: number;
  perfRawAvg: number | null;
  gates: GateEvaluation;
  scores: ScoreParts;
}

const fmtNum = (n: number): string => Math.round(n).toLocaleString('en-US');

/* ------------------------------------------------------------------ *
 * Feedback.
 *
 * The RULES decide what gets said: which band, which dimension is
 * strongest, which is weakest, and the single next action. Only the
 * phrasing is variable, picked deterministically from small pools so
 * thirty rows do not read from one template.
 *
 * If you swap the phrasing for a real LLM call, keep this contract:
 * pass it { band, score, deaths, strongest, weakest, gate numbers }
 * and let it write prose only. It must not decide the band, and it
 * must not turn one next action into a list.
 *
 * Voice: short, blunt, numbers first — officer notes, not paragraphs.
 * '--' is the guild's dash. No emoji. Ineligible is framed as "no
 * score", never as a bad score.
 * ------------------------------------------------------------------ */
export function generateFeedback(r: Raider, window: Window, gates: Gates, derived: FeedbackDerived): Feedback {
  const { rioBest, ilvlBest, rioFail, ilvlFail, ineligible } = derived.gates;
  const { perfScore, gearScore, trendScore, score } = derived.scores;
  const { band, deathsInWindow, pullsInWindow, deathRate, deathRateZ, deathRateAvg, deathCausesInWindow, perf, perfRawAvg } = derived;
  const deathPct = Math.round(deathRate * 100);
  const deathAvgPct = Math.round(deathRateAvg * 100);
  const deathText = `${deathsInWindow} death${deathsInWindow === 1 ? '' : 's'} on ${pullsInWindow} pull${pullsInWindow === 1 ? '' : 's'} (${deathPct}%, guild average ${deathAvgPct}%)`;
  // The specific mechanic that most recently killed them, when Warcraft Logs has it --
  // "review that mechanic" beats a generic "watch a log with an officer" suggestion.
  const topCause = deathCausesInWindow[0];
  const causeText = topCause ? `${topCause.ability} on ${topCause.boss}` : null;
  const night = window === 'night';
  const h = hash(r.name);
  const pick = <T,>(arr: T[]): T => arr[h % arr.length];

  const missing = r.gearCompletion >= 100 ? 0 : Math.max(1, Math.round((100 - r.gearCompletion) / GEAR_SLOT_DIVISOR));
  // Raw metric behind perf, parenthesized onto the description so an officer sees
  // WHY the percentile/%-of-minimum is what it is, not just the abstracted number
  // -- e.g. "HPS percentile at 72nd (41,300 HPS, guild average 36,800)". Omitted
  // entirely when perfRaw is unavailable (sample mode default, or too little
  // logged history yet) rather than showing a hole in the sentence.
  const perfUnit = r.role === 'dps' ? 'DPS' : r.role === 'healer' ? 'HPS' : 'damage taken/s';
  const perfRawText =
    r.perfRaw == null ? '' : ` (${fmtNum(r.perfRaw)} ${perfUnit}${perfRawAvg != null ? `, guild average ${fmtNum(perfRawAvg)}` : ''})`;
  const perfText =
    r.role === 'dps'
      ? `damage at ${perf}% of the guild's DPS minimum${perfRawText}`
      : r.role === 'healer'
        ? `HPS percentile at ${ordinal(perf)}${perfRawText}`
        : `survivability percentile at ${ordinal(perf)}${perfRawText}`;
  const gearText =
    missing === 0 ? "every gem and enchant in place against this month’s reference table" : `${missing} slot${missing > 1 ? 's' : ''} still missing a gem or enchant`;
  const trendText =
    r.role === 'dps'
      ? night
        ? `tonight's damage at ${r.nightParse}% of the DPS minimum`
        : r.parseTrend >= 2
          ? `trending up ${r.parseTrend} points toward the minimum across the tier`
          : r.parseTrend <= -2
            ? `trending down ${Math.abs(r.parseTrend)} points across the tier`
            : 'flat against the minimum across the tier'
      : night
        ? `tonight's percentile at ${ordinal(r.nightParse)}`
        : r.parseTrend >= 2
          ? `percentile climbing ${r.parseTrend} points across the tier`
          : r.parseTrend <= -2
            ? `percentile down ${Math.abs(r.parseTrend)} points across the tier`
            : 'percentile flat across the tier';

  const parts: { k: ScoreDimension; s: number; t: string }[] = [
    { k: 'perf', s: perfScore, t: perfText },
    { k: 'gear', s: gearScore, t: gearText },
    { k: 'trend', s: trendScore, t: trendText },
  ];
  parts.sort((a, b) => b.s - a.s);
  const [strong, second, weak] = parts;

  // Full per-metric breakdown for the "See overall performance" detail view — every
  // dimension, not just strongest/weakest, so an officer can see the whole picture.
  const dimensionLabel: Record<ScoreDimension, string> = {
    perf: r.role === 'dps' ? 'Damage' : r.role === 'healer' ? 'Healing' : 'Survivability',
    gear: 'Gear',
    trend: night ? 'Last night' : 'Trend',
  };
  const dimensionValue: Record<ScoreDimension, string> = {
    perf: `${r.role === 'dps' ? `${perf}% of minimum` : `${ordinal(perf)} percentile`}${r.perfRaw != null ? ` · ${fmtNum(r.perfRaw)}` : ''}`,
    gear: `${r.gearCompletion}%`,
    trend:
      r.role === 'dps'
        ? night
          ? `${r.nightParse}% of minimum`
          : r.parseTrend > 0
            ? `+${r.parseTrend}`
            : `${r.parseTrend}`
        : night
          ? `${ordinal(r.nightParse)} percentile`
          : r.parseTrend > 0
            ? `+${r.parseTrend}`
            : `${r.parseTrend}`,
  };
  const breakdown: Feedback['breakdown'] = parts.map(({ k, s, t }) => ({
    dimension: k,
    label: dimensionLabel[k],
    value: dimensionValue[k],
    score: s,
    verdict: s >= BREAKDOWN_STRONG_THRESHOLD ? 'strong' : s < BREAKDOWN_WEAK_THRESHOLD ? 'weak' : 'mid',
    text: up(t),
  }));

  if (ineligible) {
    return {
      strongest: strong.k,
      weakest: weak.k,
      breakdown,
      status:
        rioFail && ilvlFail
          ? `Not scored. Raider.IO ${rioBest} and item level ${ilvlBest} -- both gates short.`
          : rioFail
            ? `Not scored. Raider.IO ${rioBest}, gate is ${gates.rio}.`
            : `Not scored. Item level ${ilvlBest}, gate is ${gates.ilvl}.`,
      working:
        rioFail && ilvlFail
          ? `${up(perfText)} on the nights ${r.name} raids, and ${gearText}.`
          : rioFail
            ? `Item level clears at ${ilvlBest}. ${up(perfText)}.`
            : `Raider.IO clears at ${rioBest}. ${up(perfText)}.`,
      attention:
        ilvlFail && !rioFail
          ? `Read as max(equipped, highest this season), so a spec swap isn't counted against you. Still ${gates.ilvl - ilvlBest} short.`
          : rioFail && !ilvlFail
            ? `${gates.rio - rioBest} points of Raider.IO, nothing else.`
            : `Keys move both numbers, so this is one errand rather than two.`,
      action: rioFail
        ? pick([`Sunday Funday Keys with Officer Perseffonee. Nobody runs them alone.`, `Three or four keys this week and the gate is gone. Ask Zalanto for a group.`])
        : pick([`Droptimizer first, then the crafted slots. Mats are in the bank.`, `Ask in Discord -- someone will craft the missing slots. Pay it forward.`]),
    };
  }

  const bandWord = BAND_LABEL[band];
  const gapText = {
    perf:
      r.role === 'dps'
        ? pick([`${up(perfText)} -- divided by time alive, so this is uptime rather than gear.`, `Damage sits at ${perf}% of the minimum the guild sets.`])
        : r.role === 'healer'
          ? pick([`${up(perfText)}. Percentile, not raw HPS, so a clean night isn't hiding anything.`, `Healing sits at the ${ordinal(perf)} percentile across the window.`])
          : pick([`${up(perfText)}. Damage taken varies by pull, so this is relative to other tanks that night.`, `Survivability sits at the ${ordinal(perf)} percentile across the window.`]),
    gear: pick([`${up(gearText)}.`, `Gear sheet reads ${r.gearCompletion}% -- ${missing} slot${missing > 1 ? 's' : ''} short.`]),
    trend: pick([`${up(trendText)}. The number today is fine; the line isn't.`, `${up(trendText)}.`]),
  }[weak.k];

  return {
    strongest: strong.k,
    weakest: weak.k,
    breakdown,
    status:
      deathRateZ > DEATH_RATE_RED_SIGMA
        ? `${bandWord}. ${deathText}${causeText ? ` -- most recently ${causeText}` : ''} set the band; the score was ${score}/100.`
        : deathRateZ > DEATH_RATE_YELLOW_SIGMA
          ? `${bandWord}. ${deathText}${causeText ? ` -- most recently ${causeText}` : ''} holds it here -- the score was ${score}/100.`
          : `${bandWord}. ${score}/100, both gates clear.`,
    working: second.s >= 78 ? `${up(strong.t)}. ${up(second.t)}.` : `${up(strong.t)}.`,
    attention:
      deathRateZ > DEATH_RATE_RED_SIGMA
        ? `${deathText}${causeText ? ` -- most recently ${causeText}` : ''}. Under that, ${gapText.charAt(0).toLowerCase() + gapText.slice(1)}`
        : gapText,
    action:
      deathRateZ > DEATH_RATE_RED_SIGMA
        ? causeText
          ? pick([`${causeText} -- review that mechanic with an officer before Saturday.`, `Walk ${topCause!.boss} back and isolate ${topCause!.ability}. One rep, this week.`])
          : pick([`Survivability only this week. The damage is already there.`, `One mechanic, one pull, with an officer before Saturday. Nothing else.`])
        : {
            perf: getRotationTip(r.class, r.spec) ?? pick([`One boss, one log read with an officer. Not the whole night.`, `Pick the fight where it falls off and watch it back with Shortie.`]),
            gear: pick([`Gems and enchants before Saturday's Heroic. Twenty minutes.`, `Fill the empty slots this week -- cheapest point on the board.`]),
            trend: pick([`Flat two weeks running -- pull last week's log and find where it plateaus.`, `Trend's flat. Isolate the pull where it drops off before next week.`]),
          }[weak.k],
  };
}

/**
 * Full evaluation for one raider in one window.
 *
 * `deathStats` is the roster's own death-rate mean/std-dev for this window (see
 * computeDeathRateStats) — the death cap is relative to it, not a fixed threshold.
 * `perfRawAvg` is the average perfRaw among this raider's role peers (see
 * scoreRoster), for the feedback text's "guild average" comparison. Both default
 * to no comparison data so a single raider can still be scored in isolation
 * (tests, a one-off check); real roster-wide scoring should go through scoreRoster
 * below, which computes both once and passes them to every raider.
 */
export function scoreRaider(
  raider: Raider,
  window: Window = 'rolled',
  gates: Gates = DEFAULT_GATES,
  deathStats: DeathRateStats = EMPTY_STATS,
  perfRawAvg: number | null = null,
): ScoredRaider {
  const g = evaluateGates(raider, gates);
  const perf = raider.perf;
  const night = window === 'night';
  const deathsInWindow = night ? raider.nightDeaths : raider.deaths;
  const pullsInWindow = night ? raider.nightPulls : raider.pulls;
  const deathRate = pullsInWindow > 0 ? deathsInWindow / pullsInWindow : 0;
  const deathRateZScore = deathRateZ(deathRate, deathStats);
  const deathCausesInWindow = night ? raider.nightDeathCauses : raider.deathCauses;
  const scores = weightedScore(raider, window);

  const scoreBand: Band = scores.score >= gates.green ? 'green' : scores.score >= gates.yellow ? 'yellow' : 'red';
  let band = applyDeathCap(scoreBand, deathRateZScore);
  const deathCapped = band !== scoreBand; // did the death rate actually hold the band down, not just "any deaths at all"
  if (g.ineligible) band = 'ineligible';

  const derived: FeedbackDerived = {
    band,
    deathsInWindow,
    pullsInWindow,
    deathRate,
    deathRateZ: deathRateZScore,
    deathRateAvg: deathStats.mean,
    deathCausesInWindow,
    perf,
    perfRawAvg,
    gates: g,
    scores,
  };
  const feedback = generateFeedback(raider, window, gates, derived);

  return {
    ...raider,
    window,
    band,
    bandLabel: BAND_LABEL[band],
    severity: SEVERITY[band],
    scored: !g.ineligible,
    score: g.ineligible ? null : scores.score,
    scoreParts: scores,
    rioBest: g.rioBest,
    ilvlBest: g.ilvlBest,
    rioFail: g.rioFail,
    ilvlFail: g.ilvlFail,
    deathCapped,
    deathCapNote: deathCapped ? (band === 'red' ? 'Band held at Red' : 'Band held at Yellow') : '',
    deathsInWindow,
    pullsInWindow,
    deathRate,
    deathRateZ: deathRateZScore,
    deathRateAvg: deathStats.mean,
    perfRawAvg,
    deathCausesInWindow,
    icon: specIcon(raider.spec, raider.class),
    subline: `${raider.spec} ${raider.class} · ${raider.role === 'dps' ? 'DPS' : up(raider.role)} · ilvl ${g.ilvlBest} · RIO ${g.rioBest}`,
    feedback,
  };
}

/** Scores a whole roster for one window, computing the death-rate comparison and
 * each role's average perfRaw once — the entry point real app code should use
 * (Raider Status). Calling scoreRaider directly per-raider without this would
 * compare each raider only against themselves, silently disabling the death cap
 * and losing the "guild average" context in their feedback text. */
export function scoreRoster(roster: Raider[], window: Window = 'rolled', gates: Gates = DEFAULT_GATES): ScoredRaider[] {
  const deathStats = computeDeathRateStats(roster, window);
  const perfRawAvgByRole = new Map<Raider['role'], number | null>();
  for (const role of ['tank', 'healer', 'dps'] as const) {
    const values = roster.filter((r) => r.role === role && r.perfRaw != null).map((r) => r.perfRaw as number);
    perfRawAvgByRole.set(role, values.length > 0 ? values.reduce((a, v) => a + v, 0) / values.length : null);
  }
  return roster.map((raider) => scoreRaider(raider, window, gates, deathStats, perfRawAvgByRole.get(raider.role) ?? null));
}

/** Sorting used by the "Needs support first" switch (ON by default). */
export const sortWorstFirst = (a: ScoredRaider, b: ScoredRaider) => a.severity - b.severity || (a.score ?? 0) - (b.score ?? 0);
export const sortBestFirst = (a: ScoredRaider, b: ScoredRaider) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name);

const list = (a: string[]): string => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : (a[0] ?? ''));

/** Roster-level roll-up: band counts plus the summary sentences. */
export function rosterSummary(rows: ScoredRaider[], window: Window = 'rolled'): RosterSummary {
  const counts: Record<Band, number> = { green: 0, yellow: 0, red: 0, ineligible: 0 };
  rows.forEach((r) => counts[r.band]++);

  const scored = rows.filter((r) => r.scored);
  const avg = Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / Math.max(1, scored.length));
  const deathTotal = rows.reduce((a, r) => a + r.deathsInWindow, 0);
  const cappedCount = rows.filter((r) => r.scored && r.deathCapped).length;
  const gearShort = rows.filter((r) => r.gearCompletion < GEAR_SHORT_THRESHOLD);
  const gearAvg = Math.round(rows.reduce((a, r) => a + r.gearCompletion, 0) / rows.length);
  const rising = rows.filter((r) => r.parseTrend >= TREND_RISING_THRESHOLD).length;
  const slipping = rows.filter((r) => r.parseTrend <= TREND_SLIPPING_THRESHOLD);
  const top = scored.slice().sort(sortBestFirst).slice(0, 3).map((r) => r.name);

  // "Red on damage alone" = Red not caused by the death cap (i.e. the weighted score itself was below threshold).
  // Fixed from the prototype, which hardcoded this claim as always-true text regardless of roster data.
  const redOnDamageAlone = rows.filter((r) => r.band === 'red' && r.deathsInWindow === 0).map((r) => r.name);
  const damageClause =
    redOnDamageAlone.length === 0
      ? 'nobody is Red on damage alone'
      : `${list(redOnDamageAlone)} ${redOnDamageAlone.length > 1 ? 'are' : 'is'} Red on damage alone`;

  const inel = rows.filter((r) => !r.scored);
  const both = inel.filter((r) => r.rioFail && r.ilvlFail).map((r) => r.name);
  const rio = inel.filter((r) => r.rioFail && !r.ilvlFail).map((r) => r.name);
  const ilvl = inel.filter((r) => !r.rioFail && r.ilvlFail).map((r) => r.name);

  const gateBits = [both.length ? `${list(both)} short on both gates` : '', rio.length ? `${list(rio)} on Raider.IO` : '', ilvl.length ? `${list(ilvl)} on item level` : ''].filter(
    Boolean,
  );

  return {
    counts,
    average: avg,
    headline: `${window === 'night' ? 'Friday night' : 'Tier-to-date'} · ${rows.length} raiders · average ${avg}/100`,
    goingWell: `${list(top)} are clearing thresholds with full gear sheets, ${rising} raiders are trending up this tier, and ${damageClause}.`,
    stoppingUs: `${deathTotal} deaths are holding ${cappedCount} raiders a band below what they scored, ${gearShort.length} are under ${GEAR_SHORT_THRESHOLD}% on gems and enchants (roster average ${gearAvg}%), and ${slipping.length} are trending down -- ${list(slipping.slice(0, 3).map((r) => r.name))} steepest.`,
    unscored: `${counts.ineligible} not scored: ${gateBits.join(', ')}. Keys and crafted slots, not coaching.`,
  };
}

/** Role sections, in display order. Empty sections are omitted by the UI. */
export const ROLE_SECTIONS: RoleSection[] = [
  { key: 'tank', label: 'Tanks', icon: 'shield', perfHeader: 'Survivability percentile' },
  { key: 'healer', label: 'Healers', icon: 'heart-handshake', perfHeader: 'HPS percentile' },
  { key: 'dps', label: 'Damage', icon: 'swords', perfHeader: 'DPS vs minimum' },
];
