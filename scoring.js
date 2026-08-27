/**
 * Raider Status — scoring + feedback engine.
 *
 * Framework-agnostic ES module extracted from the HTML prototype. This is the part
 * worth porting verbatim: the three scoring layers are the product, and the band a
 * raider lands in must be reproducible and auditable.
 *
 * Everything here is pure. No DOM, no framework, no I/O.
 *
 *   import { scoreRaider, rosterSummary, DEFAULT_GATES, SAMPLE_ROSTER } from './scoring.js';
 *   const rows = SAMPLE_ROSTER.map(r => scoreRaider(r, 'rolled', DEFAULT_GATES));
 */

export const DEFAULT_GATES = {
  rio: 1000,   // Raider.IO score gate
  ilvl: 690,   // item level gate (guild threshold)
  green: 75,   // weighted score at or above this is Green
  yellow: 55   // ...at or above this is Yellow, below is Red
};

export const SEVERITY = { red: 0, yellow: 1, ineligible: 2, green: 3 };

export const BAND_LABEL = { green: 'Green', yellow: 'Yellow', red: 'Red', ineligible: 'Ineligible' };

/** '<Spec> <Class>' -> WoW icon filename (see assets/icons/). */
export const SPEC_ICON = {
  'Protection Warrior': 'ability_warrior_defensivestance',
  'Fury Warrior': 'ability_warrior_innerrage',
  'Arms Warrior': 'ability_warrior_savageblow',
  'Blood Death Knight': 'spell_deathknight_bloodpresence',
  'Unholy Death Knight': 'spell_deathknight_unholypresence',
  'Protection Paladin': 'ability_paladin_shieldofthetemplar',
  'Holy Paladin': 'spell_holy_holybolt',
  'Retribution Paladin': 'spell_holy_auraoflight',
  'Guardian Druid': 'ability_racial_bearform',
  'Restoration Druid': 'spell_nature_healingtouch',
  'Balance Druid': 'spell_nature_starfall',
  'Feral Druid': 'ability_druid_catform',
  'Holy Priest': 'spell_holy_guardianspirit',
  'Discipline Priest': 'spell_holy_powerwordshield',
  'Shadow Priest': 'spell_shadow_shadowwordpain',
  'Restoration Shaman': 'spell_nature_magicimmunity',
  'Elemental Shaman': 'spell_nature_lightning',
  'Enhancement Shaman': 'spell_shaman_improvedstormstrike',
  'Mistweaver Monk': 'spell_monk_mistweaver_spec',
  'Windwalker Monk': 'spell_monk_windwalker_spec',
  'Frost Mage': 'spell_frost_frostbolt02',
  'Fire Mage': 'spell_fire_firebolt02',
  'Beast Mastery Hunter': 'ability_hunter_bestialdiscipline',
  'Marksmanship Hunter': 'ability_hunter_focusedaim',
  'Subtlety Rogue': 'ability_stealth',
  'Assassination Rogue': 'ability_rogue_eviscerate',
  'Destruction Warlock': 'spell_shadow_rainoffire',
  'Affliction Warlock': 'spell_shadow_deathcoil',
  'Devastation Evoker': 'classicon_evoker',
  'Havoc Demon Hunter': 'ability_demonhunter_specdps'
};

export const specIcon = (spec, cls) =>
  `assets/icons/${SPEC_ICON[`${spec} ${cls}`] || 'inv_misc_questionmark'}.jpg`;

const clamp = (v) => Math.max(0, Math.min(100, v));
const up = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = (n) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Stable per-name hash. Used only to vary phrasing deterministically. */
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h;
};

/* ------------------------------------------------------------------ *
 * Layer 1 — Gates. Pass/fail, no partial credit.
 * Both read max(current, highest this season), which protects raiders
 * who swapped spec or gear sets mid-season.
 * ------------------------------------------------------------------ */
export function evaluateGates(r, gates = DEFAULT_GATES) {
  const rioBest = Math.max(r.rioCurrent, r.rioHighestThisSeason ?? r.rioCurrent);
  const ilvlBest = Math.max(r.ilvlEquipped, r.ilvlHighestThisSeason ?? r.ilvlEquipped);
  const rioFail = rioBest < gates.rio;
  const ilvlFail = ilvlBest < gates.ilvl;
  return { rioBest, ilvlBest, rioFail, ilvlFail, ineligible: rioFail || ilvlFail };
}

