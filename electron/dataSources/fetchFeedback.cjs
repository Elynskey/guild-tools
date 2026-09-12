const { sendFeedback } = require('./feedback.cjs');
const proxyClient = require('./proxyClient.cjs');

// Same branch-don't-rewrite pattern as every other Discord-posting feature: the
// packaged app (no real bot token of its own) goes through the proxy; local dev
// without a proxy configured sends straight from DISCORD_BOT_TOKEN in .env, if present.
async function submitFeedback(payload) {
  if (proxyClient.isAvailable()) return proxyClient.sendFeedback(payload);
  return sendFeedback(payload);
}

module.exports = { submitFeedback };
