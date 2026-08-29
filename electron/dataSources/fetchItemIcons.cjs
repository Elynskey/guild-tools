const { fetchItemIconUrls } = require('./itemIcons.cjs');
const proxyClient = require('./proxyClient.cjs');

// Real Blizzard credentials only ever run server-side (the proxy, in every packaged
// build) -- same branch-don't-rewrite pattern as fetchRoster.cjs's gear-completion
// call. Local dev without a proxy still works directly off .env's BNET_CLIENT_ID/SECRET.
async function getItemIconUrls(itemIds) {
  if (proxyClient.isAvailable()) return proxyClient.getItemIconUrls(itemIds);
  return fetchItemIconUrls(itemIds);
}

module.exports = { getItemIconUrls };
