const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');

// Persisted crafting-request board. Same JSON-file-in-DATA_DIR pattern as
// professionsCache.cjs/recipeCatalogueCache.cjs -- this file runs unmodified both as
// part of the Electron app's local (non-proxy) fallback and as part of the API proxy
// server, where it's the shared, officer-wide store (see craftRequests.cjs's
// proxy-vs-local branch for which mode is active).

function storePath() {
  return path.join(resolveDataDir(), 'craft-requests.json');
}

/** @returns {import('../../src/professions/types').CraftRequest[]} */
function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return [];
  }
}

function save(requests) {
  fs.writeFileSync(storePath(), JSON.stringify(requests, null, 2));
}

function add(requester, profession, description) {
  const requests = load();
  const entry = { id: crypto.randomUUID(), requester, profession, description, createdAt: new Date().toISOString(), fulfilled: false };
  requests.unshift(entry);
  save(requests);
  return requests;
}

function toggleFulfilled(id) {
  const requests = load();
  const next = requests.map((r) => (r.id === id ? { ...r, fulfilled: !r.fulfilled } : r));
  save(next);
  return next;
}

function remove(id) {
  const requests = load().filter((r) => r.id !== id);
  save(requests);
  return requests;
}

module.exports = { load, add, toggleFulfilled, remove };
