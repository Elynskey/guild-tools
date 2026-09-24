const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Raider.IO has no "every key this season" endpoint -- a profile only lists recent,
// best-per-dungeon, alternate, highest-level and this/last week's highest keys, which
// together covered 41% of this roster's season keys when measured (371 of 901,
// 2026-09-23). The keys in between are never listed again once they drop out of
// "recent". So every key we see is kept here, and coverage grows toward complete as the
// season goes on. Same local-JSON approach as snapshotStore.cjs (userData in the app,
// DATA_DIR on the proxy).

function storePath() {
  return path.join(resolveDataDir(), 'mplus-season-runs.json');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return {};
  }
}

// Run URLs carry the season: https://raider.io/mythic-plus-runs/season-mn-2/13972638-11-ruby-life-pools
function seasonOf(url) {
  return /\/mythic-plus-runs\/([^/]+)\//.exec(url ?? '')?.[1] ?? null;
}

/**
 * Adds these characters' runs to the archive and returns each one's whole archived
 * season, newest first. Keyed by charKey (see raiderio.cjs). A character whose runs
 * belong to a new season starts over, so last season's keys never mix in.
 * @param {{ key: string, runs: object[] }[]} characters runs as mapped by raiderio.cjs's mapRun
 * @returns {Record<string, object[]>}
 */
function recordSeasonRuns(characters) {
  const store = load();
  const result = {};
  for (const c of characters) {
    const withUrl = c.runs.filter((r) => seasonOf(r.url));
    const newest = [...withUrl].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    const season = newest ? seasonOf(newest.url) : store[c.key]?.season ?? null;
    const entry = store[c.key]?.season === season ? store[c.key] : { season, runs: {} };
    for (const r of withUrl) if (seasonOf(r.url) === season) entry.runs[r.url] = r;
    store[c.key] = entry;
    result[c.key] = Object.values(entry.runs).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
  fs.writeFileSync(storePath(), JSON.stringify(store));
  return result;
}

module.exports = { recordSeasonRuns, seasonOf };
