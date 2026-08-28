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
//     roles.{tanks,healers,dps}.characters[]: { name, rankPercent, ... }, confirmed real.
//   - table(dataType: Healing) is assumed to mirror DamageDone's shape (same table
//     system, same total/activeTime fields) — this specific dataType was not
//     independently tested live; flagged here rather than silently assumed elsewhere.
//
// Guild policy ("we don't judge parses"): rankPercent is used ONLY for healers/tanks,
// where it's a within-role comparison (healing load and damage taken both vary by
// pull, so ranking against your own role on the same fight is the fair reference
// point). DPS perf is %-of-the-guild's-own-minimum-DPS (MIN_DPS_REQUIREMENT env var),
// never a global WCL parse ranking.

const { getClientCredentialsToken } = require('./oauth.cjs');
const { BOSS_MECHANICS } = require('./mechanicReference.cjs');

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

/** rankPercent per player, per role, from a single fight's rankings. */
function extractRankPercents(ranking) {
  const result = new Map();
  if (!ranking?.roles) return result;
  for (const roleData of Object.values(ranking.roles)) {
    for (const c of roleData.characters ?? []) result.set(c.name, c.rankPercent);
  }
  return result;
}

const RANKINGS_ROLE_KEY = { tanks: 'tank', healers: 'healer', dps: 'dps' };

// The role someone actually PLAYED in a given report, from WCL's own rankings role
// buckets -- confirmed live to disagree with wowaudit's roster role (wowaudit said
// "dps", WCL showed the same raider tanking every kill in the latest report, e.g. an
// off-spec fill-in night). wowaudit's role field is a static roster assignment an
// officer sets once and can go stale; this is what they actually did that night, so
// it's what perf scoring should key off of, not the roster field.
function extractActualRoles(ranking) {
  const result = new Map();
  if (!ranking?.roles) return result;
  for (const [key, roleData] of Object.entries(ranking.roles)) {
    const role = RANKINGS_ROLE_KEY[key];
    if (!role) continue;
    for (const c of roleData.characters ?? []) result.set(c.name, role);
  }
  return result;
}

/**
 * One report's aggregate: DPS (damage/s per player), HPS (healing/s per player),
 * deaths (count per player), pullCount (kill pulls in this report -- the
 * denominator for a per-pull death rate, not a raw tier-wide total), one
 * representative rankPercent sample (from the report's last kill, since a full
 * per-pull average isn't worth the extra API calls), and the set of encounterIDs
 * killed at Heroic difficulty in this report (for real tier-progression tracking,
 * replacing the old hardcoded "3/8" text).
 */
async function fetchReportAggregate(code) {
  const fights = await fetchFights(code);
  const killFightIds = fights.filter((f) => f.kill).map((f) => f.id);
  const heroicKillEncounterIds = fights.filter((f) => f.kill && f.difficulty === HEROIC_DIFFICULTY).map((f) => f.encounterID);
  const fightNameById = new Map(fights.map((f) => [f.id, f.name]));

  if (killFightIds.length === 0) {
    return { dps: new Map(), hps: new Map(), deaths: new Map(), deathCauses: new Map(), pullCount: 0, rankPercent: new Map(), actualRoles: new Map(), heroicKillEncounterIds, actorServers: new Map() };
  }

  const [damageEntries, healingEntries, deathEntries, ranking, actorServers] = await Promise.all([
    fetchTable(code, killFightIds, 'DamageDone'),
    fetchTable(code, killFightIds, 'Healing'),
    fetchTable(code, killFightIds, 'Deaths'),
    fetchRankingsForFight(code, killFightIds[killFightIds.length - 1]),
    fetchReportActorServers(code),
  ]);

  return {
    dps: sumThroughputByName(damageEntries),
    hps: sumThroughputByName(healingEntries),
    deaths: countDeathsByName(deathEntries),
    deathCauses: extractDeathCausesByName(deathEntries, fightNameById),
    pullCount: killFightIds.length,
    rankPercent: extractRankPercents(ranking),
    actualRoles: extractActualRoles(ranking),
    heroicKillEncounterIds,
    actorServers,
  };
}

const MIN_DPS_ROLE = 'dps';
// A generous safety bound, not a "just cite the latest one" cap anymore -- the
// roster-wide "who's dying to what" mechanics report needs each raider's full death
// history for the window, not just their most recent cause.
const DEATH_CAUSE_CAP = 60;

/**
 * @param {{ name: string, realm: string, region: string }} guild
 * @param {string} tierZoneName — only reports in this raid tier count (config.tier.name)
 * @param {Record<string,'tank'|'healer'|'dps'>} roleByName — from wowaudit, since WCL doesn't know raid role assignment
 * @returns {Promise<{ performance: Record<string, { perf: number, parseTrend: number, deaths: number, pulls: number, deathCauses: {boss:string,ability:string}[], nightParse: number, nightDeaths: number, nightPulls: number, nightDeathCauses: {boss:string,ability:string}[] }>, heroicBossesKilled: number, observedRealms: Record<string, string[]> }>}
 */
