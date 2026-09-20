const { getLootRecords, getAddonDataStamp } = require('./lootLog.cjs');
const { pollChatLog } = require('./lootChatTail.cjs');
const { pollCombatLog, recentKills } = require('./lootCombatLog.cjs');
const { enrichWin } = require('./lootLiveEnrich.cjs');
const { fetchBossLootTable } = require('./fetchBossLootTable.cjs');
const proxyClient = require('./proxyClient.cjs');
const lootRecordsStore = require('./lootRecordsStore.cjs');
const pipelineLog = require('./pipelineLog.cjs');

// What this PC's addon data looked like the last time it was offered to the shared store, so the
// diary notes a CHANGE (a /reload flushed new wins) rather than repeating itself every sync.
let lastAddonCounts = null;

// Local capture (this PC's addon, if any) always happens first, then -- when the
// proxy is configured -- gets pushed up to the shared store (a harmless no-op if
// there's nothing new; the server dedupes) and the shared, officer-wide view is what
// actually gets shown. Local dev / no-proxy builds fall back to local-only, same
// branch-don't-rewrite pattern as everything else in this pipeline.
async function offerAddonData(local) {
  if (local.records.length === 0 && local.trades.length === 0 && local.needLosses.length === 0) return;
  await proxyClient.syncLootRecords(local.records, local.trades, local.needLosses);
  const counts = `${local.records.length}/${local.trades.length}/${local.needLosses.length}`;
  if (counts !== lastAddonCounts) {
    lastAddonCounts = counts;
    pipelineLog.record('addon-sync', `Addon data offered to the store: ${local.records.length} win(s), ${local.needLosses.length} lost roll(s), ${local.trades.length} trade(s)`, { records: local.records.length, needLosses: local.needLosses.length, trades: local.trades.length });
  }
}

// The addon's SavedVariables file is written only at /reload or logout. This is called from the app's 10-second background
// tick and does nothing until that file's timestamp moves, then offers the addon's data to the store right away (so a
// win reaches Discord within one tick of the reload) -- previously that only happened when someone opened Loot History.
// Same push fetchLootLog does, and the server dedupes, so it is safe to repeat.
let lastAddonStamp = null;
async function syncAddonDataIfChanged() {
  const stamp = getAddonDataStamp();
  if (stamp === null || stamp === lastAddonStamp) return { synced: false };
  const local = getLootRecords();
  if (local.status !== 'ok') return { synced: false };
  if (proxyClient.isAvailable()) await offerAddonData(local);
  else lootRecordsStore.sync(local.records, local.trades, local.needLosses);
  // Only remembered once the push worked, so a failed attempt is retried on the next tick.
  lastAddonStamp = stamp;
  return { synced: true, records: local.records.length };
}

async function fetchLootLog() {
  const local = getLootRecords();

  if (!proxyClient.isAvailable()) return local;

  try {
    await offerAddonData(local);
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
  // Every tick, not just when a win shows up: keeps "which boss died last" current and the
  // Loot History status card honest, and each poll only reads the bytes appended since.
  pollCombatLog();
  const { status, newRecords } = pollChatLog();
  if (status !== 'ok' || newRecords.length === 0) return { status, added: 0 };

  const lootTable = await getCachedBossLootTable();
  // Which boss just died (from the combat log, if this PC is running one) + the tier's
  // loot table lets a win be given its item, slot, boss and difficulty right now -- see
  // lootLiveEnrich.cjs. That's what lets auto-post announce it without a /reload. Never
  // used to DROP a record: a win that can't be attributed (no combat log, an item not in
  // the table, no matching kill) stays in as an unverified chat-tail capture and waits
  // for the addon's authoritative sync, same as before.
  const kills = recentKills(Date.now());
  const filtered = newRecords.map((r) => enrichWin(r, { lootTable, kills }));
  if (filtered.length === 0) return { status, added: 0 };
  for (const r of filtered) {
    const attributed = r.source === 'live' && r.boss != null;
    pipelineLog.record(
      'enrich',
      attributed ? `Attributed live: ${r.winner} -> ${r.boss}${r.difficulty ? ` (${r.difficulty})` : ''}` : `Left unattributed: ${r.winner}'s win (no boss/difficulty could be worked out yet)`,
      { winner: r.winner, attributed, boss: r.boss ?? null, difficulty: r.difficulty ?? null },
    );
  }

  if (proxyClient.isAvailable()) {
    await proxyClient.syncLootRecords(filtered, [], []);
  } else {
    lootRecordsStore.sync(filtered, [], []);
  }
  pipelineLog.record('store-sync', `Pushed ${filtered.length} live win(s) to the loot store`, { count: filtered.length });
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

module.exports = { fetchLootLog, syncAddonDataIfChanged, addManualLootRecord, updateLootRecord, removeLootRecord, removeLootTrade, deleteLootNight, syncChatTailCapture };
