const store = require('./settingsStore.cjs');
const proxyClient = require('./proxyClient.cjs');

// Settings are officer-wide, not per-install -- when the proxy is available (every
// packaged build) they live server-side so every officer sees and edits the same
// channel IDs. Local dev (no PROXY_BASE_URL) falls back to a JSON file via
// settingsStore.cjs, same pattern as craft requests and loot records.

async function getSettings() {
  if (proxyClient.isAvailable()) return proxyClient.getSettings();
  return store.load();
}

async function saveSettings(settings) {
  if (proxyClient.isAvailable()) return proxyClient.saveSettings(settings);
  return store.save(settings);
}

module.exports = { getSettings, saveSettings };
