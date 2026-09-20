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

// Every function takes a `mode` ('prod' | 'test'), defaulting to 'prod' so any caller that doesn't
// pass one behaves exactly as before. 'test' reads and writes a completely separate file
// (loot-records.test.json) -- a "Guild Tools (Test)" app, and anything it captures, can never touch
// the real officers' loot log. Same scheme as signupsStore.cjs / gotmStore.cjs.
function storePath(mode) {
  return path.join(resolveDataDir(), mode === 'test' ? 'loot-records.test.json' : 'loot-records.json');
}

function save(db, mode) {
  fs.writeFileSync(storePath(mode), JSON.stringify(db, null, 2));
}

// Records/trades synced before `id` existed (everything synced before this feature
// shipped) need one backfilled so they're editable/removable too -- not just newly-added
// ones. Self-heals on first read rather than a one-off migration script, and persists
// the assigned ids immediately so this only ever runs once per record.
function load(mode) {
  let db;
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(mode), 'utf8'));
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
  if (backfilled) save(db, mode);

  return db;
}

// Records the app made itself from the chat log (no addon involved yet): 'chat-tail' with
// nothing attributed, or 'live' with boss/slot/difficulty worked out from the combat log
// and loot table (lootLiveEnrich.cjs). Either way the addon's own record of the same win
// is still the authority, and gets paired with these by findSyncDuplicate below.
const isPlaceholder = (r) => r.source === 'chat-tail' || r.source === 'live';

const recordKey = (r) => `${r.itemId}::${r.winner}::${r.time}`;
const tradeKey = (t) => `${t.itemId}::${t.from}::${t.to}::${t.time}`;
const needLossKey = (r) => `${r.itemId}::${r.name}::${r.time}`;

/**
 * Merges newly-submitted records/trades into the shared store, deduped. Returns the full
 * merged store plus which of the incoming records/trades were genuinely new (addedRecords/
 * addedTrades) -- callers that want to announce new loot (e.g. the Discord posting route)
 * need that distinction so multiple officers syncing the same raid night never double-post.
 *
 * Records go through findSyncDuplicate (below) rather than an exact-key match -- confirmed
 * live 2026-09-06: the addon's two independent capture paths (C_LootHistory and
 * CHAT_MSG_LOOT) both fire for the same real Need win, landing a second or two apart, so
 * an exact `time` match let 7 duplicate pairs from one raid night silently double-post to
 * Discord (same itemId+winner, time off by exactly 1). A tolerant match closes that gap
 * without risking a false merge of two genuinely separate wins later the same night.
 *
 * A match against an existing `source: 'chat-tail'` record (see lootChatTail.cjs -- a
 * live capture path with no boss/slot attribution, tailing WoW's chat log instead of
 * waiting on the addon's SavedVariables) is upgraded in place with the incoming
 * authoritative data instead of being discarded as a no-op duplicate -- see
 * upgradeRecord.
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
 * needLosses (Need rolls that did NOT win) merge the same way and DO respect removedKeys
 * (added 2026-09-12: a bulk data-cleanup silently reverted a few minutes later because
 * this check didn't exist yet -- the next sync from any client whose local SavedVariables
 * still had the old data just re-added everything). There's still no per-entry id or
 * edit/remove UI for these (see recordNeedLoss in the addon) -- removedKeys entries for
 * needLosses only ever get added via a manual/direct cleanup, never through an app action.
 */
