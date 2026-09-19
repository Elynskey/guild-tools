// Keeps the guild's professions data fresh on its own: the proxy re-scans once an hour, so
// the Professions screen (which paints from the proxy's cache) no longer depends on an
// officer remembering to press Refresh. Runs only inside the proxy server process --
// the Electron app never starts it.
//
// A full scan is ~2000 Battle.net requests over several minutes, so this is deliberately
// gentle:
//   - it wakes every few minutes but only scans when the data is a full hour old, judged
//     from the cache's own timestamp -- so a service restart doesn't trigger a scan, and a
//     scan an officer just triggered by hand counts as this hour's sync;
//   - it never overlaps a scan that is already running (manual or its own);
//   - a failed attempt is not retried until the next hour, and the previous data is kept
//     (fetchProfessions only overwrites the cache on success).

const HOUR_MS = 60 * 60 * 1000;
const CHECK_MS = 5 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 60 * 1000;

/**
 * @param {object} deps
 * @param {() => string | null | undefined} deps.getLastFetchedAt ISO timestamp of the cached scan, if any
 * @param {() => Promise<unknown>} deps.scan runs one full scan (saves the cache itself on success)
 * @param {() => boolean} deps.isScanning true while any scan is in flight
 * @param {number} [deps.intervalMs]
 * @param {() => number} [deps.now]
 * @param {{ log: Function, error: Function }} [deps.logger]
 */
function createProfessionsSync({ getLastFetchedAt, scan, isScanning, intervalMs = HOUR_MS, now = Date.now, logger = console }) {
  let lastAttemptAt = 0;

  /** @returns {Promise<'busy' | 'fresh' | 'synced' | 'failed'>} */
  async function tick() {
    if (isScanning()) return 'busy';
    const lastFetchedAt = Date.parse(getLastFetchedAt() ?? '') || 0;
    if (now() - Math.max(lastFetchedAt, lastAttemptAt) < intervalMs) return 'fresh';

    lastAttemptAt = now();
    logger.log('[professionsSync] Hourly professions sync starting');
    try {
      await scan();
    } catch (err) {
      logger.error('[professionsSync] Scan threw:', err);
      return 'failed';
    }
    // fetchProfessions swallows its own errors and hands back the old cache, so "did the
    // cache's timestamp move" is the honest test of whether this scan actually landed.
    const after = Date.parse(getLastFetchedAt() ?? '') || 0;
    if (after > lastFetchedAt) {
      logger.log('[professionsSync] Professions synced');
      return 'synced';
    }
    logger.error('[professionsSync] Scan did not update the cache; keeping the previous data, next try in an hour');
    return 'failed';
  }

  function start({ checkMs = CHECK_MS, firstCheckDelayMs = FIRST_CHECK_DELAY_MS } = {}) {
    const first = setTimeout(() => void tick(), firstCheckDelayMs);
    const every = setInterval(() => void tick(), checkMs);
    first.unref?.();
    every.unref?.();
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }

  return { tick, start };
}

module.exports = { createProfessionsSync, HOUR_MS };
