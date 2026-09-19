const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');
const { resolveWowPath, isRealWowPath, getCharacterName } = require('./lootLog.cjs');

// Second, independent capture path alongside the addon's SavedVariables read (see
// lootLog.cjs) -- WoW's own chat log (enabled in-game via /chatlog) is written to disk
// continuously during a session, unlike SavedVariables, which only flushes on /reload or
// logout. This lets Guild Tools see a Need win within one poll interval instead of
// waiting on a reload, at the cost of not knowing which boss it came from or its equip
// slot (both need WoW client APIs -- ENCOUNTER_START/END and GetItemInfoInstant -- that
// don't exist outside the game). Records from here carry `source: 'chat-tail'` and
// `boss: null`; lootRecordsStore.cjs's sync() reconciles them once the addon's
// authoritative data eventually arrives (see upgradeRecord there).
//
// Whether chat logging is actually on used to also be guessed at here (a file-mtime
// freshness check surfaced as a banner in the app) -- removed 2026-09-12 after that
// guess disagreed with reality live, more than once. GuildToolsLoot.lua's own
// IsChatLogging() reminder is the real, authoritative version of the same signal and
// already runs in-game at login/raid-entry -- no reason to keep a worse guess of it
// here too. (getChatLogStatus() below reintroduces a narrow, clearly-labeled version of
// that freshness signal -- see its own comment for why this is a different, safer use.)

function chatLogPath() {
  const wowPath = resolveWowPath();
  if (!isRealWowPath(wowPath)) return null;
  return path.join(wowPath, 'Logs', 'WoWChatLog.txt');
}

function statePath() {
  return path.join(resolveDataDir(), 'loot-chat-tail-state.json');
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
}

// Confirmed live 2026-09-19 against a real WoWChatLog.txt spanning 9/11-9/18 (a full
// week, several real raid nights): the file has ZERO matches for what this parser was
// built against (GuildToolsLoot.lua's own WON_ROLL_PATTERN, ported verbatim under the
// assumption the on-disk log mirrors the in-game CHAT_MSG_LOOT text). It never has.
// The real on-disk line looks like:
//   9/18 21:49:26.420  Loot: You (Need - 94, Main-Spec) Won: Tomb-Creeper's Claw
// Three differences from the in-game text, all confirmed from that same real file:
//   1. No square brackets around "Loot" (in-game: "[Loot]:"; logged: "Loot:").
//   2. An optional ", Main-Spec"/", Off-Spec" qualifier after the roll value, still
//      inside the parens -- the old pattern required the paren to close right after
//      the number, so this alone would have broken every match even with #1 fixed.
//   3. No item hyperlink at all, just the plain item name as trailing text -- WoW's
//      chat logger strips link escape codes when writing to disk. There is nothing
//      here to extract an itemId from; itemLink is rebuilt as a plain "[Name]"
//      bracketed string instead, the same shape manualAdd() already uses for
//      hand-entered records, which lootRecordsStore.cjs's name-based dedup already
//      understands.
// This is why chat-tail never captured a single real win despite /chatlog being
// genuinely on and the app running the whole raid -- every line silently failed to
// match, with no error anywhere to surface that.
const WON_ROLL_PATTERN = /Loot: (.*?) \((.*?) - \d+(?:,[^)]*)?\) Won: (.+)$/;

// The logged line substitutes the literal word "You" for the local player's own name
// -- confirmed against the same real file (a win by the account actually running WoW
// logs as "Loot: You (...) Won: ..." instead of their character name). This is a
// disk-log-only quirk: the in-game chat text and the addon's own SavedVariables both
// carry the real name (confirmed against this guild's real production SavedVariables,
// which has zero "You" winners), so it's not a wider addon bug, just something this
// parser alone has to correct for.
function resolveWinnerName(rawWinner) {
  if (rawWinner !== 'You') return rawWinner;
  return getCharacterName();
}

