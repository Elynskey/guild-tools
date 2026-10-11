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
//   - only fresh wins (last 12 hours) -- an officer's very first sync offers the addon's
//     whole history back, and none of that should suddenly hit the channel.
//   - at most once per record (discordPostedAt), even across repeated syncs.
//   - only records that BECAME verified (lootRecordsStore.sync's verifiedRecords), not everything in the
//     store. Those are flagged autoPostPending on the record, and every call (each sync, plus a timer) also
//     retries the flagged ones that are still unposted -- a failed post, or a win whose boss/difficulty only
//     arrived later, used to be lost for good because verifiedRecords exists for one call only.
// One message per boss+difficulty per sync, formatted like Loot History's manual "Post
// to Discord" (src/raid/lootLogic.ts's formatNightForDiscord) so both read the same.

// Long enough for a whole raid night plus the end-of-night /reload that finally delivers the addon's records; an
// officer's very first sync still can't post history from earlier nights (raids are on different days).
const RECENT_WINDOW_SECONDS = 12 * 60 * 60;
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;
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
 * @param {{ nowSeconds?: number, settings?: object, post?: Function, mark?: Function, mode?: 'prod' | 'test' }} [deps]  injectable for tests
 * @returns {Promise<{ posted: number, skipped?: string }>}
 */
async function announceVerified(verifiedRecords, deps = {}) {
  // Two overlapping sweeps (a sync and the timer) would both see a win as unposted and post it twice.
  const run = inFlight.then(() => announceOnce(verifiedRecords, deps));
  inFlight = run.catch(() => {});
  if (!deps.post && (!deps.mode || deps.mode === 'prod')) startSweepTimer();
  return run;
}

let inFlight = Promise.resolve();
let sweepTimer = null;

function startSweepTimer() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => announceVerified([]).catch((err) => console.error('[lootAutoPost] sweep failed:', err.message)), SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

async function announceOnce(verifiedRecords, deps) {
  const { nowSeconds = Math.floor(Date.now() / 1000), settings = settingsStore.load(), post = discordPost.postMessage, mode = 'prod' } = deps;
  // A test-mode app's wins post to the TEST loot channel (settings.testLootLogChannelId, e.g. CRD-TEST) and
  // are stamped in the TEST store -- never the real channel, never the real records.
  const channelId = mode === 'test' ? settings.testLootLogChannelId : settings.lootLogChannelId;
  const mark = deps.mark ?? ((ids) => lootRecordsStore.markPosted(ids, mode));
  if (!settings.autoPostLoot) return { posted: 0, skipped: 'off' };
  if (!channelId) return { posted: 0, skipped: 'no loot channel configured' };

  const pending = typeof deps.pending === 'function' ? deps.pending() : (deps.pending ?? lootRecordsStore.load(mode).records.filter((r) => r.autoPostPending));
  const seen = new Set();
  const candidates = [...(verifiedRecords ?? []), ...pending].filter((r) => !seen.has(r.id) && seen.add(r.id));
  const postable = candidates.filter((r) => isPostable(r, nowSeconds));
  let posted = 0;
  for (const batch of formatBatches(postable)) {
    try {
      await post(channelId, { content: batch.content });
      mark(batch.ids);
      posted += 1;
    } catch (err) {
      // Not marked posted, so the next sweep retries it. Logged so a misconfigured channel is visible.
      console.error('[lootAutoPost] Discord post failed:', err.message);
    }
  }
  return { posted };
}

module.exports = { announceVerified, formatBatches, isPostable, RECENT_WINDOW_SECONDS };
