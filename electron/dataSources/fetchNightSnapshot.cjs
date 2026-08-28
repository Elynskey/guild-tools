const { fetchWowauditRoster } = require('./wowaudit.cjs');
const { fetchNightSnapshot } = require('./warcraftlogs.cjs');

const REQUIRED_ENV = ['WCL_CLIENT_ID', 'WCL_CLIENT_SECRET', 'WOWAUDIT_API_KEY', 'MIN_DPS_REQUIREMENT'];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/** @returns {Promise<Record<string, object> | null>} null if unconfigured or the fetch fails -- renderer keeps whatever night stats it already has. */
async function fetchNightSnapshotForCode(code) {
  if (!isConfigured() || typeof code !== 'string') return null;
  try {
    const wowauditRoster = await fetchWowauditRoster();
    const roleByName = Object.fromEntries(wowauditRoster.map((m) => [m.name, m.role]));
    return await fetchNightSnapshot(code, roleByName);
  } catch (err) {
    console.error('[nightSnapshot] Failed to fetch:', err);
    return null;
  }
}

module.exports = { fetchNightSnapshotForCode, isConfigured };
