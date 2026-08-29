const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');

// The shared, officer-wide loot log -- runs on the API proxy server. Same JSON-file
// pattern as craftRequestsStore.cjs. Multiple officers' PCs can each have the
// GuildToolsLoot addon running during the same raid (Group Loot broadcasts every Need
// win to the whole raid, so more than one addon instance sees the exact same roll) --
// sync() dedupes on that overlap rather than creating duplicate entries.
//
// Every record gets an `id` assigned here (not by the addon -- the addon's own natural
// key is itemId+winner+time, which is what sync() dedupes on) so officers can edit or
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
    db = { records: parsed.records ?? [], trades: parsed.trades ?? [], removedKeys: parsed.removedKeys ?? [] };
  } catch {
    return { records: [], trades: [], removedKeys: [] };
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

// Two different addon instances observing the same broadcasted roll produce the same
// item + winner within the same second, so that triple is a safe natural key.
const recordKey = (r) => `${r.itemId}::${r.winner}::${r.time}`;
const tradeKey = (t) => `${t.itemId}::${t.from}::${t.to}::${t.time}`;

/**
 * Merges newly-submitted records/trades into the shared store, deduped. Returns the full
 * merged store plus which of the incoming records/trades were genuinely new (addedRecords/
 * addedTrades) -- callers that want to announce new loot (e.g. the Discord posting route)
 * need that distinction so multiple officers syncing the same raid night never double-post.
 *
 * Also skips anything matching a removedKeys entry -- an officer deleting a record/trade
 * in the app must stay deleted even though the addon's own local SavedVariables still has
 * it and will keep offering it up on every future sync from that same client (confirmed
 * live: deleting the Hexing Spiritrender trade only removed it from the shared store, and
 * the very next sync from the client that originally captured it silently re-added it).
 */
function sync(newRecords, newTrades) {
  const db = load();
  const recordKeys = new Set(db.records.map(recordKey));
  const tradeKeys = new Set(db.trades.map(tradeKey));
  const removed = new Set(db.removedKeys);
  const addedRecords = [];
  const addedTrades = [];

  for (const r of newRecords ?? []) {
    const k = recordKey(r);
    if (!recordKeys.has(k) && !removed.has(k)) {
      const withId = { id: crypto.randomUUID(), ...r };
      db.records.push(withId);
      recordKeys.add(k);
      addedRecords.push(withId);
    }
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

  save(db);
  return { records: db.records, trades: db.trades, addedRecords, addedTrades };
}

/** Officer-entered record -- no real itemLink available by hand, so the item name is stored as a plain "[Name]" string (the same bracketed shape LootLogTable's display parsing already expects; it just won't carry a real tooltip). */
function manualAdd({ winner, itemName, boss, slot, time: recordTime }) {
  const db = load();
  const record = {
    id: crypto.randomUUID(),
    itemId: null,
    itemLink: `[${itemName}]`,
    winner,
    boss: boss || null,
    slot: slot || 'Other',
    time: recordTime ?? Math.floor(Date.now() / 1000),
  };
  db.records.push(record);
  save(db);
  return db.records;
}

function update(id, patch) {
  const db = load();
  const record = db.records.find((r) => r.id === id);
  if (!record) return db.records;
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
