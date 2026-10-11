// Tells this PC's officer when loot has gone out to Discord. Auto-post runs on the proxy, and the game cannot hear from it
// (an addon only reads files when the game loads), so the app watches the shared loot records for wins that just got a
// discordPostedAt stamp and does two things when it sees one:
//   - a desktop notification, right away;
//   - a small Lua file in the addon folder (GuildToolsLootStatus.lua) that the addon prints in the game chat the next
//     time the game loads (login or /reload).
// The first look after the app starts only records what was already posted, so opening the app never announces history.

const RECENT_MS = 30 * 60 * 1000; // a stamp older than this is not news (the app was closed, or the proxy was restarted)
const MAX_LINES = 5;

function itemName(itemLink) {
  const m = typeof itemLink === 'string' && itemLink.match(/\[(.+?)\]/);
  return m ? m[1] : String(itemLink ?? '');
}

/** The records stamped as posted since the last look (never the ones already seen). */
function newlyPosted(records, seen, nowMs = Date.now()) {
  const fresh = [];
  for (const r of records ?? []) {
    if (!r?.id || !r.discordPostedAt || seen.has(r.id)) continue;
    seen.add(r.id);
    const at = Date.parse(r.discordPostedAt);
    if (Number.isFinite(at) && nowMs - at <= RECENT_MS) fresh.push(r);
  }
  return fresh;
}

/** Plain text, no WoW colour escapes: pipes would be read as formatting by the game. */
function clean(text) {
  return String(text ?? '').replace(/[^\x20-\x7e]/g, '?').replace(/\|/g, '/');
}

function describe(posted) {
  const lines = posted.slice(0, MAX_LINES).map((r) => `${clean(r.winner)} won ${clean(itemName(r.itemLink))}`);
  if (posted.length > MAX_LINES) lines.push(`and ${posted.length - MAX_LINES} more`);
  const boss = posted.every((r) => r.boss === posted[0].boss) && posted[0].boss ? ` (${clean(posted[0].boss)})` : '';
  return { title: `Posted ${posted.length} win${posted.length === 1 ? '' : 's'} to Discord${boss}`, body: lines.join('\n') };
}

function luaString(text) {
  return `"${clean(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** The contents of GuildToolsLootStatus.lua. */
function statusLua(posted, nowSeconds = Math.floor(Date.now() / 1000)) {
  const { title, body } = describe(posted);
  return [
    '-- Written by the Guild Tools app after loot is posted to Discord. The addon prints this in chat the next time the game loads.',
    'GuildToolsLootStatus = {',
    `  postedAt = ${nowSeconds},`,
    `  count = ${posted.length},`,
    `  text = ${luaString(`${title}: ${body.replace(/\n/g, '; ')}`)},`,
    '}',
    '',
  ].join('\n');
}

/**
 * @param {{ getRecords: () => Promise<object[]>, notify: (n: { title: string, body: string }) => void, writeStatus: (lua: string) => void, now?: () => number }} deps
 */
function createWatcher({ getRecords, notify, writeStatus, now = Date.now }) {
  const seen = new Set();
  let primed = false;
  return {
    /** @returns {Promise<object[]>} the wins announced by this look */
    async poll() {
      const records = await getRecords();
      if (!primed) {
        primed = true;
        for (const r of records ?? []) if (r?.id && r.discordPostedAt) seen.add(r.id);
        return [];
      }
      const posted = newlyPosted(records, seen, now());
      if (posted.length === 0) return [];
      try {
        notify(describe(posted));
      } catch (err) {
        console.error('[discordPostWatch] notification failed:', err.message);
      }
      try {
        writeStatus(statusLua(posted, Math.floor(now() / 1000)));
      } catch (err) {
        console.error('[discordPostWatch] status file failed:', err.message);
      }
      return posted;
    },
  };
}

module.exports = { newlyPosted, describe, statusLua, createWatcher, RECENT_MS };
