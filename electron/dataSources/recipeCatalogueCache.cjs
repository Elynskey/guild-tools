const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

// Recipe existence barely changes outside an expansion patch, and a full catalogue pull is
// ~150+ Blizzard requests (11 professions x several skill tiers each, two calls per tier) --
// cache aggressively (unlike professionsCache.cjs's "refetch whenever asked" roster cache)
// and only refetch when this is missing or stale.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function storePath() {
  return path.join(app.getPath('userData'), 'recipe-catalogue-cache.json');
}

/** @returns {{ catalogue: object, fetchedAt: string } | null} */
function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return null;
  }
}

function isStale(result) {
  if (!result) return true;
  return Date.now() - new Date(result.fetchedAt).getTime() > TTL_MS;
}

function save(result) {
  fs.writeFileSync(storePath(), JSON.stringify(result, null, 2));
}

module.exports = { load, save, isStale };
