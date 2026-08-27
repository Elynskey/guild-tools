const { fetchRecipeCatalogue: fetchFromBlizzard } = require('./recipeCatalogue.cjs');
const cache = require('./recipeCatalogueCache.cjs');

const REQUIRED_ENV = ['GUILD_REGION', 'BNET_CLIENT_ID', 'BNET_CLIENT_SECRET'];

function isConfigured() {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

/** @returns {{ catalogue: object, fetchedAt: string } | null} */
function getCachedRecipeCatalogue() {
  return cache.load();
}

/**
 * Serves the disk cache when it's fresh; only hits Blizzard's API (a ~150+ request pull)
 * when the cache is missing or older than the 7-day TTL.
 * @returns {Promise<{ catalogue: object, fetchedAt: string } | null>}
 */
async function fetchRecipeCatalogue() {
  const cached = cache.load();
  if (!cache.isStale(cached)) return cached;

  if (!isConfigured()) {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
    console.log(`[recipeCatalogue] Not fully configured, skipping. Missing: ${missing.join(', ')}`);
    return cached; // stale-but-real beats nothing
  }

  try {
    const catalogue = await fetchFromBlizzard(process.env.GUILD_REGION);
    const result = { catalogue, fetchedAt: new Date().toISOString() };
    cache.save(result);
    return result;
  } catch (err) {
    console.error('[recipeCatalogue] Live fetch failed:', err);
    return cached;
  }
}

module.exports = { fetchRecipeCatalogue, getCachedRecipeCatalogue };