function sync(newRecords, newTrades, newNeedLosses, mode = 'prod') {
  const db = load(mode);
  const tradeKeys = new Set(db.trades.map(tradeKey));
  const needLossKeys = new Set(db.needLosses.map(needLossKey));
  const removed = new Set(db.removedKeys);
  const addedRecords = [];
  const addedTrades = [];
  const addedNeedLosses = [];
  // Records that BECAME addon-verified in this call -- newly added from the addon, or a
  // chat-tail placeholder upgraded in place -- which is what auto-post-to-Discord acts
  // on (see lootAutoPost.cjs). Deliberately separate from addedRecords: an upgraded
  // record isn't "new" (it must not re-announce as a fresh win in any other consumer),
  // but it IS the first moment its boss/difficulty are known.
  const verifiedRecords = [];

  for (const r of newRecords ?? []) {
    if (removed.has(recordKey(r))) continue;
    const match = findSyncDuplicate(db.records, r);
    if (match) {
      // An addon-sourced (or otherwise authoritative) record filling in a chat-tail
      // placeholder isn't a new win -- it's the SAME win becoming fully attributed --
      // so it's deliberately excluded from addedRecords, otherwise postLootNight.cjs's
      // Discord-announce caller would re-announce a win that already went out live.
      if (isPlaceholder(match) && !isPlaceholder(r)) {
        upgradeRecord(match, r);
        verifiedRecords.push(match);
      }
      continue;
    }
    const withId = { id: crypto.randomUUID(), ...r };
    db.records.push(withId);
    addedRecords.push(withId);
    // 'live' counts as verified: boss and difficulty are known (from the combat log), which
    // is what lets auto-post announce a win with no /reload. Bare chat-tail captures don't.
    if (withId.source !== 'chat-tail') verifiedRecords.push(withId);
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
    if (removed.has(needLossKey(r))) continue;
    const k = needLossKey(r);
    if (!needLossKeys.has(k)) {
      db.needLosses.push(r);
      needLossKeys.add(k);
      addedNeedLosses.push(r);
    }
  }

  save(db, mode);
  return { records: db.records, trades: db.trades, needLosses: db.needLosses, addedRecords, addedTrades, addedNeedLosses, verifiedRecords };
}

/** Stamps records as announced to Discord so auto-post never announces the same win twice. */
function markPosted(ids, mode = 'prod') {
  const db = load(mode);
  const wanted = new Set(ids);
  const stamp = new Date().toISOString();
  for (const r of db.records) if (wanted.has(r.id)) r.discordPostedAt = stamp;
  save(db, mode);
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

// Returns the matched existing record (not just a boolean) so sync() can upgrade a
// chat-tail placeholder in place rather than just discarding whichever side arrives
// second.
function findSyncDuplicate(existingRecords, candidate) {
  const candidateName = extractItemName(candidate.itemLink)?.toLowerCase();
  return (
    existingRecords.find((r) => {
      // A chat-tail self-win only knows its winner as a best guess (see lootChatTail.cjs);
      // the addon's own record of the same win carries `self: true`, which pairs them
      // exactly even when the guess was a different character (an alt swap with no
      // /reload in between).
      const selfPair = (r.selfWin && isPlaceholder(r) && candidate.self === true) || (candidate.selfWin && isPlaceholder(candidate) && r.self === true);
      if (!selfPair && r.winner.toLowerCase() !== candidate.winner.toLowerCase()) return false;
      if (extractItemName(r.itemLink)?.toLowerCase() !== candidateName) return false;
      // A chat-tail placeholder's authoritative (addon-sourced) counterpart might not
      // land until the officer's next reload -- possibly hours later, at the very end
      // of the raid -- so either side being a chat-tail record widens the window to the
      // full DUPLICATE_WINDOW_SECONDS, same as a manual-placeholder match. Two chat-tail
      // records for the same winner+item still use the tight window (two officers'
      // clients both tailing the same broadcast land within seconds, never hours).
      const wide = isPlaceholder(r) || isPlaceholder(candidate);
      const window = wide || r.itemId == null || candidate.itemId == null ? DUPLICATE_WINDOW_SECONDS : SYNC_DUPLICATE_WINDOW_SECONDS;
      return Math.abs(r.time - candidate.time) <= window;
    }) ?? null
  );
}

// Fills in whatever the chat-tail path couldn't determine on its own (boss, slot, a real
// itemId if the chat-tail capture somehow missed it) from the addon's authoritative sync,
// then clears `source` -- the record is no longer "unverified" once this runs. Mutates
// `existing` in place (a live reference into db.records), same pattern update() uses, so
// sync()'s own save(db) call persists it. Deliberately keeps `existing.time` (the
// chat-tail capture time) rather than adopting `incoming.time` -- the addon's own
// comments already note its scan-stamped time isn't the roll's real time, so the
// near-real-time chat-tail stamp is arguably the better one, and keeping it avoids
// reshuffling which raid-night bucket the record lands in.
function upgradeRecord(existing, incoming) {
  // A 'live' record's boss/slot/difficulty were worked out by the app (combat log + loot
  // table); the addon read them from the game itself, so where they differ the addon wins.
  const authoritative = existing.source === 'live';
  if (incoming.boss != null && (authoritative || existing.boss == null)) existing.boss = incoming.boss;
  if (incoming.slot != null && (authoritative || existing.slot == null)) existing.slot = incoming.slot;
  if (existing.itemId == null && incoming.itemId != null) existing.itemId = incoming.itemId;
  if (incoming.difficulty != null && (authoritative || existing.difficulty == null)) existing.difficulty = incoming.difficulty;
  if ((incoming.itemLink?.length ?? 0) > (existing.itemLink?.length ?? 0)) existing.itemLink = incoming.itemLink;
  // The addon knows who it really was; a guessed self-win name gives way to it.
  if (existing.selfWin && incoming.self === true) existing.winner = incoming.winner;
  delete existing.selfWin;
  delete existing.source;
}

/** Officer-entered record -- no real itemLink available by hand, so the item name is stored as a plain "[Name]" string (the same bracketed shape LootLogTable's display parsing already expects; it just won't carry a real tooltip). itemId, when the app's smart picker supplied one (a real item from this tier's loot table), is kept so getItemIconUrls can still resolve a real icon -- free-text entries just get null, same as before. */
function manualAdd({ winner, itemName, boss, slot, time: recordTime, itemId, difficulty }, mode = 'prod') {
  if (!winner || !itemName) throw new Error('winner and itemName are both required.');
  const db = load(mode);
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
    difficulty: difficulty || null,
  };
  db.records.push(record);
  save(db, mode);
  return db.records;
}