/* ------------------------------------------------------------------ *
 * Layer 2 — Weighted score (0-100).
 *   performance 50% · gear completeness 30% · trend 20%
 *
 * Performance is deliberately NOT Warcraft Logs' default DPS stat:
 * damage is divided by time alive, not fight duration, so a death does
 * not double-penalise. Healers are scored on HPS percentile instead of
 * raw HPS, so a clean pull that needed less healing is not punished.
 * ------------------------------------------------------------------ */
export function weightedScore(r, window = 'rolled') {
  const healer = r.role === 'healer';
  const night = window === 'night';
  const perfScore = healer ? clamp(r.perf) : clamp(Math.round((r.perf - 80) / 35 * 100));
  const trendScore = night ? clamp(r.nightParse) : clamp(50 + r.parseTrend * 6);
  const gearScore = clamp(r.gearCompletion);
  return {
    perfScore,
    gearScore,
    trendScore,
    score: Math.round(perfScore * 0.5 + gearScore * 0.3 + trendScore * 0.2)
  };
}

/* ------------------------------------------------------------------ *
 * Layer 3 — Death cap. Overrides the band regardless of score, so a
 * raider cannot post a strong score while dying repeatedly and still
 * show Green. Deaths stay a visible signal instead of being averaged
 * away inside the weighted score.
 * ------------------------------------------------------------------ */