async function fetchWarcraftLogs(guild, tierZoneName, roleByName) {
  const minDps = Number(process.env.MIN_DPS_REQUIREMENT ?? 0);
  if (!minDps) throw new Error('MIN_DPS_REQUIREMENT is not set in .env');

  const allReports = await fetchGuildReports(guild, 30);
  const tierReports = allReports.filter((r) => r.zone?.name === tierZoneName).sort((a, b) => a.startTime - b.startTime); // oldest -> newest

  if (tierReports.length === 0) throw new Error(`No Warcraft Logs reports found for zone "${tierZoneName}"`);

  const aggregates = await Promise.all(tierReports.map((r) => fetchReportAggregate(r.code)));

  const perfSnapshot = (name, agg) => {
    // Prefer the role they actually played in THIS report (WCL's own rankings data)
    // over wowaudit's static roster role -- confirmed live to drift (an off-spec
    // fill-in night: wowaudit still said "dps", WCL showed them tanking every kill).
    // wowaudit's role only fills in when WCL has no rankings entry for them at all.
    const role = agg.actualRoles.get(name) ?? roleByName[name];
    if (role === MIN_DPS_ROLE) {
      const dps = agg.dps.get(name);
      return dps == null ? null : Math.round((dps / minDps) * 100);
    }
    const rp = agg.rankPercent.get(name);
    return rp == null ? null : Math.round(rp);
  };

  const names = Object.keys(roleByName);
  const result = {};

  for (const name of names) {
    // Perf: latest report that has this player, tier-to-date.
    const seriesAll = aggregates.map((agg) => perfSnapshot(name, agg)).filter((v) => v != null);
    const seriesLast = seriesAll[seriesAll.length - 1] ?? null;
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

    result[name] = { perf: seriesLast, parseTrend, deaths, pulls, deathCauses, nightParse: seriesLast, nightDeaths: 0, nightPulls: 0, nightDeathCauses: [] };
  }

  // nightParse/nightDeaths/nightPulls/nightDeathCauses should reflect only the MOST
  // RECENT report, not tier-to-date figures.
  const lastAgg = aggregates[aggregates.length - 1];
  for (const name of names) {
    const nightVal = perfSnapshot(name, lastAgg);
    if (nightVal != null) {
      result[name].nightParse = nightVal;
      result[name].nightDeaths = lastAgg.deaths.get(name) ?? 0;
      result[name].nightPulls = lastAgg.pullCount;
      result[name].nightDeathCauses = (lastAgg.deathCauses.get(name) ?? []).slice(0, DEATH_CAUSE_CAP);
    }
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
 * rankPercent is WCL-kill-only (confirmed live: rankings(fightIDs) returns an empty
 * roster for a wipe fight -- there's no defined percentile for an incomplete attempt),
 * so tanks (scored on rankPercent, same convention as the tier-wide pipeline) show no
 * number on wipes. DPS/healers show raw throughput every pull, kill or wipe.
 *
 * Role-for-the-night is resolved once from whichever kill fights exist in this report
 * (same "trust WCL's rankings role bucket over wowaudit's static field" fix as the
 * tier-wide pipeline) and applied to every pull in the report, since nobody swaps main
 * spec mid-raid-night -- wipes have no rankings of their own to resolve it from.
 *
 * @returns {Promise<{ pulls: Array<{ fightId: number, pullNumber: number, boss: string, kill: boolean, bossPercentage: number|null, durationMs: number, raiders: Array<{name: string, role: string|null, metric: 'dps'|'hps'|'rankPercent'|null, value: number|null}>, deaths: Array<{name: string, ability: string}>, mechanicMisses: Array<{name: string, ability: string, description: string}> }> }>}
 */
async function fetchPullBreakdown(code, roleByName) {
  const fights = await fetchFights(code);
  if (fights.length === 0) return { pulls: [] };

  const killFights = fights.filter((f) => f.kill);
  const rankingsByKillFight = await Promise.all(killFights.map((f) => fetchRankingsForFight(code, f.id)));
  const nightRoles = new Map();
  for (const ranking of rankingsByKillFight) {
    for (const [name, role] of extractActualRoles(ranking)) nightRoles.set(name, role);
  }
  const resolveRole = (name) => nightRoles.get(name) ?? roleByName[name] ?? null;

  const killRankingByFightId = new Map(killFights.map((f, i) => [f.id, rankingsByKillFight[i]]));

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
      const rankPercent = fight.kill ? extractRankPercents(killRankingByFightId.get(fight.id)) : new Map();
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
          if (abilities.has(def.ability)) mechanicMisses.push({ name, ability: def.ability, description: def.description });
        }
      }

      const names = new Set([...dps.keys(), ...hps.keys(), ...damageTakenAbilitiesByName.keys()]);
      const raiders = [...names].map((name) => {
        const role = resolveRole(name);
        if (role === 'dps') return { name, role, metric: 'dps', value: dps.get(name) ?? null };
        if (role === 'healer') return { name, role, metric: 'hps', value: hps.get(name) ?? null };
        if (role === 'tank') return { name, role, metric: 'rankPercent', value: rankPercent.get(name) ?? null };
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

module.exports = { fetchWarcraftLogs, fetchGuildReports, fetchFights, fetchReportAggregate, fetchRaidNights, fetchPullBreakdown };
