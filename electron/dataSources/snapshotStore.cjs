const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Raider.IO's API doesn't track a season's high-water-mark for M+ score or item
// level — it only ever reflects the latest crawl (confirmed against their live
// OpenAPI spec: no "highest"/"peak"/"season_best" field anywhere). We maintain that
// ourselves: every fetch, record the max seen so far per character, persisted to a
// local JSON file in Electron's userData dir (survives restarts, never committed).

function storePath() {
  return path.join(resolveDataDir(), 'roster-snapshots.json');
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
 * Keyed by charKey(name, realm) (see raiderio.cjs), not bare name -- two different
 * real people sharing a character name on different realms would otherwise share
 * (and corrupt) each other's season-high record. Existing installs upgrading from a
 * bare-name-keyed store just start tracking fresh peaks under the new keys; that's a
 * one-time reset of "highest seen so far," not a data-loss concern.
 * @param {{ key: string, rioCurrent: number, ilvlEquipped: number }[]} characters
 * @returns {Record<string, { rioHighestThisSeason: number, ilvlHighestThisSeason: number }>}
 */
function updateSeasonHighs(characters) {
  const store = load();
  const result = {};
  for (const c of characters) {
    const prev = store[c.key] ?? { rioHighestThisSeason: c.rioCurrent, ilvlHighestThisSeason: c.ilvlEquipped };
    const rioHighestThisSeason = Math.max(prev.rioHighestThisSeason, c.rioCurrent);
    const ilvlHighestThisSeason = Math.max(prev.ilvlHighestThisSeason, c.ilvlEquipped);
    store[c.key] = { rioHighestThisSeason, ilvlHighestThisSeason };
    result[c.key] = { rioHighestThisSeason, ilvlHighestThisSeason };
  }
  save(store);
  return result;
}

module.exports = { updateSeasonHighs };