export function applyDeathCap(band, deaths) {
  if (deaths >= 2) return 'red';
  if (deaths === 1 && band === 'green') return 'yellow';
  return band;
}

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
export function generateFeedback(r, window, gates, derived) {
  const { rioBest, ilvlBest, rioFail, ilvlFail, ineligible } = derived.gates;
  const { perfScore, gearScore, trendScore, score } = derived.scores;
  const { band, deaths, perf } = derived;
  const healer = r.role === 'healer';
  const night = window === 'night';
  const h = hash(r.name);
  const pick = (arr) => arr[h % arr.length];

  const missing = r.gearCompletion >= 100 ? 0 : Math.max(1, Math.round((100 - r.gearCompletion) / 8));
  const perfText = healer
    ? `HPS percentile at ${ordinal(perf)}`
    : `damage while alive at ${perf}% of the boss threshold`;
  const gearText = missing === 0
    ? 'every gem and enchant in place against this month\u2019s reference table'
    : `${missing} slot${missing > 1 ? 's' : ''} still missing a gem or enchant`;
  const trendText = night
    ? `night parse at ${ordinal(r.nightParse)} percentile`
    : r.parseTrend >= 2 ? `parse trend climbing ${r.parseTrend} points across the tier`
    : r.parseTrend <= -2 ? `parse trend down ${Math.abs(r.parseTrend)} points across the tier`
    : 'parse trend flat across the tier';

  const parts = [
    { k: 'perf', s: perfScore, t: perfText },
    { k: 'gear', s: gearScore, t: gearText },
    { k: 'trend', s: trendScore, t: trendText }
  ].sort((a, b) => b.s - a.s);
  const [strong, second, weak] = parts;

  if (ineligible) {
    return {
      strongest: strong.k,
      weakest: weak.k,
      status: rioFail && ilvlFail
        ? `Not scored. Raider.IO ${rioBest} and item level ${ilvlBest} -- both gates short.`
        : rioFail
        ? `Not scored. Raider.IO ${rioBest}, gate is ${gates.rio}.`
        : `Not scored. Item level ${ilvlBest}, gate is ${gates.ilvl}.`,
      working: rioFail && ilvlFail
        ? `${up(perfText)} on the nights ${r.name} raids, and ${gearText}.`
        : rioFail
        ? `Item level clears at ${ilvlBest}. ${up(perfText)}.`
        : `Raider.IO clears at ${rioBest}. ${up(perfText)}.`,
      attention: ilvlFail && !rioFail
        ? `Read as max(equipped, highest this season), so a spec swap isn't counted against you. Still ${gates.ilvl - ilvlBest} short.`
        : rioFail && !ilvlFail
        ? `${gates.rio - rioBest} points of Raider.IO, nothing else.`
        : `Keys move both numbers, so this is one errand rather than two.`,
      action: rioFail
        ? pick([
            `Sunday Funday Keys with Officer Harima. Nobody runs them alone.`,
            `Three or four keys this week and the gate is gone. Ask Zalanto for a group.`
          ])
        : pick([
            `Droptimizer first, then the crafted slots. Mats are in the bank.`,
            `Ask in Discord -- someone will craft the missing slots. Pay it forward.`
          ])
    };
  }

  const bandWord = BAND_LABEL[band];
  const gapText = {
    perf: healer
      ? pick([
          `${up(perfText)}. Percentile, not raw HPS, so a clean night isn't hiding anything.`,
          `Healing sits at the ${ordinal(perf)} percentile across the window.`
        ])
      : pick([
          `${up(perfText)} -- divided by time alive, so this is uptime rather than gear.`,
          `Damage falls off late in fights: ${perf}% of the threshold while alive.`
        ]),
    gear: pick([
        `${up(gearText)}.`,
        `Gear sheet reads ${r.gearCompletion}% -- ${missing} slot${missing > 1 ? 's' : ''} short.`
      ]),
    trend: pick([
        `${up(trendText)}. The number today is fine; the line isn't.`,
        `${up(trendText)}.`
      ])
  }[weak.k];

  return {
    strongest: strong.k,
    weakest: weak.k,
    status: deaths >= 2
      ? `${bandWord}. ${deaths} deaths set the band; the score was ${score}/100.`
      : deaths === 1
      ? `${bandWord}. One death holds it here -- the score was ${score}/100.`
      : `${bandWord}. ${score}/100, both gates clear.`,
    working: second.s >= 78 ? `${up(strong.t)}. ${up(second.t)}.` : `${up(strong.t)}.`,
    attention: deaths >= 2
      ? `${deaths} deaths. Under that, ${gapText.charAt(0).toLowerCase() + gapText.slice(1)}`
      : gapText,
    action: deaths >= 2
      ? pick([
          `Survivability only this week. The damage is already there.`,
          `One mechanic, one pull, with an officer before Saturday. Nothing else.`
        ])
      : {
        perf: pick([
            `One boss, one log read with an officer. Not the whole night.`,
            `Pick the fight where it falls off and watch it back with Shortie.`
          ]),
        gear: pick([
            `Gems and enchants before Saturday's Heroic. Twenty minutes.`,
            `Fill the empty slots this week -- cheapest point on the board.`
          ]),
        trend: pick([
            `Same boss two weeks running, same officer watching.`,
            `Worth a quick word with Officer Vadailla on Friday.`
          ])
      }[weak.k]
  };
}

/**
 * Full evaluation for one raider in one window.
 * @param {object} raider  see SAMPLE_ROSTER for the shape
 * @param {'rolled'|'night'} window
 * @param {object} gates
 */
export function scoreRaider(raider, window = 'rolled', gates = DEFAULT_GATES) {
  const g = evaluateGates(raider, gates);
  const perf = raider.perf;
  const deaths = raider.deaths;
  const scores = weightedScore(raider, window);

  let band = scores.score >= gates.green ? 'green' : scores.score >= gates.yellow ? 'yellow' : 'red';
  band = applyDeathCap(band, deaths);
  if (g.ineligible) band = 'ineligible';

  const derived = { band, deaths, perf, gates: g, scores };
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
    deathCapped: deaths > 0,
    deathCapNote: deaths >= 2 ? 'Band held at Red' : deaths === 1 ? 'Band held at Yellow' : '',
    icon: specIcon(raider.spec, raider.class),
    subline: `${raider.spec} ${raider.class} \u00b7 ${raider.role === 'dps' ? 'DPS' : up(raider.role)} \u00b7 ilvl ${g.ilvlBest} \u00b7 RIO ${g.rioBest}`,
    feedback
  };
}

/** Sorting used by the "Needs support first" switch (ON by default). */
export const sortWorstFirst = (a, b) => a.severity - b.severity || (a.score ?? 0) - (b.score ?? 0);
export const sortBestFirst = (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name);

