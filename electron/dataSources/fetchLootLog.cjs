const { getLootRecords } = require('./lootLog.cjs');
const { getChatLogStatus, pollChatLog } = require('./lootChatTail.cjs');
const { fetchBossLootTable } = require('./fetchBossLootTable.cjs');
const proxyClient = require('./proxyClient.cjs');
const lootRecordsStore = require('./lootRecordsStore.cjs');

// Local capture (this PC's addon, if any) always happens first, then -- when the
// proxy is configured -- gets pushed up to the shared store (a harmless no-op if
// there's nothing new; the server dedupes) and the shared, officer-wide view is what
// actually gets shown. Local dev / no-proxy builds fall back to local-only, same
// branch-don't-rewrite pattern as everything else in this pipeline.
async function fetchLootLog() {
  const local = getLootRecords();
  const chatLogActive = getChatLogStatus().active;

  if (!proxyClient.isAvailable()) return { ...local, chatLogActive };

  try {
    if (local.records.length > 0 || local.trades.length > 0 || local.needLosses.length > 0) {
      await proxyClient.syncLootRecords(local.records, local.trades, local.needLosses);
    }
    const shared = await proxyClient.getSharedLootRecords();
    const status = shared.records.length > 0 || shared.trades.length > 0 || local.status === 'ok' ? 'ok' : local.status;
    return { records: shared.records, trades: shared.trades, needLosses: shared.needLosses ?? [], status, chatLogActive };
  } catch (err) {
    console.error('[lootLog] Proxy sync failed, showing local-only data:', err);
    return { ...local, chatLogActive };
  }
}

// Cache the loot table briefly rather than re-fetching on every 10s tick -- a fetch only
// ever actually happens on a tick that found a new chat-tail win in the first place (see
// syncChatTailCapture), so in practice this is already low-frequency; the TTL just covers
// a burst of several wins landing close together during the same pull.
const LOOT_TABLE_CACHE_MS = 15 * 60 * 1000;
let cachedLootTable = null;
let cachedLootTableAt = 0;

async function getCachedBossLootTable() {
  if (cachedLootTable && Date.now() - cachedLootTableAt < LOOT_TABLE_CACHE_MS) return cachedLootTable;
  const table = await fetchBossLootTable();
  if (table) {
    cachedLootTable = table;
    cachedLootTableAt = Date.now();
  }
  return table ?? cachedLootTable;
}

// Called on an interval from main.cjs -- tails WoW's live chat log (see
// lootChatTail.cjs) so a Need win reaches the shared loot log within one poll interval
// instead of waiting on the addon's SavedVariables, which only flush to disk on
// /reload. Best-effort filtered against the current tier's loot table to drop obvious
// non-tier trash (recipes/toys/off-tier items the addon's own client-side exclusion list
// would normally catch, but can't be replicated from plain chat text) -- degrades to
// syncing unfiltered if the loot table itself is unavailable, same "never a broken half
// state" philosophy as fetchBossLootTable.cjs itself.
async function syncChatTailCapture() {
  const { status, newRecords } = pollChatLog();
  if (status !== 'ok' || newRecords.length === 0) return;

  const lootTable = await getCachedBossLootTable();
  const filtered = lootTable ? newRecords.filter((r) => r.itemId == null || r.itemId in lootTable.items) : newRecords;
  if (filtered.length === 0) return;

  if (proxyClient.isAvailable()) {
    await proxyClient.syncLootRecords(filtered, [], []);
  } else {
    lootRecordsStore.sync(filtered, [], []);
  }
}

// Officer edits/corrections -- always go through the proxy when available (this is
// shared, officer-wide data, same as craft requests), falling back to the local store
// only for dev-without-proxy.
async function addManualLootRecord(record) {
  if (proxyClient.isAvailable()) return proxyClient.addManualLootRecord(record);
  return lootRecordsStore.manualAdd(record);
}

async function updateLootRecord(id, patch) {
  if (proxyClient.isAvailable()) return proxyClient.updateLootRecord(id, patch);
  return lootRecordsStore.update(id, patch);
}

async function removeLootRecord(id) {
  if (proxyClient.isAvailable()) return proxyClient.removeLootRecord(id);
  return lootRecordsStore.remove(id);
}

async function removeLootTrade(id) {
  if (proxyClient.isAvailable()) return proxyClient.removeLootTrade(id);
  return lootRecordsStore.removeTrade(id);
}

module.exports = { fetchLootLog, addManualLootRecord, updateLootRecord, removeLootRecord, removeLootTrade, syncChatTailCapture };
