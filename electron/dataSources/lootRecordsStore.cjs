const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');

// The shared, officer-wide loot log -- runs on the API proxy server. Same JSON-file
// pattern as craftRequestsStore.cjs. Multiple officers' PCs can each have the
// GuildToolsLoot addon running during the same raid (Group Loot broadcasts every Need
// win to the whole raid, so more than one addon instance sees the exact same roll), and
// even a single client's addon can observe one win through two independent capture
// paths -- sync() dedupes on that overlap (see isSyncDuplicate) rather than creating
// duplicate entries.
//
// Every record gets an `id` assigned here (not by the addon) so officers can edit or
// remove individual entries in the app when neither capture path in the addon caught
// something correctly. manualAdd()/update()/remove() exist for exactly that -- a
// correction tool, not a replacement for the addon's automatic capture.

function storePath() {
  return path.join(resolveDataDir(), 'loot-records.json');
}

function save(db) {
  fs.writeFileSync(storePath(), JSON.stringify(db, null, 2));
}

// Records/trades synced before `id` existed (everything synced before this feature
// shipped) need one backfilled so they're editable/removable too -- not just newly-added
// ones. Self-heals on first read rather than a one-off migration script, and persists
// the assigned ids immediately so this only ever runs once per record.
function load() {
  let db;
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    db = { records: parsed.records ?? [], trades: parsed.trades ?? [], needLosses: parsed.needLosses ?? [], removedKeys: parsed.removedKeys ?? [] };
  } catch {
    return { records: [], trades: [], needLosses: [], removedKeys: [] };
  }

  let backfilled = false;
  for (const r of db.records) {
    if (!r.id) {
      r.id = crypto.randomUUID();
      backfilled = true;
    }
  }
  for (const t of db.trades) {
    if (!t.id) {
      t.id = crypto.randomUUID();
      backfilled = true;
    }
  }
  if (backfilled) save(db);

  return db;
}

const recordKey = (r) => `${r.itemId}::${r.winner}::${r.time}`;
const tradeKey = (t) => `${t.itemId}::${t.from}::${t.to}::${t.time}`;
const needLossKey = (r) => `${r.itemId}::${r.name}::${r.time}`;

/**
 * Merges newly-submitted records/trades into the shared store, deduped. Returns the full
 * merged store plus which of the incoming records/trades were genuinely new (addedRecords/
 * addedTrades) -- callers that want to announce new loot (e.g. the Discord posting route)
 * need that distinction so multiple officers syncing the same raid night never double-post.
 *
 * Records go through isSyncDuplicate (below) rather than an exact-key match -- confirmed
 * live 2026-09-06: the addon's two independent capture paths (C_LootHistory and
 * CHAT_MSG_LOOT) both fire for the same real Need win, landing a second or two apart, so
 * an exact `time` match let 7 duplicate pairs from one raid night silently double-post to
 * Discord (same itemId+winner, time off by exactly 1). A tolerant match closes that gap
 * without risking a false merge of two genuinely separate wins later the same night.
 *
 * Trades/needLosses still dedupe on an exact key -- multiple addon instances observing the
 * same broadcasted event is a records-only concern (trades and need-losses aren't captured
 * redundantly the same way).
 *
 * Also skips anything matching a removedKeys entry -- an officer deleting a record/trade
 * in the app must stay deleted even though the addon's own local SavedVariables still has
 * it and will keep offering it up on every future sync from that same client (confirmed
 * live: deleting the Hexing Spiritrender trade only removed it from the shared store, and
 * the very next sync from the client that originally captured it silently re-added it).
 *
 * needLosses (Need rolls that did NOT win) merge the same way but have no id/removedKeys
 * handling -- there's no edit/remove UI for them (see recordNeedLoss in the addon), so
 * nothing can ever tombstone one.
 */
function sync(newRecords, newTrades, newNeedLosses) {
  const db = load();
  const tradeKeys = new Set(db.trades.map(tradeKey));
  const needLossKeys = new Set(db.needLosses.map(needLossKey));
  const removed = new Set(db.removedKeys);
  const addedRecords = [];
  const addedTrades = [];
  const addedNeedLosses = [];

  for (const r of newRecords ?? []) {
    if (removed.has(recordKey(r))) continue;
    if (isSyncDuplicate(db.records, r)) continue;
    const withId = { id: crypto.randomUUID(), ...r };
    db.records.push(withId);
    addedRecords.push(withId);
  }
  for (const t of newTrades ?? []) {
    const k = tradeKey(t);
    if (!tradeKeys.has(k) && !removed.has(k)) {
      const withId = { id: crypto.randomUUID(), ...t };
      db.trades.push(withId);
      tradeKeys.add(k);
      addedTrades.push(withId);
    }
  }
  for (const r of newNeedLosses ?? []) {
    const k = needLossKey(r);
    if (!needLossKeys.has(k)) {
      db.needLosses.push(r);
      needLossKeys.add(k);
      addedNeedLosses.push(r);
    }
  }

  save(db);
  return { records: db.records, trades: db.trades, needLosses: db.needLosses, addedRecords, addedTrades, addedNeedLosses };
}

// Real item links are the |Hitem:...|h[Name]|h|r escape sequence -- same extraction
// LootLogTable/formatLootAnnouncement use, duplicated here rather than shared since
// this file has no access to the renderer's lootLogic.ts.
function extractItemName(itemLink) {
  const match = typeof itemLink === 'string' && itemLink.match(/\[(.+)\]/);
  return match ? match[1] : itemLink;
}

