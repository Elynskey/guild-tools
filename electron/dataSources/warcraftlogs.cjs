// Warcraft Logs API v2 (GraphQL), OAuth client-credentials.
//
// Verified live against real reports for "Casual Raid Days" / The Scryers:
//   - table(dataType: DamageDone) entries: { name, total, activeTime, ... } — total
//     is damage, activeTime is ms of uptime (NOT full fight duration), confirmed real.
//   - table(dataType: Deaths) entries: one row per death event, { name, fight,
//     damage: { abilities: [{ name, total }, ...] }, ... } — abilities sorted
//     descending by total, scoped tightly around the death itself (not the whole
//     fight, confirmed by the modest totals vs. a full-fight damage/healing sum) —
//     abilities[0].name is a solid proxy for "what actually killed them."
//     fights(killType: Encounters) entries include `name` (the boss name), which
//     table(dataType: Deaths) entries don't carry directly — join on `fight` id.
//   - rankings(fightIDs) -> data[]: one entry per fight, each with
//     roles.{tanks,healers,dps}.characters[]: { name, class, spec, rankPercent, ... },
//     confirmed real. Only class/spec/role (extractActualIdentity) are still used from
//     this — rankPercent itself is WCL's GLOBAL parse percentile (ranked against every
//     log on the site for that spec/boss/difficulty, not just this raid), which doesn't
//     match guild policy; see below.
//   - table(dataType: Healing) is assumed to mirror DamageDone's shape (same table
//     system, same total/activeTime fields) — this specific dataType was not
//     independently tested live; flagged here rather than silently assumed elsewhere.
//   - table(dataType: DamageTaken) is likewise assumed to mirror DamageDone's shape
//     (total/activeTime alongside the already-verified abilities[] used for mechanic-
//     miss detection) — not independently tested live either.
//
// Guild policy ("we don't judge parses"): healer/tank perf is a LOCAL within-role
// percentile — ranked only against the other healers/tanks who played that role in
// the same report (computeLocalPercentiles, from the hps/damageTaken throughput this
// file already fetches), never WCL's own rankPercent. rankPercent ranks against the
// entire WCL population for that spec/boss/difficulty, which structurally skews low
// for a non-cutting-edge guild regardless of how the guild's own healers/tanks are
// actually doing relative to each other -- this was the root cause of healer/tank
// percentiles reading low across the board. DPS perf is %-of-the-guild's-own-minimum-
// DPS, same "never a global WCL parse" policy, just via a flat threshold instead of a
// percentile -- that minimum is settingsStore's minDps (GM-editable from Settings),
// falling back to the MIN_DPS_REQUIREMENT env var only while minDps is unset (0), so
// an existing deploy keeps working until someone actually sets a real value.
//
// A boss can be excluded from the DPS check specifically (settingsStore's
// excludedBossesFromDps, keyed by exact fight name -- WCL's own encounterID does NOT
// match Blizzard's Journal encounter IDs used elsewhere in this app, confirmed live
// by comparing a real fight's encounterID [3420] against Sszorak's real Journal
// encounter ID [2871], so name is the only reliable join key here) -- deaths,
// healer/tank percentile, and pull counts are unaffected either way, only DPS is.

const { getClientCredentialsToken } = require('./oauth.cjs');
const { BOSS_MECHANICS } = require('./mechanicReference.cjs');
const settingsStore = require('./settingsStore.cjs');

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const GRAPHQL_URL = 'https://www.warcraftlogs.com/api/v2/client';

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.WCL_CLIENT_ID, process.env.WCL_CLIENT_SECRET);
}

async function graphql(query, variables) {
  const token = await getToken();
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Warcraft Logs GraphQL request failed: ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.errors) throw new Error(`Warcraft Logs GraphQL errors: ${JSON.stringify(body.errors)}`);
  return body.data;
}

const REPORTS_QUERY = `
  query GuildReports($guildName: String!, $guildServerSlug: String!, $guildServerRegion: String!, $limit: Int!) {
    reportData {
      reports(guildName: $guildName, guildServerSlug: $guildServerSlug, guildServerRegion: $guildServerRegion, limit: $limit) {
        data { code startTime endTime zone { name } }
      }
    }
  }
`;

/** Most recent reports for the guild, newest first. */
async function fetchGuildReports(guild, limit = 20) {
  const data = await graphql(REPORTS_QUERY, {
    guildName: guild.name,
    guildServerSlug: guild.realm.toLowerCase().replace(/\s+/g, '-'),
    guildServerRegion: guild.region.toUpperCase(),
    limit,
  });
  return data.reportData.reports.data;
}

