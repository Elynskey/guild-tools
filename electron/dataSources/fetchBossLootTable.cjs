const { fetchBossLootTable: fetchFromBlizzard, INSTANCE_IDS } = require('./bossLootTable.cjs');
const cache = require('./bossLootTableCache.cjs');
const proxyClient = require('./proxyClient.cjs');

const REQUIRED_ENV = ['GUILD_REGION', 'BNET_CLIENT_ID', 'BNET_CLIENT_SECRET'];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/**
 * Serves the disk cache when it's fresh (see bossLootTableCache.cjs); only hits
 * Blizzard's Journal/Item APIs when the cache is missing, stale, or from a rotated-out
 * tier. Returns null (not a throw) when unconfigured or the live fetch fails and there's
 * no cache to fall back to -- the add-entry dialog degrades to plain text fields in that
 * case, same "never a broken half state" pattern as everything else in this pipeline.
 * @returns {Promise<{ bosses: object[], lootByBoss: object, items: object, fetchedAt: string } | null>}
 */
async function fetchBossLootTable() {
  if (proxyClient.isAvailable()) {
    try {
      return await proxyClient.getBossLootTable();
    } catch (err) {
      console.error('[bossLootTable] Proxy fetch failed:', err);
      return null;
    }
  }

  const cached = cache.load();
  if (!cache.isStale(cached, INSTANCE_IDS)) return cached;

  if (!isConfigured()) {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    console.log(`[bossLootTable] Not fully configured, skipping. Missing: ${missing.join(', ')}`);
    return cached; // stale-but-real beats nothing
  }

  try {
    const result = await fetchFromBlizzard(process.env.GUILD_REGION);
    cache.save(result);
    return result;
  } catch (err) {
    console.error('[bossLootTable] Live fetch failed:', err);
    return cached;
  }
}

module.exports = { fetchBossLootTable };