// Confirmed live 2026-09-05: an officer manually logged a win the addon had ALREADY
// captured (unaware it had synced), producing a second record for the same win --
// itemId null (no icon) since manualAdd never has a real item link to draw one from,
// alongside the addon's own correctly-iconed copy. Same 6-hour window as the addon's
// own recordNeedWin dedup / this app's same-raid-night grouping (groupLootByNight) --
// generous enough to catch "this was already logged earlier tonight" without
// flagging a genuinely new win of the same item on a later night.
const DUPLICATE_WINDOW_SECONDS = 6 * 60 * 60;

// Two capture paths (or two officers' addon instances) observing the exact same
// broadcasted roll should always land within a couple seconds of each other -- never
// hours apart -- so this stays far shorter than DUPLICATE_WINDOW_SECONDS specifically
// so sync() can dedupe automatically, with no officer confirmation, without risking
// silently dropping a genuinely separate later win of the same item by the same person.
// A manually-added placeholder record (itemId null, bracket-only itemLink) uses the
// full window instead, same as manualAdd's own guard -- there's no telling how long
// after a live manual entry the addon's real sync will actually run.
const SYNC_DUPLICATE_WINDOW_SECONDS = 60;

function isSyncDuplicate(existingRecords, candidate) {
  const candidateName = extractItemName(candidate.itemLink)?.toLowerCase();
  return existingRecords.some((r) => {
    if (r.winner.toLowerCase() !== candidate.winner.toLowerCase()) return false;
    if (extractItemName(r.itemLink)?.toLowerCase() !== candidateName) return false;
    const window = r.itemId == null || candidate.itemId == null ? DUPLICATE_WINDOW_SECONDS : SYNC_DUPLICATE_WINDOW_SECONDS;
    return Math.abs(r.time - candidate.time) <= window;
  });
}

/** Officer-entered record -- no real itemLink available by hand, so the item name is stored as a plain "[Name]" string (the same bracketed shape LootLogTable's display parsing already expects; it just won't carry a real tooltip). itemId, when the app's smart picker supplied one (a real item from this tier's loot table), is kept so getItemIconUrls can still resolve a real icon -- free-text entries just get null, same as before. */
function manualAdd({ winner, itemName, boss, slot, time: recordTime, itemId }) {
  if (!winner || !itemName) throw new Error('winner and itemName are both required.');
  const db = load();
  const time = recordTime ?? Math.floor(Date.now() / 1000);

  const duplicate = db.records.find(
    (r) => r.winner.toLowerCase() === winner.toLowerCase() && extractItemName(r.itemLink)?.toLowerCase() === itemName.toLowerCase() && Math.abs(r.time - time) <= DUPLICATE_WINDOW_SECONDS,
  );
  if (duplicate) {
    throw new Error(`${winner} already has a logged win for "${itemName}" around this time -- check Loot History before adding it again.`);
  }

  const record = {
    id: crypto.randomUUID(),
    itemId: itemId ?? null,
    itemLink: `[${itemName}]`,
    winner,
    boss: boss || null,
    slot: slot || 'Other',
    time,
  };
  db.records.push(record);
  save(db);
  return db.records;
}

// Same guard as manualAdd's, so editing a record into a collision with a DIFFERENT
// existing record is caught the same way adding one is -- checked against the
// PATCHED values before anything is mutated, since `record` is the live object
// inside db.records and mutating it first would make the record collide with itself.
function update(id, patch) {
  const db = load();
  const record = db.records.find((r) => r.id === id);
  if (!record) return db.records;

  const effectiveWinner = patch.winner !== undefined ? patch.winner : record.winner;
  const effectiveItemName = patch.itemName !== undefined ? patch.itemName : extractItemName(record.itemLink);
  const duplicate = db.records.find(
    (r) => r.id !== id && r.winner.toLowerCase() === effectiveWinner.toLowerCase() && extractItemName(r.itemLink)?.toLowerCase() === effectiveItemName?.toLowerCase() && Math.abs(r.time - record.time) <= DUPLICATE_WINDOW_SECONDS,
  );
  if (duplicate) {
    throw new Error(`${effectiveWinner} already has a separate logged win for "${effectiveItemName}" around this time -- that would create a duplicate instead of fixing this one.`);
  }

  if (patch.winner !== undefined) record.winner = patch.winner;
  if (patch.itemName !== undefined) {
    record.itemLink = `[${patch.itemName}]`;
    record.itemId = null;
  }
  if (patch.boss !== undefined) record.boss = patch.boss || null;
  if (patch.slot !== undefined) record.slot = patch.slot || 'Other';
  save(db);
  return db.records;
}

// Manually-added records (no real natural key -- itemId is null) don't get tombstoned:
// there's nothing for a future sync to ever re-add, since the addon never produced them.
function remove(id) {
  const db = load();
  const target = db.records.find((r) => r.id === id);
  if (target && target.itemId != null) db.removedKeys.push(recordKey(target));
  db.records = db.records.filter((r) => r.id !== id);
  save(db);
  return db.records;
}

/** A trade with no matching win record (a standalone entry, e.g. a Greed-won item just passed to someone) -- no fields to correct, only ever removed outright. Tombstoned the same way remove() does, for the same reason (the addon's local copy will keep re-offering it otherwise). */
function removeTrade(id) {
  const db = load();
  const target = db.trades.find((t) => t.id === id);
  if (target) db.removedKeys.push(tradeKey(target));
  db.trades = db.trades.filter((t) => t.id !== id);
  save(db);
  return db.trades;
}

module.exports = { load, sync, manualAdd, update, remove, removeTrade };
