const { fetchWowauditRoster } = require('./wowaudit.cjs');
const { fetchRaidNights, fetchPullBreakdown } = require('./warcraftlogs.cjs');

// Same required env as fetchRoster.cjs's live pipeline, minus the pieces (Raider.IO,
// Blizzard gear) this feature doesn't touch -- it's Warcraft Logs + wowaudit's role
// map only.
const REQUIRED_ENV = ['GUILD_NAME', 'GUILD_REALM', 'GUILD_REGION', 'WCL_CLIENT_ID', 'WCL_CLIENT_SECRET', 'WOWAUDIT_API_KEY', 'TIER_ZONE_NAME'];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/** @returns {Promise<{ code: string, date: string }[] | null>} null if unconfigured or the fetch fails -- renderer falls back to sample nights. */
async function fetchRaidNightsList() {
  if (!isConfigured()) return null;
  try {
    const guild = { name: process.env.GUILD_NAME, realm: process.env.GUILD_REALM, region: process.env.GUILD_REGION };
    return await fetchRaidNights(guild, process.env.TIER_ZONE_NAME);
  } catch (err) {
    console.error('[pullFeedback] Failed to list raid nights:', err);
    return null;
  }
}

/** @returns {Promise<{ pulls: object[] } | null>} null if unconfigured or the fetch fails -- renderer falls back to sample pulls. */
async function fetchPullFeedback(code) {
  if (!isConfigured() || typeof code !== 'string') return null;
  try {
    const wowauditRoster = await fetchWowauditRoster();
    const roleByName = Object.fromEntries(wowauditRoster.map((m) => [m.name, m.role]));
    return await fetchPullBreakdown(code, roleByName);
  } catch (err) {
    console.error('[pullFeedback] Failed to fetch pull breakdown:', err);
    return null;
  }
}

module.exports = { fetchRaidNightsList, fetchPullFeedback, isConfigured };
