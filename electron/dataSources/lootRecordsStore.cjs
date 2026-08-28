const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// The shared, officer-wide loot log -- runs on the API proxy server. Same JSON-file
// pattern as craftRequestsStore.cjs. Multiple officers' PCs can each have the
// GuildToolsLoot addon running during the same raid (Group Loot broadcasts every Need
// win to the whole raid, so more than one addon instance sees the exact same roll) --
// sync() dedupes on that overlap rather than creating duplicate entries.

function storePath() {
  return path.join(resolveDataDir(), 'loot-records.json');
}

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return { records: db.records ?? [], trades: db.trades ?? [] };
  } catch {
    return { records: [], trades: [] };
  }
}

function save(db) {
  fs.writeFileSync(storePath(), JSON.stringify(db, null, 2));
}

// Two different addon instances observing the same broadcasted roll produce the same
// item + winner within the same second, so that triple is a safe natural key.
const recordKey = (r) => `${r.itemId}::${r.winner}::${r.time}`;
const tradeKey = (t) => `${t.itemId}::${t.from}::${t.to}::${t.time}`;

/** Merges newly-submitted records/trades into the shared store, deduped, and returns the full merged store. */
function sync(newRecords, newTrades) {
  const db = load();
  const recordKeys = new Set(db.records.map(recordKey));
  const tradeKeys = new Set(db.trades.map(tradeKey));

  for (const r of newRecords ?? []) {
    const k = recordKey(r);
    if (!recordKeys.has(k)) {
      db.records.push(r);
      recordKeys.add(k);
    }
  }
  for (const t of newTrades ?? []) {
    const k = tradeKey(t);
    if (!tradeKeys.has(k)) {
      db.trades.push(t);
      tradeKeys.add(k);
    }
  }

  save(db);
  return db;
}

module.exports = { load, sync };
