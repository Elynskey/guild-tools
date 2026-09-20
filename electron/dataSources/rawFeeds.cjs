const fs = require('node:fs');
const { classifyLootLine, chatLogPath } = require('./lootChatTail.cjs');
const { parseEncounters, newestCombatLogPath } = require('./lootCombatLog.cjs');

// The unprocessed truth behind the loot pipeline, for the test-only Loot Logger Monitor: the loot lines WoW
// actually wrote to the chat log, and the boss pulls (kills AND wipes) it wrote to the combat log. When a win
// "wasn't captured", the first question is always "did the game even write it, and in what words?" -- this
// answers that without opening a multi-hundred-megabyte file. Read-only, and only ever the tail of each file.

const CHAT_TAIL_BYTES = 96 * 1024;
const COMBAT_TAIL_BYTES = 768 * 1024;

/** The last `maxBytes` of a file as text, starting on a whole line. Null if unreadable. */
function readTail(file, maxBytes) {
  try {
    const stats = fs.statSync(file);
    const start = Math.max(0, stats.size - maxBytes);
    const buffer = Buffer.alloc(stats.size - start);
    const fd = fs.openSync(file, 'r');
    try {
      fs.readSync(fd, buffer, 0, buffer.length, start);
    } finally {
      fs.closeSync(fd);
    }
    let text = buffer.toString('utf8');
    if (start > 0) text = text.slice(text.indexOf('\n') + 1); // drop the half line the cut landed in
    return text;
  } catch {
    return null;
  }
}

/** Loot-related chat lines, newest first. `time` is the line's own stamp ("9/20 19:28:35.055"). */
function recentLootLines(limit = 30, file = chatLogPath()) {
  if (!file) return { available: false, lines: [] };
  const text = readTail(file, CHAT_TAIL_BYTES);
  if (text === null) return { available: false, lines: [] };
  const lines = [];
  for (const raw of text.split('\n')) {
    const found = classifyLootLine(raw);
    if (!found) continue;
    const stamp = raw.match(/^(\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\s+/);
    lines.push({ time: stamp ? stamp[1] : null, kind: found.kind, text: found.text.replace(/^\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}(?:\.\d+)?\s+/, '') });
  }
  return { available: true, lines: lines.reverse().slice(0, limit) };
}

/** Boss pulls from the newest combat log, newest first: a start, and how it ended (kill or wipe). */
function recentEncounters(limit = 20, file = newestCombatLogPath()) {
  if (!file) return { available: false, pulls: [] };
  const text = readTail(file, COMBAT_TAIL_BYTES);
  if (text === null) return { available: false, pulls: [] };
  const ends = parseEncounters(text)
    .filter((p) => p.kind === 'end')
    .reverse()
    .slice(0, limit)
    .map((p) => ({ boss: p.boss, encounterId: p.encounterId, difficultyId: p.difficultyId, kill: p.success === true, at: p.at }));
  return { available: true, pulls: ends };
}

module.exports = { recentLootLines, recentEncounters, readTail };