/** Roster-level roll-up: band counts plus the two summary sentences. */
export function rosterSummary(rows, window = 'rolled') {
  const counts = { green: 0, yellow: 0, red: 0, ineligible: 0 };
  rows.forEach((r) => counts[r.band]++);

  const scored = rows.filter((r) => r.scored);
  const avg = Math.round(scored.reduce((a, r) => a + r.score, 0) / Math.max(1, scored.length));
  const deathTotal = rows.reduce((a, r) => a + r.deaths, 0);
  const cappedCount = rows.filter((r) => r.scored && r.deaths > 0).length;
  const gearShort = rows.filter((r) => r.gearCompletion < 90);
  const gearAvg = Math.round(rows.reduce((a, r) => a + r.gearCompletion, 0) / rows.length);
  const rising = rows.filter((r) => r.parseTrend >= 3).length;
  const slipping = rows.filter((r) => r.parseTrend <= -2);
  const top = scored.slice().sort(sortBestFirst).slice(0, 3).map((r) => r.name);

  const inel = rows.filter((r) => !r.scored);
  const both = inel.filter((r) => r.rioFail && r.ilvlFail).map((r) => r.name);
  const rio = inel.filter((r) => r.rioFail && !r.ilvlFail).map((r) => r.name);
  const ilvl = inel.filter((r) => !r.rioFail && r.ilvlFail).map((r) => r.name);

  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] || '');
  const gateBits = [
    both.length ? `${list(both)} short on both gates` : '',
    rio.length ? `${list(rio)} on Raider.IO` : '',
    ilvl.length ? `${list(ilvl)} on item level` : ''
  ].filter(Boolean);

  return {
    counts,
    average: avg,
    headline: `${window === 'night' ? 'Friday night' : 'Tier-to-date'} \u00b7 ${rows.length} raiders \u00b7 average ${avg}/100`,
    goingWell: `${list(top)} are clearing thresholds with full gear sheets, ${rising} raiders are trending up this tier, and nobody is Red on damage alone.`,
    stoppingUs: `${deathTotal} deaths are holding ${cappedCount} raiders a band below what they scored, ${gearShort.length} are under 90% on gems and enchants (roster average ${gearAvg}%), and ${slipping.length} are trending down -- ${list(slipping.slice(0, 3).map((r) => r.name))} steepest.`,
    unscored: `${counts.ineligible} not scored: ${gateBits.join(', ')}. Keys and crafted slots, not coaching.`
  };
}

/** Role sections, in display order. Empty sections are omitted by the UI. */
export const ROLE_SECTIONS = [
  { key: 'tank', label: 'Tanks', icon: 'shield', perfHeader: 'DPS while alive' },
  { key: 'healer', label: 'Healers', icon: 'heart-handshake', perfHeader: 'HPS percentile' },
  { key: 'dps', label: 'Damage', icon: 'swords', perfHeader: 'DPS while alive' }
];

/* ------------------------------------------------------------------ *
 * Sample roster — fabricated data for the prototype. Real officer
 * names from the guild, invented numbers. Replace with the pipeline.
 *
 *   perf            damage while alive as % of the per-boss threshold
 *                   (healers: HPS percentile 0-100)
 *   gearCompletion  % of gem/enchant slots correct vs the reference table
 *   parseTrend      slope of parse percentile across the tier, in points
 *   nightParse      percentile for a single night (night window only)
 * ------------------------------------------------------------------ */
const raider = (name, role, cls, spec, rioCurrent, rioHighestThisSeason, ilvlEquipped, ilvlHighestThisSeason, perf, gearCompletion, parseTrend, deaths, nightParse) =>
  ({ name, role, class: cls, spec, rioCurrent, rioHighestThisSeason, ilvlEquipped, ilvlHighestThisSeason, perf, gearCompletion, parseTrend, deaths, nightParse });

