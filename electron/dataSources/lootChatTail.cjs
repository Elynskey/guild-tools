const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');
const { resolveWowPath, isRealWowPath } = require('./lootLog.cjs');

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
// here too.

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

// Verbatim ports of GuildToolsLoot.lua's own CHAT_MSG_LOOT parsing (WON_ROLL_PATTERN /
// extractItemLink / itemIdFromLink) -- Lua's `.-` (lazy any) becomes `.*?`, `%x` (hex
// digit) becomes [0-9a-fA-F], and every literal `|` needs escaping since it's JS
// alternation syntax but has no special meaning in a Lua pattern.
const WON_ROLL_PATTERN = /\[Loot\]: (.*?) \((.*?) - \d+\) Won: /;
const ITEM_LINK_PATTERN = /(\|c[0-9a-fA-F]+\|Hitem:.*?\|h\|r)/;
const ITEM_ID_PATTERN = /item:(\d+)/;

function parseLine(line) {
  const wonMatch = line.match(WON_ROLL_PATTERN);
  if (!wonMatch) return null;
  const [, winner, rollType] = wonMatch;
  if (!rollType.toLowerCase().includes('need')) return null;

  const linkMatch = line.match(ITEM_LINK_PATTERN);
  if (!linkMatch) return null;
  const itemLink = linkMatch[1];
  const idMatch = itemLink.match(ITEM_ID_PATTERN);

  return {
    itemId: idMatch ? Number(idMatch[1]) : null,
    itemLink,
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

module.exports = { pollChatLog };