const FIGHTS_QUERY = `
  query ReportFights($code: String!) {
    reportData {
      report(code: $code) {
        fights(killType: Encounters) { id name kill encounterID difficulty bossPercentage startTime endTime }
      }
    }
  }
`;

// WCL raid difficulty IDs: 3 = Normal, 4 = Heroic, 5 = Mythic (stable across retail raid tiers).
const HEROIC_DIFFICULTY = 4;
const RAID_DIFFICULTIES = new Set([3, 4, 5]);

// Officers sometimes keep one WCL report running across a raid night AND keys
// afterward, so a single report can mix raid bosses with Mythic+ dungeon bosses --
// `killType: Encounters` matches both (a dungeon boss is still an "encounter").
// Confirmed live: M+ fights carry the keystone level as `difficulty` (e.g. 10 for a
// +10), well outside the raid IDs above, so filtering to RAID_DIFFICULTIES here
// keeps every downstream calculation (deaths, perf, pulls, heroic-kill tracking)
// scoped to actual raid content instead of being skewed by keys.
async function fetchFights(code) {
  const data = await graphql(FIGHTS_QUERY, { code });
  return data.reportData.report.fights.filter((f) => RAID_DIFFICULTIES.has(f.difficulty));
}

async function fetchTable(code, fightIds, dataType) {
  if (fightIds.length === 0) return [];
  const data = await graphql(
    `query($code: String!, $fightIDs: [Int]!) { reportData { report(code: $code) { table(fightIDs: $fightIDs, dataType: ${dataType}) } } }`,
    { code, fightIDs: fightIds },
  );
  return data.reportData.report.table?.data?.entries ?? [];
}

async function fetchRankingsForFight(code, fightId) {
  const data = await graphql(`query($code: String!, $fightIDs: [Int]!) { reportData { report(code: $code) { rankings(fightIDs: $fightIDs) } } }`, {
    code,
    fightIDs: [fightId],
  });
  return data.reportData.report.rankings?.data?.[0] ?? null;
}

const MASTER_DATA_QUERY = `
  query ReportActors($code: String!) {
    reportData {
      report(code: $code) {
        masterData { actors(type: "Player") { name server type subType } }
      }
    }
  }
`;

// masterData.actors' `server` comes straight off the combat log, not from any
// officer-entered roster field -- confirmed live earlier as the way to establish a
// character's REAL home realm when a third-party tracker (wowaudit) had it wrong
// for one raider ("Dunbarke": wowaudit said "Area 52", the log said "Scarlet
// Crusade" -- two different real characters that happen to share a name). Used to
// build an authoritative name -> observed-server(s) map so that class of data-entry
// error gets caught automatically instead of by an officer noticing wrong stats.
async function fetchReportActorServers(code) {
  const data = await graphql(MASTER_DATA_QUERY, { code });
  const actors = data.reportData.report.masterData?.actors ?? [];
  const byName = new Map();
  for (const a of actors) {
    if (!a.server) continue;
    const set = byName.get(a.name) ?? new Set();
    set.add(a.server);
    byName.set(a.name, set);
  }
  return byName;
}

/** Sums DamageDone/Healing entries per player across however many fights they're scoped to. */
function sumThroughputByName(entries) {
  const byName = new Map();
  for (const e of entries) {
    const prev = byName.get(e.name) ?? { total: 0, activeTime: 0 };
    byName.set(e.name, { total: prev.total + (e.total ?? 0), activeTime: prev.activeTime + (e.activeTime ?? 0) });
  }
  const dps = new Map();
  for (const [name, { total, activeTime }] of byName) dps.set(name, activeTime > 0 ? total / (activeTime / 1000) : 0);
  return dps;
}

function countDeathsByName(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  return counts;
}

/**
 * One {boss, ability} cause per death event, keyed by player name -- the top entry
 * in each death's damage.abilities[] (already sorted descending by total) as the
 * primary cause, joined against the fight-id -> boss-name map for this report.
 */
function extractDeathCausesByName(entries, fightNameById) {
  const causesByName = new Map();
  for (const e of entries) {
    const topAbility = e.damage?.abilities?.[0]?.name;
    const boss = fightNameById.get(e.fight);
    if (!topAbility || !boss) continue; // e.g. a fight this join can't resolve -- skip rather than show a broken cause
    const list = causesByName.get(e.name) ?? [];
    list.push({ boss, ability: topAbility });
    causesByName.set(e.name, list);
  }
  return causesByName;
}

// Normal CDF via the Abramowitz & Stegun approximation (good to ~1e-7) -- no
// dependency needed for a single distribution function.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

