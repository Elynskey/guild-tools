const { getLootRecords } = require('./lootLog.cjs');
const proxyClient = require('./proxyClient.cjs');

// Local capture (this PC's addon, if any) always happens first, then -- when the
// proxy is configured -- gets pushed up to the shared store (a harmless no-op if
// there's nothing new; the server dedupes) and the shared, officer-wide view is what
// actually gets shown. Local dev / no-proxy builds fall back to local-only, same
// branch-don't-rewrite pattern as everything else in this pipeline.
async function fetchLootLog() {
  const local = getLootRecords();

  if (!proxyClient.isAvailable()) return local;

  try {
    if (local.records.length > 0 || local.trades.length > 0) {
      await proxyClient.syncLootRecords(local.records, local.trades);
    }
    const shared = await proxyClient.getSharedLootRecords();
    const status = shared.records.length > 0 || shared.trades.length > 0 || local.status === 'ok' ? 'ok' : local.status;
    return { records: shared.records, trades: shared.trades, status };
  } catch (err) {
    console.error('[lootLog] Proxy sync failed, showing local-only data:', err);
    return local;
  }
}

module.exports = { fetchLootLog };
