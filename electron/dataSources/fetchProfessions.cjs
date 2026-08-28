const { fetchActiveMembersWithProfessions } = require('./professions.cjs');
const cache = require('./professionsCache.cjs');
const proxyClient = require('./proxyClient.cjs');

const REQUIRED_ENV = ['GUILD_NAME', 'GUILD_REALM', 'GUILD_REGION', 'BNET_CLIENT_ID', 'BNET_CLIENT_SECRET'];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/**
 * @returns {{ members: object[], fetchedAt: string } | null}
 */
function getCachedProfessions() {
  if (proxyClient.isAvailable()) return proxyClient.getCachedProfessions();
  return cache.load();
}

/**
 * @param {(progress: { phase: 'activity'|'professions', done: number, total: number }) => void} [onProgress]
 * @returns {Promise<{ members: object[], fetchedAt: string } | null>}
 */
async function fetchProfessions(onProgress) {
  if (proxyClient.isAvailable()) {
    try {
      return await proxyClient.fetchProfessions(onProgress);
    } catch (err) {
      console.error('[professions] Proxy fetch failed:', err);
      return proxyClient.getCachedProfessions().catch(() => null);
    }
  }

  if (!isConfigured()) {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    console.log(`[professions] Not fully configured, using sample data. Missing: ${missing.join(', ')}`);
    return null;
  }

  const guild = { name: process.env.GUILD_NAME, realm: process.env.GUILD_REALM, region: process.env.GUILD_REGION };

  try {
    const members = await fetchActiveMembersWithProfessions(guild, onProgress);
    const result = { members, fetchedAt: new Date().toISOString() };
    cache.save(result);
    return result;
  } catch (err) {
    console.error('[professions] Live fetch failed:', err);
    // Prefer a stale-but-real cached scan over sample data if we have one.
    return cache.load();
  }
}

module.exports = { fetchProfessions, getCachedProfessions, isConfigured };
