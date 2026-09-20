const discordPost = require('./discordPost.cjs');
const settingsStore = require('./settingsStore.cjs');
const lootRecordsStore = require('./lootRecordsStore.cjs');

// Optional automatic announcement of Need wins to the loot channel -- the shared
// "Auto-post to Discord" toggle in Settings (settings.autoPostLoot, on by default).
// Runs on the proxy, off the /loot-records/sync route, so it fires whenever ANY officer's
// addon data lands.
//
// This used to exist in a looser form and was removed 2026-09-12: it announced every
// newly captured win individually, live, with no officer in the loop and no check that
// the loot came from a guild raid (it posted a non-guild run's drops). The guardrails
// that make it safe to bring back as an opt-in:
//   - only records whose boss AND difficulty are known and whose source isn't a bare
//     'chat-tail' capture: either the addon's own record, or a 'live' one the app
//     attributed from the combat log + the tier's loot table (lootLiveEnrich.cjs), which
//     only ever matches this tier's bosses at Normal/Heroic -- so a capture from some
//     other run can never post. 'live' is what lets this fire with no /reload.
//   - only fresh wins (last 6 hours) -- an officer's very first sync offers the addon's
//     whole history back, and none of that should suddenly hit the channel.
//   - at most once per record (discordPostedAt), even across repeated syncs.
//   - only records that BECAME verified in this sync (lootRecordsStore.sync's
//     verifiedRecords), not everything in the store.
// One message per boss+difficulty per sync, formatted like Loot History's manual "Post
// to Discord" (src/raid/lootLogic.ts's formatNightForDiscord) so both read the same.

const RECENT_WINDOW_SECONDS = 6 * 60 * 60;
const DISCORD_MESSAGE_LIMIT = 1900; // 2000 is Discord's cap; headroom for the heading

function itemName(itemLink) {
  const m = typeof itemLink === 'string' && itemLink.match(/\[(.+)\]/);
  return m ? m[1] : itemLink;
}

function isPostable(record, nowSeconds) {
  return !!record.boss && !!record.difficulty && record.source !== 'chat-tail' && !record.discordPostedAt && nowSeconds - record.time <= RECENT_WINDOW_SECONDS;
}

/** @returns {Array<{ ids: string[], content: string }>} one entry per message to send -- a boss's list is split across messages only if it would exceed Discord's length cap. */
function formatBatches(records) {
  const groups = new Map();
  for (const r of records) {
    const key = `${r.boss}||${r.difficulty}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const batches = [];
  for (const [, group] of groups) {
    const heading = `**${group[0].boss} (${group[0].difficulty})**`;
    let ids = [];
    let lines = [];
    let length = heading.length;
    const flush = () => {
      if (lines.length) batches.push({ ids, content: `${heading}\n${lines.join('\n')}` });
      ids = [];
      lines = [];
      length = heading.length;
    };
    for (const r of group) {
      const line = `🎲 ${r.winner} won ${itemName(r.itemLink)}${r.slot ? ` (${r.slot})` : ''}`;
      if (lines.length && length + line.length + 1 > DISCORD_MESSAGE_LIMIT) flush();
      ids.push(r.id);
      lines.push(line);
      length += line.length + 1;
    }
    flush();
  }
  return batches;
}

/**
 * @param {object[]} verifiedRecords  sync()'s verifiedRecords
 * @param {{ nowSeconds?: number, settings?: object, post?: Function, mark?: Function }} [deps]  injectable for tests
 * @returns {Promise<{ posted: number, skipped?: string }>}
 */
async function announceVerified(verifiedRecords, deps = {}) {
  const { nowSeconds = Math.floor(Date.now() / 1000), settings = settingsStore.load(), post = discordPost.postMessage, mark = lootRecordsStore.markPosted } = deps;
  if (!settings.autoPostLoot) return { posted: 0, skipped: 'off' };
  if (!settings.lootLogChannelId) return { posted: 0, skipped: 'no loot channel configured' };

  const postable = (verifiedRecords ?? []).filter((r) => isPostable(r, nowSeconds));
  let posted = 0;
  for (const batch of formatBatches(postable)) {
    try {
      await post(settings.lootLogChannelId, { content: batch.content });
      mark(batch.ids);
      posted += 1;
    } catch (err) {
      // Not marked posted, and not retried automatically (a record only shows up in
      // verifiedRecords the one time it becomes verified) -- Loot History's manual "Post
      // to Discord" is the catch-up path. Logged so a misconfigured channel is visible.
      console.error('[lootAutoPost] Discord post failed:', err.message);
    }
  }
  return { posted };
}

module.exports = { announceVerified, formatBatches, isPostable, RECENT_WINDOW_SECONDS };