/**
 * Percentile of each player in `throughputByName` among only their peers of the same
 * role (per `roleOf(name)`) for THIS ONE REPORT -- based on how many standard
 * deviations above/below the role's own average they are, converted to a 0-100
 * percentile via the normal distribution. This is the local, within-raid replacement
 * for WCL's own rankPercent (see the file header): higherIsBetter is true for HPS
 * (healers), false for damage-taken-per-second (tanks, where taking LESS damage is
 * the better outcome). Feeds the "Raid Night" window (nightParse) via
 * nightFieldsFromAggregate below.
 *
 * Deliberately not a rank-order percentile (worst=0, best=100, evenly spaced) -- but
 * be aware this still has a real limit of its own with exactly two peers: given only
 * two numbers, the z-score of either one against their own pair's mean/stddev is
 * ALWAYS exactly +-1 no matter how close or far apart the two actual numbers are (an
 * algebraic fact, not an edge case -- see computeSeasonPercentiles below for the fix,
 * which pools many more than two data points). This function keeps the simpler
 * per-pair comparison because a single report only ever offers one number per raider
 * to begin with -- there's no larger pool available to draw from within one night.
 *
 * A role with fewer than 2 peers has no meaningful spread, so gets 100 by definition
 * (nothing to compare against) rather than an undefined percentile. A role where
 * everyone posted the identical number (stddev 0) gets 50 for the same reason --
 * there's no "above" or "below" when nobody differs.
 */
