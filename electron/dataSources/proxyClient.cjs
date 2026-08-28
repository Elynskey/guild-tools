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

// Not a plain proxyFetchJson call -- a 403 with {error:'not_a_member'} (none of the
// account's characters are on the CRD roster) needs to reach the caller as a
// distinguishable error, not the generic "request failed" text proxyFetch() throws on
// any non-2xx status.
async function exchangeAuthCode(code) {
  const { baseUrl, apiKey } = getProxyConfig();
  const res = await fetch(`${baseUrl}/auth/exchange`, {
    method: 'POST',
    headers: { 'X-Proxy-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error === 'not_a_member' ? 'None of your Battle.net account\'s characters are on the Casual Raid Days roster.' : `Proxy sign-in exchange failed: ${res.status} ${res.statusText}`);
    if (body.error === 'not_a_member') err.code = 'not_a_member';
    throw err;
  }
  return body;
}

// Not a plain proxyFetchJson call -- a 403 with {error:'not_a_member'} needs to reach
// the caller as a distinguishable error (see discordAuth.cjs), not the generic
// "request failed" text proxyFetch() throws on any non-2xx status.
async function exchangeDiscordAuthCode(code) {
  const { baseUrl, apiKey } = getProxyConfig();
  const res = await fetch(`${baseUrl}/auth/discord/exchange`, {
    method: 'POST',
    headers: { 'X-Proxy-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error === 'not_a_member' ? 'That Discord account isn\'t a member of the Casual Raid Days server.' : `Proxy sign-in exchange failed: ${res.status} ${res.statusText}`);
    if (body.error === 'not_a_member') err.code = 'not_a_member';
    throw err;
  }
  return body;
}

async function listCraftRequests() {
  return proxyFetchJson('/craft-requests');
}

async function addCraftRequest(requester, profession, description) {
  return proxyFetchJson('/craft-requests', { method: 'POST', body: JSON.stringify({ requester, profession, description }) });
}

async function toggleCraftRequestFulfilled(id) {
  return proxyFetchJson(`/craft-requests/${encodeURIComponent(id)}/toggle`, { method: 'PATCH' });
}

async function removeCraftRequest(id) {
  return proxyFetchJson(`/craft-requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
  exchangeDiscordAuthCode,
  listCraftRequests,
  addCraftRequest,
  toggleCraftRequestFulfilled,
  removeCraftRequest,
};
