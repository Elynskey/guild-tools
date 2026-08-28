const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// A full professions scan is ~2000 Battle.net requests across the whole guild
// roster (hundreds of members) -- multiple minutes even with retries succeeding.
// Cache the last successful scan to disk so the app can paint instantly on
// launch instead of blocking on a full rescan every time; the officer-triggered
// refresh button (or an empty cache) is what actually re-scans live.

function storePath() {
  return path.join(resolveDataDir(), 'professions-cache.json');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return null;
  }
}

function save(result) {
  fs.writeFileSync(storePath(), JSON.stringify(result, null, 2));
}

module.exports = { load, save };
