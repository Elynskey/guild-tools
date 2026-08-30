const settingsStore = require('./settingsStore.cjs');
const discordPost = require('./discordPost.cjs');
const proxyClient = require('./proxyClient.cjs');

/**
 * Posts each pre-formatted message (one per boss -- see src/raid/lootLogic.ts's
 * formatNightForDiscord, which is what actually builds these strings) to the
 * configured loot-log Discord channel. This is the officer-triggered "Post to
 * Discord" button on Loot History, distinct from the automatic per-item posts
 * lootRecordsStore.sync() already does on every new capture -- this one is a
 * deliberate, officer-confirmed re-announcement (e.g. a night that predates the
 * channel being configured, or after manual corrections), so it never dedupes
 * against what's already been posted.
 *
 * Runs directly against Discord when there's no proxy (local dev), or delegates to
 * the proxy in every packaged build -- same branch-don't-rewrite pattern as
 * everything else in this pipeline.
 */
async function postLootNightToDiscord(messages) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array.');

  if (proxyClient.isAvailable()) return proxyClient.postLootNightToDiscord(messages);

  const channelId = settingsStore.load().lootLogChannelId;
  if (!channelId) throw new Error('No loot-log Discord channel configured -- set one in Settings first.');
  for (const message of messages) {
    await discordPost.postMessage(channelId, { content: message });
  }
  return { posted: messages.length };
}

module.exports = { postLootNightToDiscord };
