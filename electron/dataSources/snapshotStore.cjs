const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

// Raider.IO's API doesn't track a season's high-water-mark for M+ score or item
// level — it only ever reflects the latest crawl (confirmed against their live
// OpenAPI spec: no "highest"/"peak"/"season_best" field anywhere). We maintain that
// ourselves: every fetch, record the max seen so far per character, persisted to a
// local JSON file in Electron's userData dir (survives restarts, never committed).

function storePath() {
  return path.join(app.getPath('userData'), 'roster-snapshots.json');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return {};
  }
}

function save(store) {
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
}

/**
 * @param {{ name: string, rioCurrent: number, ilvlEquipped: number }[]} characters
 * @returns {Record<string, { rioHighestThisSeason: number, ilvlHighestThisSeason: number }>}
 */
function updateSeasonHighs(characters) {
  const store = load();
  const result = {};
  for (const c of characters) {
    const prev = store[c.name] ?? { rioHighestThisSeason: c.rioCurrent, ilvlHighestThisSeason: c.ilvlEquipped };
    const rioHighestThisSeason = Math.max(prev.rioHighestThisSeason, c.rioCurrent);
    const ilvlHighestThisSeason = Math.max(prev.ilvlHighestThisSeason, c.ilvlEquipped);
    store[c.name] = { rioHighestThisSeason, ilvlHighestThisSeason };
    result[c.name] = { rioHighestThisSeason, ilvlHighestThisSeason };
  }
  save(store);
  return result;
}

module.exports = { updateSeasonHighs };
