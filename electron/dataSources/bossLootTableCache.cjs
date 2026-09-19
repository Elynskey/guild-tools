const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Loot tables barely change mid-tier -- same "cache aggressively, refetch rarely"
// rationale as recipeCatalogueCache.cjs, same TTL.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
// A table with item details missing (a lookup failed) is retried far sooner than a healthy
// one -- but not on every request, so a persistent failure can't turn into a fetch storm.
const INCOMPLETE_RETRY_MS = 10 * 60 * 1000;

function storePath() {
  return path.join(resolveDataDir(), 'boss-loot-table-cache.json');
}

/** Tables cached before the slot vocabulary was unified still say "Non-equippable" -- fixed on read so no consumer ever sees it (see bossLootTable.cjs's normalizeSlot). */
function normalizeSlots(table) {
  if (!table?.items) return table;
  const items = {};
  for (const [id, item] of Object.entries(table.items)) items[id] = item.slot === 'Non-equippable' ? { ...item, slot: 'Other' } : item;
  return { ...table, items };
}

/** @returns {{ bosses: object[], lootByBoss: object, items: object, instanceIds: number[], fetchedAt: string } | null} */
function load() {
  try {
    return normalizeSlots(JSON.parse(fs.readFileSync(storePath(), 'utf8')));
  } catch {
    return null;
  }
}

/** Item ids a boss's loot list names that have no details in `items` -- computed from the data itself, so it also catches tables cached before missingItemIds existed (the 2026-09-19 one was missing 43). */
function missingItemIds(result) {
  const missing = new Set();
  for (const ids of Object.values(result?.lootByBoss ?? {})) for (const id of ids) if (!result.items?.[id]) missing.add(id);
  return [...missing];
}

/** Fills item details an incomplete rebuild couldn't fetch from the previous table, where that had them -- a rebuild must never be worse than what was already cached. */
function fillGapsFrom(result, previous) {
  if (!previous?.items) return result;
  const items = { ...result.items };
  for (const id of missingItemIds(result)) if (previous.items[id]) items[id] = previous.items[id];
  const filled = { ...result, items };
  return { ...filled, missingItemIds: missingItemIds(filled) };
}

/** Stale on the usual TTL, or immediately if the tier's raid instance IDs changed (a
 * new tier rotated in) since this cache was built -- no point serving last tier's loot
 * tables just because they're still under a week old. An INCOMPLETE table (item details
 * missing) goes stale after 10 minutes instead of a week, so a rate-limited build heals
 * itself rather than being served for days. */
function isStale(result, currentInstanceIds) {
  if (!result) return true;
  const age = Date.now() - new Date(result.fetchedAt).getTime();
  if (age > TTL_MS) return true;
  if (age > INCOMPLETE_RETRY_MS && missingItemIds(result).length > 0) return true;
  const cached = result.instanceIds ?? [];
  return cached.length !== currentInstanceIds.length || !currentInstanceIds.every((id) => cached.includes(id));
}

function save(result) {
  fs.writeFileSync(storePath(), JSON.stringify(result, null, 2));
}

module.exports = { load, save, isStale, missingItemIds, fillGapsFrom, normalizeSlots, INCOMPLETE_RETRY_MS };
