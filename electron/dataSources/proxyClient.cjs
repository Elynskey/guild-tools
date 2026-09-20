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

// X-Guild-Tools-Mode is only ever consulted by the proxy's raid-signups/gotm routes
// (see server.cjs) -- harmless to send on every request. A "Guild Tools (Test)" build
// (or GUILD_TOOLS_TEST_MODE=1 for local dev) is the only way this is ever 'test'; a
// normal install always sends 'prod', same as if this header didn't exist at all.
async function proxyFetch(pathname, options = {}) {
  const { baseUrl, apiKey, testMode } = getProxyConfig();
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      'X-Proxy-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Guild-Tools-Mode': testMode ? 'test' : 'prod',
      ...(options.headers ?? {}),
    },
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

async function fulfillCraftRequest(id, fulfilledBy) {
  return proxyFetchJson(`/craft-requests/${encodeURIComponent(id)}/toggle`, { method: 'PATCH', body: JSON.stringify({ fulfilledBy }) });
}

async function removeCraftRequest(id) {
  return proxyFetchJson(`/craft-requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function listRaidSignups() {
  return proxyFetchJson('/raid-signups');
}

async function getRaidSignup(id) {
  return proxyFetchJson(`/raid-signups/${encodeURIComponent(id)}`);
}

async function createRaidSignup(raidName, teamType, signupText, channelId) {
  return proxyFetchJson('/raid-signups', { method: 'POST', body: JSON.stringify({ raidName, teamType, signupText, channelId }) });
}

async function setRaidSignupAssignments(id, assignments) {
  return proxyFetchJson(`/raid-signups/${encodeURIComponent(id)}/assignments`, { method: 'PUT', body: JSON.stringify({ assignments }) });
}

async function finalizeRaidSignup(id) {
  return proxyFetchJson(`/raid-signups/${encodeURIComponent(id)}/finalize`, { method: 'POST' });
}

async function listGotmPosts() {
  return proxyFetchJson('/gotm');
}

async function getGotmPost(id) {
  return proxyFetchJson(`/gotm/${encodeURIComponent(id)}`);
}

async function getCurrentGotmPost() {
  return proxyFetchJson('/gotm/current');
}

async function createGotmPost(openedBy, introText) {
  return proxyFetchJson('/gotm', { method: 'POST', body: JSON.stringify({ openedBy, introText }) });
}

async function remindGotmVoters(id, reminderText) {
  return proxyFetchJson(`/gotm/${encodeURIComponent(id)}/remind`, { method: 'POST', body: JSON.stringify({ reminderText }) });
}

// officerTieBreak: a tie leaves the vote pending for an officer to pick, instead of the proxy's old random draw.
async function closeGotmVoting(id, officerTieBreak = false) {
  return proxyFetchJson(`/gotm/${encodeURIComponent(id)}/close`, { method: 'POST', body: JSON.stringify({ officerTieBreak }) });
}

async function chooseGotmTieWinner(id, nomineeId, chosenBy) {
  return proxyFetchJson(`/gotm/${encodeURIComponent(id)}/tiebreak`, { method: 'POST', body: JSON.stringify({ nomineeId, chosenBy }) });
}

async function announceGotmWinner(id, winnerAnnounceText) {
  return proxyFetchJson(`/gotm/${encodeURIComponent(id)}/announce`, { method: 'POST', body: JSON.stringify({ winnerAnnounceText }) });
}

async function getItemIconUrls(itemIds) {
  return proxyFetchJson('/item-icons', { method: 'POST', body: JSON.stringify({ itemIds }) });
}

async function getBossLootTable() {
  return proxyFetchJson('/boss-loot-table');
}

async function addManualLootRecord(record) {
  return proxyFetchJson('/loot-records/manual', { method: 'POST', body: JSON.stringify(record) });
}

async function updateLootRecord(id, patch) {
  return proxyFetchJson(`/loot-records/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

async function removeLootRecord(id) {
  return proxyFetchJson(`/loot-records/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function removeLootTrade(id) {
  return proxyFetchJson(`/loot-trades/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function deleteLootNight(startTime, endTime) {
  return proxyFetchJson('/loot-records/delete-night', { method: 'POST', body: JSON.stringify({ startTime, endTime }) });
}

async function getSettings() {
  return proxyFetchJson('/settings');
}

async function saveSettings(settings) {
  return proxyFetchJson('/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

async function getSharedLootRecords() {
  return proxyFetchJson('/loot-records');
}

async function syncLootRecords(records, trades, needLosses) {
  return proxyFetchJson('/loot-records/sync', { method: 'POST', body: JSON.stringify({ records, trades, needLosses }) });
}

async function postLootNightToDiscord(messages) {
  return proxyFetchJson('/loot-records/post-night', { method: 'POST', body: JSON.stringify({ messages }) });
}

async function sendLootCaptureHeartbeat(officerName, chatLogActive, chatLogSizeBytes) {
  return proxyFetchJson('/loot-capture/heartbeat', { method: 'POST', body: JSON.stringify({ officerName, chatLogActive, chatLogSizeBytes }) });
}

async function getLootCaptureHeartbeats() {
  return proxyFetchJson('/loot-capture/heartbeats');
}

async function sendFeedback(payload) {
  return proxyFetchJson('/feedback', { method: 'POST', body: JSON.stringify(payload) });
}

async function trackAnalyticsEvent(payload) {
  return proxyFetchJson('/analytics', { method: 'POST', body: JSON.stringify(payload) });
}

async function listAnalyticsEvents() {
  return proxyFetchJson('/analytics');
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
  fulfillCraftRequest,
  removeCraftRequest,
  getSharedLootRecords,
  syncLootRecords,
  postLootNightToDiscord,
  sendLootCaptureHeartbeat,
  getLootCaptureHeartbeats,
  getSettings,
  saveSettings,
  listRaidSignups,
  getRaidSignup,
  createRaidSignup,
  setRaidSignupAssignments,
  finalizeRaidSignup,
  listGotmPosts,
  getGotmPost,
  getCurrentGotmPost,
  createGotmPost,
  remindGotmVoters,
  closeGotmVoting,
  chooseGotmTieWinner,
  announceGotmWinner,
  getItemIconUrls,
  getBossLootTable,
  addManualLootRecord,
  updateLootRecord,
  removeLootRecord,
  removeLootTrade,
  deleteLootNight,
  sendFeedback,
  trackAnalyticsEvent,
  listAnalyticsEvents,
};
