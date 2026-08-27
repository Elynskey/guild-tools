const { fetchActiveMembersWithProfessions } = require('./professions.cjs');

const REQUIRED_ENV = ['GUILD_NAME', 'GUILD_REALM', 'GUILD_REGION', 'BNET_CLIENT_ID', 'BNET_CLIENT_SECRET'];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/**
 * @returns {Promise<{ members: object[], fetchedAt: string } | null>}
 */
async function fetchProfessions() {
  if (!isConfigured()) {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    console.log(`[professions] Not fully configured, using sample data. Missing: ${missing.join(', ')}`);
    return null;
  }

  const guild = { name: process.env.GUILD_NAME, realm: process.env.GUILD_REALM, region: process.env.GUILD_REGION };

  try {
    const members = await fetchActiveMembersWithProfessions(guild);
    return { members, fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[professions] Live fetch failed, falling back to sample data:', err);
    return null;
  }
}

module.exports = { fetchProfessions, isConfigured };
