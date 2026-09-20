const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Server-side cache in front of the roster fetch. Every officer opening Raider Status used to
// trigger a full pull from wowaudit, Raider.IO, Blizzard and Warcraft Logs, so a handful of
// officers opening the app at once (raid night, right after an update) blew through Warcraft
// Logs' rate limit -- the fetch failed with a 429, fetchRoster() returned null, and the app
// silently fell back to SAMPLE data (fake raiders). This makes that stop:
//   - a result younger than TTL_MS is served straight from memory (no upstream calls),
//   - requests that arrive while a fetch is running share that one fetch instead of adding more,
//   - a failed fetch (fetchRoster returns null, or throws) serves the last good roster instead of
//     nothing, and is not retried for RETRY_AFTER_FAILURE_MS so a rate limit gets room to clear,
//   - the last good roster is kept on disk, so a proxy restart during a rate limit still has
//     something real to serve.
// Only a roster that has never been fetched successfully (a brand-new server) can still come back
// null, which is the honest "no live data" answer the app already handles.

const TTL_MS = 5 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
/** A roster older than this is too stale to prefer over "no live data" (a week of game progress out of date). */
const MAX_STALE_MS = 12 * 60 * 60 * 1000;

function fileStore() {
  const file = () => path.join(resolveDataDir(), 'roster-cache.json');
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(file(), 'utf8'));
      } catch {
        return null;
      }
    },
    save(entry) {
      try {
        fs.writeFileSync(file(), JSON.stringify(entry));
      } catch (err) {
        console.error('[rosterCache] Could not persist the roster (non-fatal):', err);
      }
    },
  };
}

/**
 * @param {object} deps
 * @param {() => Promise<object | null>} deps.fetchRoster the real fetch; null or a throw means it failed
 * @param {{load: () => ({value: object, at: number} | null), save: (e: {value: object, at: number}) => void}} [deps.store]
 * @param {() => number} [deps.now]
 * @param {{log: Function, error: Function}} [deps.logger]
 */
function createRosterCache({ fetchRoster, store = fileStore(), now = Date.now, logger = console, ttlMs = TTL_MS, retryAfterFailureMs = RETRY_AFTER_FAILURE_MS, maxStaleMs = MAX_STALE_MS }) {
  let cache = null; // { value, at }
  let loaded = false;
  let inflight = null;
  let lastFailureAt = null;

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    const stored = store.load();
    if (stored && stored.value && Number.isFinite(stored.at)) cache = stored;
  }

  const fresh = () => cache !== null && now() - cache.at < ttlMs;
  const usableStale = () => cache !== null && now() - cache.at < maxStaleMs;

  async function refresh() {
    let value = null;
    try {
      value = await fetchRoster();
    } catch (err) {
      logger.error('[rosterCache] Roster fetch threw:', err);
    }
    if (value) {
      cache = { value, at: now() };
      lastFailureAt = null;
      store.save(cache);
      return value;
    }
    lastFailureAt = now();
    if (usableStale()) {
      logger.log(`[rosterCache] Live roster fetch failed; serving the roster from ${Math.round((now() - cache.at) / 1000)}s ago instead of sample data.`);
      return cache.value;
    }
    return null;
  }

  /** @returns {Promise<object | null>} */
  async function get() {
    ensureLoaded();
    if (fresh()) return cache.value;
    if (inflight) return inflight;
    // Recently failed: don't hammer the upstream that just refused us -- serve what we have.
    if (lastFailureAt !== null && now() - lastFailureAt < retryAfterFailureMs) {
      return usableStale() ? cache.value : null;
    }
    inflight = refresh().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  return { get };
}

module.exports = { createRosterCache, TTL_MS, RETRY_AFTER_FAILURE_MS, MAX_STALE_MS };