export const SAMPLE_ROSTER = [
  raider('Vadailla', 'tank', 'Warrior', 'Protection', 2480, 2480, 709, 709, 108, 100, 3, 0, 81),
  raider('Ogrimund', 'tank', 'Death Knight', 'Blood', 1620, 1690, 698, 701, 99, 92, 1, 1, 54),
  raider('Thornwick', 'tank', 'Paladin', 'Protection', 1180, 1210, 691, 693, 94, 78, -2, 2, 38),
  raider('Skarnak', 'tank', 'Druid', 'Guardian', 940, 985, 688, 689, 96, 85, 0, 0, 44),
  raider('Perseffonee', 'healer', 'Priest', 'Holy', 2610, 2610, 711, 711, 91, 100, 5, 0, 89),
  raider('Quixxie', 'healer', 'Shaman', 'Restoration', 2050, 2110, 704, 706, 84, 96, 2, 0, 80),
  raider('Ellowyn', 'healer', 'Druid', 'Restoration', 1490, 1530, 697, 699, 61, 74, -3, 1, 58),
  raider('Mirthwin', 'healer', 'Monk', 'Mistweaver', 1320, 1360, 694, 696, 55, 88, 1, 0, 51),
  raider('Halvora', 'healer', 'Paladin', 'Holy', 1010, 1080, 692, 694, 42, 62, -6, 2, 35),
  raider('Duskwren', 'healer', 'Priest', 'Discipline', 1780, 1810, 701, 703, 77, 90, 4, 0, 74),
  raider('Harima', 'dps', 'Mage', 'Frost', 2740, 2740, 712, 712, 114, 100, 6, 0, 93),
  raider('Hotchick', 'dps', 'Hunter', 'Beast Mastery', 2180, 2200, 707, 708, 106, 100, 3, 0, 77),
  raider('Shortie', 'dps', 'Rogue', 'Subtlety', 1960, 1990, 703, 705, 101, 94, 2, 0, 62),
  raider('Zalanto', 'dps', 'Warlock', 'Destruction', 2260, 2260, 708, 710, 109, 98, 4, 0, 84),
  raider('Addy', 'dps', 'Druid', 'Balance', 1540, 1600, 699, 701, 97, 86, 5, 0, 55),
  raider('Brumblade', 'dps', 'Warrior', 'Fury', 1150, 1180, 693, 695, 92, 70, -1, 1, 41),
  raider('Grimsyl', 'dps', 'Death Knight', 'Unholy', 1420, 1470, 696, 698, 88, 82, -4, 0, 33),
  raider('Mossbeard', 'dps', 'Shaman', 'Elemental', 1030, 1090, 690, 692, 84, 66, -5, 2, 26),
  raider('Kaldresh', 'dps', 'Paladin', 'Retribution', 1680, 1700, 700, 702, 103, 92, 1, 0, 66),
  raider('Sunnivah', 'dps', 'Priest', 'Shadow', 880, 930, 686, 687, 90, 80, 2, 0, 48),
  raider('Bristlebane', 'dps', 'Monk', 'Windwalker', 1260, 1300, 695, 697, 95, 88, 0, 1, 50),
  raider('Verrock', 'dps', 'Hunter', 'Marksmanship', 2040, 2060, 705, 707, 104, 96, 3, 0, 72),
  raider('Nyxaria', 'dps', 'Evoker', 'Devastation', 1590, 1640, 698, 700, 99, 90, 7, 0, 68),
  raider('Dromm', 'dps', 'Warrior', 'Arms', 1120, 1160, 687, 689, 86, 74, -2, 0, 30),
  raider('Fizzlewick', 'dps', 'Mage', 'Fire', 1870, 1900, 702, 704, 100, 84, -1, 0, 57),
  raider('Ashkara', 'dps', 'Rogue', 'Assassination', 1350, 1390, 694, 696, 93, 90, 2, 1, 46),
  raider('Torvyn', 'dps', 'Demon Hunter', 'Havoc', 2120, 2140, 706, 708, 111, 100, 5, 0, 87),
  raider('Selvara', 'dps', 'Warlock', 'Affliction', 1080, 1120, 691, 693, 81, 58, -7, 2, 22),
  raider('Pyreleaf', 'dps', 'Druid', 'Feral', 1470, 1500, 697, 699, 96, 78, 1, 0, 53),
  raider('Brakkus', 'dps', 'Shaman', 'Enhancement', 1240, 1280, 693, 695, 89, 86, 3, 0, 49)
];
