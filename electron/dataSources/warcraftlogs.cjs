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
        fights(killType: Encounters) { id name kill encounterID difficulty }
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
    return { dps: new Map(), hps: new Map(), deaths: new Map(), deathCauses: new Map(), pullCount: 0, rankPercent: new Map(), heroicKillEncounterIds };
  }

  const [damageEntries, healingEntries, deathEntries, ranking] = await Promise.all([
    fetchTable(code, killFightIds, 'DamageDone'),
    fetchTable(code, killFightIds, 'Healing'),
    fetchTable(code, killFightIds, 'Deaths'),
    fetchRankingsForFight(code, killFightIds[killFightIds.length - 1]),
  ]);

  return {
    dps: sumThroughputByName(damageEntries),
    hps: sumThroughputByName(healingEntries),
    deaths: countDeathsByName(deathEntries),
    deathCauses: extractDeathCausesByName(deathEntries, fightNameById),
    pullCount: killFightIds.length,
    rankPercent: extractRankPercents(ranking),
    heroicKillEncounterIds,
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
 * @returns {Promise<{ performance: Record<string, { perf: number, parseTrend: number, deaths: number, pulls: number, deathCauses: {boss:string,ability:string}[], nightParse: number, nightDeaths: number, nightPulls: number, nightDeathCauses: {boss:string,ability:string}[] }>, heroicBossesKilled: number }>}
 */
async function fetchWarcraftLogs(guild, tierZoneName, roleByName) {
  const minDps = Number(process.env.MIN_DPS_REQUIREMENT ?? 0);
  if (!minDps) throw new Error('MIN_DPS_REQUIREMENT is not set in .env');

  const allReports = await fetchGuildReports(guild, 30);
  const tierReports = allReports.filter((r) => r.zone?.name === tierZoneName).sort((a, b) => a.startTime - b.startTime); // oldest -> newest

  if (tierReports.length === 0) throw new Error(`No Warcraft Logs reports found for zone "${tierZoneName}"`);

  const aggregates = await Promise.all(tierReports.map((r) => fetchReportAggregate(r.code)));

  const perfSnapshot = (name, agg) => {
    const role = roleByName[name];
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

  return { performance: result, heroicBossesKilled };
}

module.exports = { fetchWarcraftLogs, fetchGuildReports, fetchFights, fetchReportAggregate };