// Same guard as manualAdd's, so editing a record into a collision with a DIFFERENT
// existing record is caught the same way adding one is -- checked against the
// PATCHED values before anything is mutated, since `record` is the live object
// inside db.records and mutating it first would make the record collide with itself.
function update(id, patch, mode = 'prod') {
  const db = load(mode);
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
  if (patch.difficulty !== undefined) record.difficulty = patch.difficulty || null;
  save(db, mode);
  return db.records;
}

// Manually-added records (no real natural key -- itemId is null) don't get tombstoned:
// there's nothing for a future sync to ever re-add, since the addon never produced them.
function remove(id, mode = 'prod') {
  const db = load(mode);
  const target = db.records.find((r) => r.id === id);
  if (target && target.itemId != null) db.removedKeys.push(recordKey(target));
  db.records = db.records.filter((r) => r.id !== id);
  save(db, mode);
  return db.records;
}

/** A trade with no matching win record (a standalone entry, e.g. a Greed-won item just passed to someone) -- no fields to correct, only ever removed outright. Tombstoned the same way remove() does, for the same reason (the addon's local copy will keep re-offering it otherwise). */
function removeTrade(id, mode = 'prod') {
  const db = load(mode);
  const target = db.trades.find((t) => t.id === id);
  if (target) db.removedKeys.push(tradeKey(target));
  db.trades = db.trades.filter((t) => t.id !== id);
  save(db, mode);
  return db.trades;
}

/** Bulk-removes every record/trade/needLoss whose time falls in [startTime, endTime] -- the "delete this whole raid night" action, since a night is purely a client-side time-gap grouping (see groupLootByNight), not an entity this store otherwise knows about. Tombstones each one the same way its own single-item remove function does, so a future sync from a client whose local addon data still has the originals can't silently bring any of it back. */
function deleteNight(startTime, endTime, mode = 'prod') {
  const db = load(mode);
  const inRange = (t) => t >= startTime && t <= endTime;

  const keptRecords = [];
  const keptTrades = [];
  const keptNeedLosses = [];
  let removedRecords = 0;
  let removedTrades = 0;
  let removedNeedLosses = 0;

  for (const r of db.records) {
    if (inRange(r.time)) {
      removedRecords += 1;
      if (r.itemId != null) db.removedKeys.push(recordKey(r));
    } else {
      keptRecords.push(r);
    }
  }
  for (const t of db.trades) {
    if (inRange(t.time)) {
      removedTrades += 1;
      db.removedKeys.push(tradeKey(t));
    } else {
      keptTrades.push(t);
    }
  }
  for (const r of db.needLosses) {
    if (inRange(r.time)) {
      removedNeedLosses += 1;
      db.removedKeys.push(needLossKey(r));
    } else {
      keptNeedLosses.push(r);
    }
  }

  db.records = keptRecords;
  db.trades = keptTrades;
  db.needLosses = keptNeedLosses;
  save(db, mode);
  return {
    records: db.records,
    trades: db.trades,
    needLosses: db.needLosses,
    removed: { records: removedRecords, trades: removedTrades, needLosses: removedNeedLosses },
  };
}

module.exports = { load, sync, markPosted, manualAdd, update, remove, removeTrade, deleteNight };
