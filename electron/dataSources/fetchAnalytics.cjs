const store = require('./analyticsStore.cjs');
const proxyClient = require('./proxyClient.cjs');

// Same branch-don't-rewrite pattern as every other proxy-backed feature: the packaged
// app goes through the proxy; local dev without a proxy configured falls back to the
// local store directly. No Discord posting involved either way, unlike raid signups/
// GOTM, so there's nothing to strip between the two -- analyticsStore.cjs itself is the
// verbatim proxy-side implementation too (see its own header comment).
async function trackAnalyticsEvent(payload, mode) {
  if (proxyClient.isAvailable()) return proxyClient.trackAnalyticsEvent(payload);
  return store.record(payload, mode);
}

async function listAnalyticsEvents(mode) {
  if (proxyClient.isAvailable()) return proxyClient.listAnalyticsEvents();
  return store.list(mode);
}

module.exports = { trackAnalyticsEvent, listAnalyticsEvents };
