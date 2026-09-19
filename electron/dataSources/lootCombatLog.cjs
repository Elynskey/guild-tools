const fs = require('node:fs');
const path = require('node:path');
const { resolveWowPath, isRealWowPath } = require('./lootLog.cjs');

// Tails WoW's combat log (Logs/WoWCombatLog-*.txt) for boss KILLS, so a Need win seen in
// the chat log (lootChatTail.cjs -- which has no idea which boss dropped what) can be
// given a boss and difficulty the moment it happens, instead of waiting for the addon's
// SavedVariables to reach disk on a /reload. Confirmed live 2026-09-19 against a real
// raid night's log:
//   9/18/2026 21:01:53.674-5  ENCOUNTER_END,3492,"Ula'tek",14,23,1,438881
//   ^ local time + UTC offset      ^id   ^name    ^difficulty ^size ^success ^fight ms
// difficulty 14 = Normal, 15 = Heroic (the same Blizzard DifficultyIDs the addon uses);
// success 1 = kill, 0 = wipe. Only kills matter here -- loot follows a kill, never a wipe.
//
// Whether this file exists at all depends on combat logging being ON on this PC (the
// Warcraft Logs / Archon logger normally turns it on for raids) -- this app doesn't and
// shouldn't touch that setting. With no combat log, nothing here can attribute a win and
// the record just waits for the addon's authoritative sync, exactly as before.

const BOOTSTRAP_BYTES = 32 * 1024 * 1024; // enough to see the last kill if the app starts mid-raid
const READ_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_KILLS_KEPT = 6;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const LINE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})\.(\d{3})([+-]\d+(?:\.\d+)?)  ENCOUNTER_END,(.*?)\r?$/gm;
const END_ARGS = /^(\d+),"(.*)",(\d+),(\d+),(\d+),(\d+)$/;

/** @returns {Array<{ boss: string, encounterId: number, difficultyId: number, endedAt: number }>} kills only, in file order; endedAt is epoch ms. */
function parseKills(text) {
  const kills = [];
  for (const m of text.matchAll(LINE_PATTERN)) {
    const args = m[9].match(END_ARGS);
    if (!args || args[5] !== '1') continue; // wipe (success 0) or an unfamiliar shape
    const [, month, day, year, hour, minute, second, ms, offsetHours] = m;
    const endedAt = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number(ms)) - parseFloat(offsetHours) * 3600 * 1000;
    kills.push({ boss: args[2], encounterId: Number(args[1]), difficultyId: Number(args[3]), endedAt });
  }
  return kills;
}

let state = null; // { path, offset }
let kills = []; // oldest first

function combatLogDir() {
  const wowPath = resolveWowPath();
  if (!isRealWowPath(wowPath)) return null;
  return path.join(wowPath, 'Logs');
}

/** The newest combat log file -- WoW starts a fresh timestamped one each time logging is switched on. */
function newestCombatLog() {
  const dir = combatLogDir();
  if (!dir) return null;
  let best = null;
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!/^WoWCombatLog.*\.txt$/i.test(name)) continue;
      const file = path.join(dir, name);
      const st = fs.statSync(file);
      if (!best || st.mtimeMs > best.mtimeMs) best = { file, mtimeMs: st.mtimeMs, size: st.size };
    }
  } catch {
    return null;
  }
  return best;
}

function readRange(file, start, end) {
  const buffer = Buffer.alloc(end - start);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    fs.closeSync(fd);
  }
  return buffer;
}

function remember(newKills) {
  for (const k of newKills) {
    if (kills.some((x) => x.endedAt === k.endedAt && x.encounterId === k.encounterId)) continue;
    kills.push(k);
  }
  kills.sort((a, b) => a.endedAt - b.endedAt);
  if (kills.length > MAX_KILLS_KEPT) kills = kills.slice(-MAX_KILLS_KEPT);
}

/** Reads whatever's new in the newest combat log. Cheap on a quiet tick (one readdir + stat); only the appended bytes are ever read. @returns {{ status: 'ok' | 'not_configured' | 'no_log' }} */
function pollCombatLog() {
  if (!combatLogDir()) return { status: 'not_configured' };
  const newest = newestCombatLog();
  if (!newest) return { status: 'no_log' };

  if (!state) {
    // First look at any combat log this session: catch up on the tail only (the last kill
    // may already have happened if the app opened mid-raid), never the whole file -- these
    // run to hundreds of MB.
    const start = Math.max(0, newest.size - BOOTSTRAP_BYTES);
    if (newest.size > start) remember(parseKills(readRange(newest.file, start, newest.size).toString('utf8')));
    state = { path: newest.file, offset: newest.size };
    return { status: 'ok' };
  }

  if (state.path !== newest.file) state = { path: newest.file, offset: 0 }; // logging was switched off and on: a brand-new file
  if (newest.size < state.offset) state.offset = 0; // truncated/replaced
  if (newest.size === state.offset) return { status: 'ok' };

  let carry = '';
  while (state.offset < newest.size) {
    const end = Math.min(newest.size, state.offset + READ_CHUNK_BYTES);
    const text = carry + readRange(newest.file, state.offset, end).toString('utf8');
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline === -1) {
      carry = text; // a single unfinished line larger than a chunk -- keep accumulating
      state.offset = end;
      continue;
    }
    remember(parseKills(text.slice(0, lastNewline)));
    carry = text.slice(lastNewline + 1);
    state.offset = end;
  }
  // Bytes after the last newline are a line WoW is still writing -- hold them back and
  // re-read them (with whatever follows) next poll, so a kill line is never parsed half-written.
  state.offset -= Buffer.byteLength(carry, 'utf8');
  return { status: 'ok' };
}

/** Kills this session, newest first, that ended no more than `maxAgeMs` ago -- what loot rolls could still be resolving from. */
function recentKills(nowMs, maxAgeMs = 10 * 60 * 1000) {
  return kills.filter((k) => k.endedAt <= nowMs + 60_000 && nowMs - k.endedAt <= maxAgeMs).sort((a, b) => b.endedAt - a.endedAt);
}

/** For the Loot History status card: is a combat log being written right now, and what boss kill was last seen? */
function getCombatLogStatus() {
  const newest = combatLogDir() ? newestCombatLog() : null;
  const last = kills[kills.length - 1] ?? null;
  return {
    exists: !!newest,
    active: !!newest && Date.now() - newest.mtimeMs < ACTIVE_WINDOW_MS,
    lastKill: last ? { boss: last.boss, difficultyId: last.difficultyId, endedAt: last.endedAt } : null,
  };
}

function resetForTests() {
  state = null;
  kills = [];
}

module.exports = { pollCombatLog, recentKills, getCombatLogStatus, parseKills, resetForTests };