function computeLocalPercentiles(throughputByName, roleOf, role, higherIsBetter) {
  const pool = [...throughputByName.entries()].filter(([name, v]) => v != null && roleOf(name) === role);
  const n = pool.length;
  const result = new Map();
  if (n === 0) return result;
  if (n === 1) {
    result.set(pool[0][0], 100);
    return result;
  }

  const mean = pool.reduce((sum, [, v]) => sum + v, 0) / n;
  const variance = pool.reduce((sum, [, v]) => sum + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  for (const [name, v] of pool) {
    if (stddev === 0) {
      result.set(name, 50);
      continue;
    }
    const z = ((v - mean) / stddev) * (higherIsBetter ? 1 : -1);
    result.set(name, Math.round(normalCdf(z) * 100));
  }
  return result;
}

const RANKINGS_ROLE_KEY = { tanks: 'tank', healers: 'healer', dps: 'dps' };

// WCL's class/spec strings are PascalCase with no spaces ("DemonHunter",
// "BeastMastery"); Raider.IO's (and this app's sample data) are spaced ("Demon
// Hunter", "Beast Mastery"). Normalize so the two are interchangeable in the UI.
function spaceWclName(s) {
  return typeof s === 'string' ? s.replace(/([a-z])([A-Z])/g, '$1 $2') : s;
}

// Who someone actually WAS in a given report -- role, class, and spec -- straight
// from WCL's own rankings entries (each character row carries `class`/`spec` fields
// directly, confirmed live). Two independent staleness bugs this fixes at once:
// wowaudit's roster role is a static field an officer sets once (confirmed live to
// disagree -- an off-spec tank night still showing "dps" there), and Raider.IO's
// class/spec is whatever they're CURRENTLY playing when the app happens to fetch it,
// not what they played during the historical raid night being displayed (confirmed
// live: RIO said "Havoc" days after a report where WCL shows they tanked as
// "Vengeance" that night -- "Havoc Demon Hunter · Tank" is a visibly contradictory
// spec/role pairing that game experts would immediately notice as wrong).
function extractActualIdentity(ranking) {
  const result = new Map();
  if (!ranking?.roles) return result;
  for (const [key, roleData] of Object.entries(ranking.roles)) {
    const role = RANKINGS_ROLE_KEY[key];
    if (!role) continue;
    for (const c of roleData.characters ?? []) result.set(c.name, { role, class: spaceWclName(c.class), spec: spaceWclName(c.spec) });
  }
  return result;
}

/**
 * One report's aggregate: DPS (damage/s per player), HPS (healing/s per player),
 * deaths (count per player), pullCount (kill pulls in this report -- the
 * denominator for a per-pull death rate, not a raw tier-wide total), healerPercent/
 * tankPercent (each player's local within-role percentile across the whole report's
 * kills -- see computeLocalPercentiles), and the set of encounterIDs killed at
 * Heroic difficulty in this report (for real tier-progression tracking, replacing
 * the old hardcoded "3/8" text). Role-pool membership for the percentiles comes from
 * `ranking` (the report's last kill only, same scope WCL's own rankPercent used) --
 * a raider entirely absent from that one ranking sample gets no percentile, same
 * pre-existing limitation this replaces rather than a new one.
 *
 * `excludedBossNames` (a Set of exact fight names) drops those bosses' kills from the
 * DPS table fetch ONLY -- healing/damage-taken/deaths/pullCount/rankings all still use
 * every kill in the report, so excluding a boss from the DPS check never touches
 * healer/tank percentile or death tracking.
 */
async function fetchReportAggregate(code, excludedBossNames = new Set()) {
  const fights = await fetchFights(code);
  const killFightIds = fights.filter((f) => f.kill).map((f) => f.id);
  const dpsFightIds = fights.filter((f) => f.kill && !excludedBossNames.has(f.name)).map((f) => f.id);
  const heroicKillEncounterIds = fights.filter((f) => f.kill && f.difficulty === HEROIC_DIFFICULTY).map((f) => f.encounterID);
  const fightNameById = new Map(fights.map((f) => [f.id, f.name]));

  if (killFightIds.length === 0) {
    return { dps: new Map(), hps: new Map(), damageTaken: new Map(), deaths: new Map(), deathCauses: new Map(), pullCount: 0, healerPercent: new Map(), tankPercent: new Map(), actualIdentity: new Map(), heroicKillEncounterIds, actorServers: new Map() };
  }

  const [damageEntries, healingEntries, damageTakenEntries, deathEntries, ranking, actorServers] = await Promise.all([
    fetchTable(code, dpsFightIds, 'DamageDone'),
    fetchTable(code, killFightIds, 'Healing'),
    fetchTable(code, killFightIds, 'DamageTaken'),
    fetchTable(code, killFightIds, 'Deaths'),
    fetchRankingsForFight(code, killFightIds[killFightIds.length - 1]),
    fetchReportActorServers(code),
  ]);

  const actualIdentity = extractActualIdentity(ranking);
  const roleOf = (name) => actualIdentity.get(name)?.role;
  const hps = sumThroughputByName(healingEntries);
  const damageTaken = sumThroughputByName(damageTakenEntries);

  return {
    dps: sumThroughputByName(damageEntries),
    hps,
    // Exposed (not just consumed locally below) so fetchWarcraftLogs can pool it
    // across every report this tier for the season-wide tank percentile.
    damageTaken,
    deaths: countDeathsByName(deathEntries),
    deathCauses: extractDeathCausesByName(deathEntries, fightNameById),
    pullCount: killFightIds.length,
    // Local, within-raid percentiles for THIS report only -- what the "Raid Night"
    // window shows (see fetchWarcraftLogs for the season-pooled version used
    // tier-to-date). Higher HPS is better for healers; LESS damage taken per second
    // is better for tanks (survivability), hence false.
    healerPercent: computeLocalPercentiles(hps, roleOf, 'healer', true),
    tankPercent: computeLocalPercentiles(damageTaken, roleOf, 'tank', false),
    actualIdentity,
    heroicKillEncounterIds,
    actorServers,
  };
}

const MIN_DPS_ROLE = 'dps';
// A generous safety bound, not a "just cite the latest one" cap anymore -- the
// roster-wide "who's dying to what" mechanics report needs each raider's full death
// history for the window, not just their most recent cause.
const DEATH_CAUSE_CAP = 60;

// Extracted so both fetchWarcraftLogs (tier-to-date + latest night) and
// fetchNightSnapshot (an officer picking an arbitrary past night) share the exact
// same "which formula does this raider's perf use" logic instead of drifting apart.
function perfSnapshotFor(name, agg, roleByName, minDps) {
  // Prefer the role they actually played in THIS report (WCL's own rankings data)
  // over wowaudit's static roster role -- confirmed live to drift (an off-spec
  // fill-in night: wowaudit still said "dps", WCL showed them tanking every kill).
  const role = agg.actualIdentity.get(name)?.role ?? roleByName[name];
  if (role === MIN_DPS_ROLE) {
    const dps = agg.dps.get(name);
    return dps == null ? null : Math.round((dps / minDps) * 100);
  }
  const pct = role === 'healer' ? agg.healerPercent.get(name) : agg.tankPercent.get(name);
  return pct == null ? null : pct;
}

/** The "night" shape (parse/deaths/pulls/deathCauses) for every raider present in one report. */
function nightFieldsFromAggregate(agg, roleByName, minDps) {
  const result = {};
  for (const name of Object.keys(roleByName)) {
    const val = perfSnapshotFor(name, agg, roleByName, minDps);
    if (val == null) continue;
    result[name] = {
      nightParse: val,
      nightDeaths: agg.deaths.get(name) ?? 0,
      nightPulls: agg.pullCount,
      nightDeathCauses: (agg.deathCauses.get(name) ?? []).slice(0, DEATH_CAUSE_CAP),
    };
  }
  return result;
}

/**
 * Season-wide healer/tank percentile. Deliberately NOT "average each raider's
 * numbers across the season, then z-score those averages against each other" --
 * with a role as small as two tanks, that's mathematically degenerate: given only
 * two numbers, the z-score of either one against their own pair-mean/stddev is
 * ALWAYS exactly +-1, no matter how close or far apart the two actual numbers are
 * (confirmed algebraically, not just empirically -- it falls straight out of the
 * variance formula for n=2). More season data wouldn't change that outcome even a
 * little, which defeats the entire point of pooling it.
 *
 * Instead, this builds the reference distribution (mean, spread) from EVERY
 * individual per-report sample this role posted all season -- not one number per
 * raider -- then measures how far each raider's own seasonal average sits from
 * that broader distribution. That's no longer degenerate at n=2 peers, because the
 * distribution itself is built from many more than 2 data points, and it directly
 * rewards "collects more data": more raid nights logged this tier -> a more
 * reliable read on what's actually normal variance for this role in this raid.
 *
 * @returns {{ percentile: Map<string, number>, raw: Map<string, number> }} `raw` is
 *   each raider's own season-average throughput (the number the percentile is
 *   computed FROM) -- surfaced so the app can show "42,300 HPS (72nd percentile)"
 *   instead of the percentile alone, and so it can average `raw` across a role for
 *   an "average HPS this tier" comparison (equal weight per raider, unlike `mean`
 *   above which weights raiders with more logged nights more heavily -- that
 *   weighting is right for the percentile's reference distribution, wrong for a
 *   plain "what does the average healer put out" number).
 */
function computeSeasonPercentiles(aggregates, metricKey, role, roleOf, higherIsBetter) {
  const samples = [];
  const perRaider = new Map(); // name -> {total, count}
  for (const agg of aggregates) {
    for (const [name, value] of agg[metricKey]) {
      if (value == null || roleOf(name) !== role) continue;
      samples.push(value);
      const prev = perRaider.get(name) ?? { total: 0, count: 0 };
      perRaider.set(name, { total: prev.total + value, count: prev.count + 1 });
    }
  }

  const percentile = new Map();
  const raw = new Map();
  for (const [name, { total, count }] of perRaider) raw.set(name, total / count);
  if (samples.length === 0) return { percentile, raw };
  if (perRaider.size === 1) {
    percentile.set([...perRaider.keys()][0], 100); // nothing to compare against
    return { percentile, raw };
  }

  const mean = samples.reduce((a, v) => a + v, 0) / samples.length;
  const variance = samples.reduce((a, v) => a + (v - mean) ** 2, 0) / samples.length;
  const stddev = Math.sqrt(variance);

  for (const [name, avg] of raw) {
    if (stddev === 0) {
      percentile.set(name, 50); // no spread in the data at all -- nobody is above or below
      continue;
    }
    const z = ((avg - mean) / stddev) * (higherIsBetter ? 1 : -1);
    percentile.set(name, Math.round(normalCdf(z) * 100));
  }
  return { percentile, raw };
}

/**
 * @param {{ name: string, realm: string, region: string }} guild
 * @param {string} tierZoneName — only reports in this raid tier count (config.tier.name)
 * @param {Record<string,'tank'|'healer'|'dps'>} roleByName — from wowaudit, since WCL doesn't know raid role assignment
 * @returns {Promise<{ performance: Record<string, { role: 'tank'|'healer'|'dps', class: string|null, spec: string|null, perf: number, perfRaw: number|null, parseTrend: number, deaths: number, pulls: number, deathCauses: {boss:string,ability:string}[], nightParse: number, nightDeaths: number, nightPulls: number, nightDeathCauses: {boss:string,ability:string}[] }>, heroicBossesKilled: number, observedRealms: Record<string, string[]> }>}
 *   perfRaw is the raw metric behind perf -- dps: damage/s from the same report perf uses; healer: season-average healing/s; tank: season-average damage taken/s (lower is better). Null when unavailable.
 */
async function fetchWarcraftLogs(guild, tierZoneName, roleByName) {
  const settings = settingsStore.load();
  const minDps = settings.minDps; // settingsStore.load() already resolves the .env fallback
  if (!minDps) throw new Error('No DPS minimum configured -- set one in Settings, or MIN_DPS_REQUIREMENT in .env as a fallback.');
  const excludedBossNames = new Set(settings.excludedBossesFromDps ?? []);

  const allReports = await fetchGuildReports(guild, 30);
  const tierReports = allReports.filter((r) => r.zone?.name === tierZoneName).sort((a, b) => a.startTime - b.startTime); // oldest -> newest

  if (tierReports.length === 0) throw new Error(`No Warcraft Logs reports found for zone "${tierZoneName}"`);

  const aggregates = await Promise.all(tierReports.map((r) => fetchReportAggregate(r.code, excludedBossNames)));

  const perfSnapshot = (name, agg) => perfSnapshotFor(name, agg, roleByName, minDps);

  // Same "trust what WCL actually saw" preference as perfSnapshot, but resolved once
  // per raider (not per report) since this feeds the roster's Tank/Healer/Damage
  // section grouping and the class/spec shown on their row -- those need one stable
  // answer, not a per-report one. Newest report wins so a recent respec is reflected
  // quickly; wowaudit's roster role / Raider.IO's class+spec are the fallback only
  // when WCL has no rankings data for them at all this tier.
  const resolvedIdentity = {};
  for (let i = aggregates.length - 1; i >= 0; i--) {
    for (const [name, identity] of aggregates[i].actualIdentity) {
      if (!(name in resolvedIdentity)) resolvedIdentity[name] = identity;
    }
  }

  // Season-wide healer/tank percentile: rank each raider against every other
  // raider who played that role at ANY point this tier, using their AVERAGE
  // throughput across all of it -- not just whoever happened to be logged on the
  // most recent report. This is what makes the number stable and meaningful with
  // a small raid roster (e.g. two tanks): the underlying average for each of them
  // is backed by the whole season, even though there are still only two people to
  // compare against. DPS is unaffected -- it stays %-of-the-guild's-minimum, a
  // flat threshold rather than a ranking, so it has no "peer pool" to grow.
  const roleOfResolved = (name) => resolvedIdentity[name]?.role ?? roleByName[name];
  const { percentile: seasonHealerPercent, raw: seasonHealerRaw } = computeSeasonPercentiles(aggregates, 'hps', 'healer', roleOfResolved, true);
  const { percentile: seasonTankPercent, raw: seasonTankRaw } = computeSeasonPercentiles(aggregates, 'damageTaken', 'tank', roleOfResolved, false);

  const names = Object.keys(roleByName);
  const result = {};

  for (const name of names) {
    // Perf: latest report that has this player, tier-to-date.
    const seriesAll = aggregates.map((agg) => perfSnapshot(name, agg)).filter((v) => v != null);
    const seriesLast = seriesAll[seriesAll.length - 1] ?? null;
    // Raw DPS from that SAME report, using the exact PER-REPORT role check
    // perfSnapshotFor uses internally (agg.actualIdentity, not the tier-wide
    // resolvedIdentity below) -- a raider who played an off-role one night has a
    // seriesAll entry from a different branch (healerPercent/tankPercent, not
    // %-of-minimum) that report, and this has to skip it the same way to stay
    // index-aligned with seriesAll/seriesLast. This is the raw number %-of-minimum
    // is computed from, not a season average, since DPS perf itself isn't
    // season-pooled the way healer/tank percentile is.
    const dpsRawSeriesAll = aggregates
      .map((agg) => ((agg.actualIdentity.get(name)?.role ?? roleByName[name]) === MIN_DPS_ROLE ? agg.dps.get(name) : null))
      .filter((v) => v != null);
    const dpsRawLast = dpsRawSeriesAll[dpsRawSeriesAll.length - 1] ?? null;
    if (seriesLast == null) {
      // No logged raid history this tier yet (new recruit, long absence, etc) — skip
      // them rather than failing the whole roster fetch over one missing raider.
      console.warn(`[wcl] No performance data found for ${name} in "${tierZoneName}" — omitting from this fetch.`);
      continue;
    }

    // Trend: second-half average minus first-half average across the tier's reports.
    const mid = Math.ceil(seriesAll.length / 2);
    const firstHalf = seriesAll.slice(0, mid);
    const secondHalf = seriesAll.slice(mid);
    const avg = (arr) => arr.reduce((a, v) => a + v, 0) / Math.max(1, arr.length);
    const parseTrend = seriesAll.length >= 2 ? Math.round(avg(secondHalf) - avg(firstHalf)) : 0;

    // Deaths per pull, not a raw tier-wide total: only count deaths and pulls from
    // reports this player actually raided (same presence check perf uses), so
    // absences don't inflate their pull count and understate their death rate.
    let deaths = 0;
    let pulls = 0;
    let deathCauses = [];
    for (const agg of aggregates) {
      if (perfSnapshot(name, agg) == null) continue; // wasn't in this report
      deaths += agg.deaths.get(name) ?? 0;
      pulls += agg.pullCount;
      deathCauses = deathCauses.concat(agg.deathCauses.get(name) ?? []);
    }
    // Most recent causes first, capped -- feedback text only ever cites the latest one or two.
    deathCauses = deathCauses.reverse().slice(0, DEATH_CAUSE_CAP);

    // Healers/tanks: the season-pooled percentile, not just the latest report's --
    // falls back to seriesLast on the rare miss (e.g. their only appearances this
    // tier were all off-role, so they never entered the season pool for their
    // primary role) so nobody silently loses a perf number.
    const role = roleOfResolved(name);
    const seasonPerf = role === 'healer' ? seasonHealerPercent.get(name) : role === 'tank' ? seasonTankPercent.get(name) : null;
    // Raw metric behind perf, for display alongside the percentile/%-of-minimum --
    // dpsRawLast can be a night behind seriesLast in the rare case their most
    // recent appearance was an off-role night (see the comment above
    // dpsRawSeriesAll); healer/tank use the same season pool perf itself draws
    // from, so those two always agree in scope.
    const perfRaw = role === MIN_DPS_ROLE ? dpsRawLast : role === 'healer' ? (seasonHealerRaw.get(name) ?? null) : role === 'tank' ? (seasonTankRaw.get(name) ?? null) : null;

    result[name] = {
      role,
      class: resolvedIdentity[name]?.class ?? null,
      spec: resolvedIdentity[name]?.spec ?? null,
      perf: seasonPerf ?? seriesLast,
      perfRaw: perfRaw == null ? null : Math.round(perfRaw),
      parseTrend,
      deaths,
      pulls,
      deathCauses,
      nightParse: seriesLast,
      nightDeaths: 0,
      nightPulls: 0,
      nightDeathCauses: [],
    };
  }

  // nightParse/nightDeaths/nightPulls/nightDeathCauses default to the MOST RECENT
  // report, not tier-to-date figures -- an officer can override this to any past
  // night via fetchNightSnapshot (see fetchRoster.cjs merging that in on top).
  const lastAgg = aggregates[aggregates.length - 1];
  const lastNightFields = nightFieldsFromAggregate(lastAgg, roleByName, minDps);
  for (const name of names) {
    if (lastNightFields[name]) Object.assign(result[name], lastNightFields[name]);
  }

  const heroicBossesKilled = new Set(aggregates.flatMap((agg) => agg.heroicKillEncounterIds)).size;

  // Authoritative name -> observed realm(s), straight from combat log actor data
  // across every report this tier -- independent of what any roster tracker claims.
  const observedRealms = {};
  for (const agg of aggregates) {
    for (const [name, servers] of agg.actorServers) {
      const set = observedRealms[name] ?? new Set();
      for (const s of servers) set.add(s);
      observedRealms[name] = set;
    }
  }
  for (const name of Object.keys(observedRealms)) observedRealms[name] = [...observedRealms[name]];

  return { performance: result, heroicBossesKilled, observedRealms };
}

/**
 * Every past raid night for this tier, newest first, for a "pick a raid night"
 * dropdown -- just the report list, no per-pull data (that's fetchPullBreakdown,
 * called only once a specific night is selected, since it's a much heavier fetch).
 * @returns {Promise<{ code: string, date: string }[]>}
 */
async function fetchRaidNights(guild, tierZoneName) {
  const allReports = await fetchGuildReports(guild, 30);
  return allReports
    .filter((r) => r.zone?.name === tierZoneName)
    .sort((a, b) => b.startTime - a.startTime)
    .map((r) => ({ code: r.code, date: new Date(r.startTime).toISOString() }));
}

/**
 * Pull-by-pull breakdown for one raid night: every attempt (wipes included, not just
 * kills -- unlike fetchReportAggregate's tier-scoring path, which only counts kills),
 * with per-raider throughput, deaths, and "mechanic miss" flags (took damage from a
 * known avoidable ability on this boss, without dying to it -- see
 * mechanicReference.cjs for what's covered and what isn't).
 *
 * Tank survivability is a LOCAL percentile against just the tanks present on that one
 * pull (least damage taken per second = 100), computed from the same DamageTaken table
 * already fetched for mechanic-miss detection below -- unlike WCL's own rankPercent
 * (which this replaced), it's available on wipes too, not kill pulls only, since
 * damage-taken data exists regardless of whether the pull was a kill.
 *
 * Role-for-the-night is resolved once from whichever kill fights exist in this report
 * (same "trust WCL's rankings role bucket over wowaudit's static field" fix as the
 * tier-wide pipeline) and applied to every pull in the report, since nobody swaps main
 * spec mid-raid-night -- wipes have no rankings of their own to resolve it from.
 *
 * @returns {Promise<{ pulls: Array<{ fightId: number, pullNumber: number, boss: string, kill: boolean, bossPercentage: number|null, durationMs: number, raiders: Array<{name: string, role: string|null, metric: 'dps'|'hps'|'survivalPercent'|null, value: number|null}>, deaths: Array<{name: string, ability: string}>, mechanicMisses: Array<{name: string, ability: string, what: string, fix: string}> }> }>}
 */
async function fetchPullBreakdown(code, roleByName) {
  const fights = await fetchFights(code);
  if (fights.length === 0) return { pulls: [] };

  const killFights = fights.filter((f) => f.kill);
  const rankingsByKillFight = await Promise.all(killFights.map((f) => fetchRankingsForFight(code, f.id)));
  const nightRoles = new Map();
  for (const ranking of rankingsByKillFight) {
    for (const [name, identity] of extractActualIdentity(ranking)) nightRoles.set(name, identity.role);
  }
  const resolveRole = (name) => nightRoles.get(name) ?? roleByName[name] ?? null;

  const pulls = await Promise.all(
    fights.map(async (fight, idx) => {
      const fightIds = [fight.id];
      const [damageEntries, healingEntries, deathEntries, damageTakenEntries] = await Promise.all([
        fetchTable(code, fightIds, 'DamageDone'),
        fetchTable(code, fightIds, 'Healing'),
        fetchTable(code, fightIds, 'Deaths'),
        fetchTable(code, fightIds, 'DamageTaken'),
      ]);

      const dps = sumThroughputByName(damageEntries);
      const hps = sumThroughputByName(healingEntries);
      const damageTaken = sumThroughputByName(damageTakenEntries);
      const survivalPercent = computeLocalPercentiles(damageTaken, resolveRole, 'tank', false);
      const deathNames = new Set(deathEntries.map((e) => e.name));
      const deaths = deathEntries.map((e) => ({ name: e.name, ability: e.damage?.abilities?.[0]?.name ?? 'Unknown' }));

      const damageTakenAbilitiesByName = new Map();
      for (const e of damageTakenEntries) {
        damageTakenAbilitiesByName.set(e.name, new Set((e.abilities ?? []).map((a) => a.name)));
      }

      const mechanicDefs = BOSS_MECHANICS[fight.name] ?? [];
      const mechanicMisses = [];
      for (const [name, abilities] of damageTakenAbilitiesByName) {
        if (deathNames.has(name)) continue; // died to it -- that's covered by deaths, not a "survived but missed it"
        for (const def of mechanicDefs) {
          if (abilities.has(def.ability)) mechanicMisses.push({ name, ability: def.ability, what: def.what, fix: def.fix });
        }
      }

      const names = new Set([...dps.keys(), ...hps.keys(), ...damageTakenAbilitiesByName.keys()]);
      const raiders = [...names].map((name) => {
        const role = resolveRole(name);
        if (role === 'dps') return { name, role, metric: 'dps', value: dps.get(name) ?? null };
        if (role === 'healer') return { name, role, metric: 'hps', value: hps.get(name) ?? null };
        if (role === 'tank') return { name, role, metric: 'survivalPercent', value: survivalPercent.get(name) ?? null };
        return { name, role, metric: null, value: null };
      });

      return {
        fightId: fight.id,
        pullNumber: idx + 1,
        boss: fight.name,
        kill: fight.kill,
        bossPercentage: fight.bossPercentage ?? null,
        durationMs: fight.endTime - fight.startTime,
        raiders,
        deaths,
        mechanicMisses,
      };
    }),
  );

  return { pulls };
}

/**
 * Night-window stats (parse/deaths/pulls/deathCauses) for one specific past raid
 * night, picked by an officer instead of always defaulting to the most recent --
 * the Raider Status "Season Overview" / pick-a-log window selector. Reuses the same
 * perf formula and 60-cause cap as the tier-wide pipeline, just scoped to one report.
 *
 * @param {string} code — a Warcraft Logs report code (from fetchRaidNights)
 * @param {Record<string,'tank'|'healer'|'dps'>} roleByName
 * @returns {Promise<Record<string, { nightParse: number, nightDeaths: number, nightPulls: number, nightDeathCauses: {boss:string,ability:string}[] }>>}
 */
async function fetchNightSnapshot(code, roleByName) {
  const settings = settingsStore.load();
  const minDps = settings.minDps; // settingsStore.load() already resolves the .env fallback
  if (!minDps) throw new Error('No DPS minimum configured -- set one in Settings, or MIN_DPS_REQUIREMENT in .env as a fallback.');
  const excludedBossNames = new Set(settings.excludedBossesFromDps ?? []);
  const agg = await fetchReportAggregate(code, excludedBossNames);
  return nightFieldsFromAggregate(agg, roleByName, minDps);
}

module.exports = { fetchWarcraftLogs, fetchGuildReports, fetchFights, fetchReportAggregate, fetchRaidNights, fetchPullBreakdown, fetchNightSnapshot };
