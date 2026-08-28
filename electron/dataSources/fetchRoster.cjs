const { fetchRaiderIO } = require('./raiderio.cjs');
const { fetchWarcraftLogs } = require('./warcraftlogs.cjs');
const { fetchWowauditRoster } = require('./wowaudit.cjs');
const { fetchGearCompletion } = require('./bnet.cjs');
const { mergeSources } = require('./merge.cjs');
const { findRealmMismatches } = require('./realmCheck.cjs');

// WOWAUDIT_TEAM_ID is deliberately not required — wowaudit.cjs reads the team ID
// straight from /v1/team using just the API key, so it's optional (a sanity-check
// cross-reference if the user happens to have it, nothing more).
const REQUIRED_ENV = [
  'GUILD_NAME',
  'GUILD_REALM',
  'GUILD_REGION',
  'WCL_CLIENT_ID',
  'WCL_CLIENT_SECRET',
  'WOWAUDIT_API_KEY',
  'BNET_CLIENT_ID',
  'BNET_CLIENT_SECRET',
  'MIN_DPS_REQUIREMENT',
  'TIER_ZONE_NAME',
];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/**
 * Returns live roster data assembled from wowaudit (roster membership) + Raider.IO
 * (score/ilvl) + Blizzard (gear completion) + Warcraft Logs (perf/deaths/trend), or
 * null if credentials aren't fully configured (or the live fetch fails for any
 * reason) — the renderer falls back to the sample roster in that case
 * (src/data/rosterSource.ts), so the app never shows a broken half-real result.
 *
 * @returns {Promise<{ raiders: object[], fetchedAt: string, heroicBossesKilled: number, realmMismatches: Array<{name: string, wowauditRealm: string, observedRealms: string[]}> } | null>}
 */
async function fetchRoster() {
  if (!isConfigured()) {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    console.log(`[roster] Not fully configured, using sample data. Missing: ${missing.join(', ')}`);
    return null;
  }

  const guild = { name: process.env.GUILD_NAME, realm: process.env.GUILD_REALM, region: process.env.GUILD_REGION };

  try {
    const wowauditRoster = await fetchWowauditRoster();
    const characters = wowauditRoster.map((m) => ({ name: m.name, realm: m.realm }));

    // Two different real people can share a character name across realms
    // (confirmed live this session -- the "Dunbarke" incident: wowaudit had the
    // wrong realm for one of them). RIO and Blizzard gear data are safe either way
    // -- merge.cjs looks those up by charKey(name, realm), realm and all. WCL is
    // the one source that can't be safely disambiguated here: its tables identify
    // players by bare character name with no realm on every row, so if two roster
    // members share a name, there's no reliable way to say which of WCL's rows
    // belongs to which real person. Rather than guess, exclude colliding names from
    // roleByName entirely -- fetchWarcraftLogs only computes performance for names
    // it's given a role for, so both members simply come back with no WCL data and
    // get omitted from the live roster by the existing "no performance data" path
    // in merge.cjs, same as a genuinely unlogged recruit. Safe-but-missing beats
    // silently-wrong.
    const nameCounts = new Map();
    for (const m of wowauditRoster) nameCounts.set(m.name, (nameCounts.get(m.name) ?? 0) + 1);
    const collidingNames = new Set([...nameCounts].filter(([, count]) => count > 1).map(([name]) => name));
    if (collidingNames.size > 0) {
      console.warn(
        `[roster] ${collidingNames.size} character name(s) shared by multiple wowaudit roster entries -- excluding from Warcraft Logs performance (can't safely disambiguate by name alone):`,
        [...collidingNames],
      );
    }
    const roleByName = Object.fromEntries(wowauditRoster.filter((m) => !collidingNames.has(m.name)).map((m) => [m.name, m.role]));

    const [rio, gearCompletion, wcl] = await Promise.all([
      fetchRaiderIO(guild, characters),
      fetchGearCompletion(guild, characters),
      fetchWarcraftLogs(guild, process.env.TIER_ZONE_NAME, roleByName),
    ]);

    const raiders = mergeSources({ wowauditRoster, rio, gearCompletion, wcl: wcl.performance });
    const realmMismatches = findRealmMismatches(wowauditRoster, wcl.observedRealms);
    if (realmMismatches.length > 0) {
      console.warn('[roster] Realm mismatch(es) between wowaudit and Warcraft Logs combat log data:', realmMismatches);
    }
    return { raiders, fetchedAt: new Date().toISOString(), heroicBossesKilled: wcl.heroicBossesKilled, realmMismatches };
  } catch (err) {
    console.error('[roster] Live fetch failed, falling back to sample data:', err);
    return null;
  }
}

module.exports = { fetchRoster, isConfigured };
