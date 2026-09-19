const { getLootRecords } = require('./lootLog.cjs');
const { pollChatLog } = require('./lootChatTail.cjs');
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

  if (!proxyClient.isAvailable()) return local;

  try {
    if (local.records.length > 0 || local.trades.length > 0 || local.needLosses.length > 0) {
      await proxyClient.syncLootRecords(local.records, local.trades, local.needLosses);
    }
    const shared = await proxyClient.getSharedLootRecords();
    const status = shared.records.length > 0 || shared.trades.length > 0 || local.status === 'ok' ? 'ok' : local.status;
    return { records: shared.records, trades: shared.trades, needLosses: shared.needLosses ?? [], status };
  } catch (err) {
    console.error('[lootLog] Proxy sync failed, showing local-only data:', err);
    return local;
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

// Real item links are the |Hitem:...|h[Name]|h|r escape sequence, or (chat-tail's own
// records, which never have one -- see lootChatTail.cjs) a plain "[Name]" string. Same
// extraction every other data source in this pipeline duplicates locally rather than
// sharing (this file has no access to the renderer's lootLogic.ts).
function itemNameFromLink(itemLink) {
  const match = typeof itemLink === 'string' && itemLink.match(/\[(.+)\]/);
  return match ? match[1] : null;
}

// Called on an interval from main.cjs -- tails WoW's live chat log (see
// lootChatTail.cjs) so a Need win reaches the shared loot log within one poll interval
// instead of waiting on the addon's SavedVariables, which only flush to disk on
// /reload. Best-effort filtered against the current tier's loot table to drop obvious
// non-tier trash (recipes/toys/off-tier items the addon's own client-side exclusion list
// would normally catch, but can't be replicated from plain chat text) -- degrades to
// syncing unfiltered if the loot table itself is unavailable, same "never a broken half
// state" philosophy as fetchBossLootTable.cjs itself.
// Returns { status, added } (not just void) so main.cjs can track a running "is this
// actually working" status for the Loot History screen's live-capture card -- see
// lootChatTail.cjs's getChatLogStatus for the file-freshness half of that same signal.
async function syncChatTailCapture() {
  const { status, newRecords } = pollChatLog();
  if (status !== 'ok' || newRecords.length === 0) return { status, added: 0 };

  const lootTable = await getCachedBossLootTable();
  let filtered = newRecords;
  if (lootTable) {
    // chat-tail records never carry a real itemId (the on-disk chat log has no item
    // link, just plain text -- see lootChatTail.cjs) -- resolved by name against this
    // tier's known loot table where possible, purely so an icon and the membership
    // filter below have something to work with immediately, instead of only after the
    // addon's own sync reconciles it. Deliberately NOT used to drop an unresolved
    // record (a name genuinely missing from this table stays in, same as before this
    // resolution existed) -- this table can be incomplete or stale, and silently
    // dropping a real win because of that would be worse than an occasional off-tier
    // item slipping through as "Unverified" for an officer to catch by eye.
    const idByName = new Map(Object.entries(lootTable.items).map(([id, item]) => [item.name, Number(id)]));
    filtered = newRecords.map((r) => {
      if (r.itemId != null) return r;
      const resolvedId = idByName.get(itemNameFromLink(r.itemLink));
      return resolvedId != null ? { ...r, itemId: resolvedId } : r;
    });
  }
  if (filtered.length === 0) return { status, added: 0 };

  if (proxyClient.isAvailable()) {
    await proxyClient.syncLootRecords(filtered, [], []);
  } else {
    lootRecordsStore.sync(filtered, [], []);
  }
  return { status, added: filtered.length };
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

async function deleteLootNight(startTime, endTime) {
  if (proxyClient.isAvailable()) return proxyClient.deleteLootNight(startTime, endTime);
  return lootRecordsStore.deleteNight(startTime, endTime);
}

module.exports = { fetchLootLog, addManualLootRecord, updateLootRecord, removeLootRecord, removeLootTrade, deleteLootNight, syncChatTailCapture };
