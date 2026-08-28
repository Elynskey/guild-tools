const store = require('./craftRequestsStore.cjs');
const proxyClient = require('./proxyClient.cjs');

// Crafting requests are officer-wide data, not per-install -- when the proxy is
// available (every packaged build) they live server-side so every officer sees the
// same board (and, eventually, so a Discord bot can read/post them too). Local dev
// (no PROXY_BASE_URL) falls back to a JSON file via craftRequestsStore.cjs, same
// pattern as everything else in this pipeline.

async function listCraftRequests() {
  if (proxyClient.isAvailable()) return proxyClient.listCraftRequests();
  return store.load();
}

async function addCraftRequest(requester, profession, description) {
  if (proxyClient.isAvailable()) return proxyClient.addCraftRequest(requester, profession, description);
  return store.add(requester, profession, description);
}

async function fulfillCraftRequest(id, fulfilledBy) {
  if (proxyClient.isAvailable()) return proxyClient.fulfillCraftRequest(id, fulfilledBy);
  return store.fulfill(id, fulfilledBy);
}

async function removeCraftRequest(id) {
  if (proxyClient.isAvailable()) return proxyClient.removeCraftRequest(id);
  return store.remove(id);
}

module.exports = { listCraftRequests, addCraftRequest, fulfillCraftRequest, removeCraftRequest };