function parseLine(line) {
  const wonMatch = line.match(WON_ROLL_PATTERN);
  if (!wonMatch) return null;
  const [, rawWinner, rollType, rawItemName] = wonMatch;
  if (!rollType.toLowerCase().includes('need')) return null;

  // Dropped rather than recorded under the literal name "You" if no character name is
  // configured yet -- a record like that could never reconcile with the addon's own
  // authoritative sync (which always has the real name), so it would just sit as a
  // permanent phantom entry. The app should be telling the officer to set this (see
  // the Loot History screen's live-capture status card), not silently mis-attributing
  // their own wins.
  const winner = resolveWinnerName(rawWinner);
  if (!winner) return null;

  const itemName = rawItemName.trim();
  if (!itemName) return null;

  return {
    itemId: null,
    itemLink: `[${itemName}]`,
    winner,
    boss: null,
    slot: null,
    difficulty: null, // no client API access from a chat-log tail -- filled in once the addon's sync reconciles it (see upgradeRecord)
    source: 'chat-tail',
    time: Math.floor(Date.now() / 1000),
  };
}

/**
 * Reads whatever's been appended to the chat log since the last poll and returns any
 * Need wins found in it. Operates on the raw byte buffer (not a decoded string) so line
 * splitting on the 0x0A newline byte is always safe even with multi-byte player names --
 * a newline byte can never appear inside a multi-byte UTF-8 continuation sequence.
 * @returns {{ status: 'ok' | 'not_configured', newRecords: object[] }}
 */
function pollChatLog() {
  const p = chatLogPath();
  if (!p) return { status: 'not_configured', newRecords: [] };

  let stats;
  try {
    stats = fs.statSync(p);
  } catch {
    return { status: 'not_configured', newRecords: [] };
  }

  const state = loadState();
  if (!state || state.path !== p) {
    // First time ever seeing this exact resolved path -- start from the current end of
    // file. Starting at 0 would ingest the file's whole pre-existing history as "new"
    // wins with no boss and nothing for the addon to ever reconcile them against.
    saveState({ path: p, offset: stats.size });
    return { status: 'ok', newRecords: [] };
  }

  let offset = state.offset;
  if (stats.size < offset) offset = 0; // Log recreated/truncated across a WoW relaunch.
  if (stats.size === offset) return { status: 'ok', newRecords: [] };

  const buffer = Buffer.alloc(stats.size - offset);
  const fd = fs.openSync(p, 'r');
  try {
    fs.readSync(fd, buffer, 0, buffer.length, offset);
  } finally {
    fs.closeSync(fd);
  }

  const NEWLINE = 0x0a;
  const newRecords = [];
  let lineStart = 0;
  let consumedBytes = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] !== NEWLINE) continue;
    const line = buffer.subarray(lineStart, i).toString('utf8').replace(/\r$/, '');
    const record = parseLine(line);
    if (record) newRecords.push(record);
    lineStart = i + 1;
    consumedBytes = lineStart;
  }
  // Any bytes after the last newline are an in-progress line (WoW may still be
  // mid-write) -- left unconsumed, so the next poll re-reads them along with whatever
  // gets appended after, once the line is actually complete.

  saveState({ path: p, offset: offset + consumedBytes });
  return { status: 'ok', newRecords };
}

// A narrow, clearly-labeled freshness check for the app's own "is live capture
// actually working right now" status card (Loot History) -- NOT a replacement for the
// addon's own IsChatLogging() reminder (still the authoritative on/off signal, see the
// file-level comment above for why a broader version of this exact idea was removed
// 2026-09-12). This only ever answers "does the log file exist, and has it been
// written to recently" -- both observable facts, not a guess at a client CVar this
// process has no access to. `active` uses a 5-minute window: long enough to survive a
// quiet stretch between chat lines, short enough to mean something if WoW isn't even
// running right now.
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function getChatLogStatus() {
  const p = chatLogPath();
  if (!p) return { path: null, exists: false, active: false };
  try {
    const stats = fs.statSync(p);
    return { path: p, exists: true, active: Date.now() - stats.mtimeMs < ACTIVE_WINDOW_MS };
  } catch {
    return { path: p, exists: false, active: false };
  }
}

module.exports = { pollChatLog, getChatLogStatus };
