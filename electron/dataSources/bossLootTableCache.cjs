const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Loot tables barely change mid-tier -- same "cache aggressively, refetch rarely"
// rationale as recipeCatalogueCache.cjs, same TTL.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function storePath() {
  return path.join(resolveDataDir(), 'boss-loot-table-cache.json');
}

/** @returns {{ bosses: object[], lootByBoss: object, items: object, instanceIds: number[], fetchedAt: string } | null} */
function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return null;
  }
}

/** Stale on the usual TTL, or immediately if the tier's raid instance IDs changed (a
 * new tier rotated in) since this cache was built -- no point serving last tier's loot
 * tables just because they're still under a week old. */
function isStale(result, currentInstanceIds) {
  if (!result) return true;
  if (Date.now() - new Date(result.fetchedAt).getTime() > TTL_MS) return true;
  const cached = result.instanceIds ?? [];
  return cached.length !== currentInstanceIds.length || !currentInstanceIds.every((id) => cached.includes(id));
}

function save(result) {
  fs.writeFileSync(storePath(), JSON.stringify(result, null, 2));
}

module.exports = { load, save, isStale };
