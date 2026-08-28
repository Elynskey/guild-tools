// Posts and edits messages in the CRD Discord server -- pure REST calls with the bot
// token, no Gateway connection (that's bot.cjs's job, a separate always-on process that
// only exists on the API proxy, for handling button/modal interactions). This file runs
// in both the Electron app's local fallback (posting straight from DISCORD_BOT_TOKEN in
// .env, same branch-don't-rewrite pattern as everything else in this pipeline) and on
// the proxy, where it's what the shared craft-request/loot/signup routes actually call.
//
// Supersedes the earlier discordNotify.cjs foundation (plain-text-only, never wired to
// anything) -- this version also carries embeds/components so a posted message can
// include the interactive buttons the raid-signups feature needs.

function botHeaders() {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' };
}

function assertConfigured() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    throw new Error('Discord posting isn\'t configured (DISCORD_BOT_TOKEN missing).');
  }
}

/**
 * @param {string} channelId
 * @param {{content?: string, embeds?: object[], components?: object[]}} body
 */
async function postMessage(channelId, body) {
  assertConfigured();
  if (!channelId) throw new Error('No Discord channel configured for this post.');
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: botHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord message post failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * @param {string} channelId
 * @param {string} messageId
 * @param {{content?: string, embeds?: object[], components?: object[]}} body
 */
async function editMessage(channelId, messageId, body) {
  assertConfigured();
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: botHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord message edit failed: ${res.status} ${res.statusText}`);
  return res.json();
}

module.exports = { postMessage, editMessage };
