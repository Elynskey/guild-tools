// Thin HTTP client for the API proxy (electron/dataSources on this app's mct-vps
// deployment, see ROADMAP notes) -- the packaged app's only path to real
// WCL/wowaudit/Blizzard data, since a distributed installer never carries the real
// API keys (see .env.proxy / proxyConfig.cjs). Each function mirrors the return shape
// of the direct-fetch orchestrator it's a drop-in branch for.

const { getProxyConfig } = require('./proxyConfig.cjs');

function isAvailable() {
  const { baseUrl, apiKey } = getProxyConfig();
  return !!(baseUrl && apiKey);
}

async function proxyFetch(pathname, options = {}) {
  const { baseUrl, apiKey } = getProxyConfig();
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'X-Proxy-Key': apiKey, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Proxy request to ${pathname} failed: ${res.status} ${res.statusText}`);
  return res;
}

async function proxyFetchJson(pathname, options) {
  const res = await proxyFetch(pathname, options);
  return res.json();
}

async function fetchRoster() {
  return proxyFetchJson('/roster', { method: 'POST' });
}

async function getCachedProfessions() {
  return proxyFetchJson('/professions/cached');
}

// The proxy streams newline-delimited JSON over a chunked response instead of an IPC
// event per progress tick (there's no IPC across an HTTP connection) -- one
// {type:'progress',...} line per tick, then a single {type:'result',...} line.
async function fetchProfessions(onProgress) {
  const res = await proxyFetch('/professions/fetch', { method: 'POST' });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let newlineIdx;
    while ((newlineIdx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, newlineIdx).trim();
      buf = buf.slice(newlineIdx + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.type === 'progress') onProgress?.(msg.progress);
      else if (msg.type === 'result') result = msg.result;
    }
  }
  return result;
}

async function getCachedRecipeCatalogue() {
  return proxyFetchJson('/recipe-catalogue/cached');
}

async function fetchRecipeCatalogue() {
  return proxyFetchJson('/recipe-catalogue/fetch', { method: 'POST' });
}

async function fetchRaidNightsList() {
  return proxyFetchJson('/raid-nights');
}

async function fetchPullFeedback(code) {
  return proxyFetchJson(`/pull-feedback/${encodeURIComponent(code)}`);
}

async function fetchNightSnapshotForCode(code) {
  return proxyFetchJson(`/night-snapshot/${encodeURIComponent(code)}`);
}

async function exchangeAuthCode(code) {
  return proxyFetchJson('/auth/exchange', { method: 'POST', body: JSON.stringify({ code }) });
}

module.exports = {
  isAvailable,
  fetchRoster,
  getCachedProfessions,
  fetchProfessions,
  getCachedRecipeCatalogue,
  fetchRecipeCatalogue,
  fetchRaidNightsList,
  fetchPullFeedback,
  fetchNightSnapshotForCode,
  exchangeAuthCode,
};
