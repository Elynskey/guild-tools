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

// One key, whichever list it came from. Backfilled keys (mplusBackfill.cjs) have no run
// URL or ID, only dungeon, completion time and level -- identical, to the millisecond,
// to the same key's entry in a profile's run lists (confirmed live), and the same for
// every member of that group, so this is also how guildies' shared keys are matched.
function runKey(run) {
  return `${run.dungeon}|${run.completedAt}|${run.level}`;
}

/**
 * Adds these characters' runs to the archive and returns each one's whole archived
 * season, newest first. Keyed by charKey (see raiderio.cjs). A character whose runs
 * belong to a new season starts over, so last season's keys never mix in. A key seen
 * with its run URL (and so the role/spec played) beats a backfilled copy without one.
 * @param {{ key: string, runs: object[], backfilledAt?: number }[]} characters runs as mapped by raiderio.cjs's mapRun or mplusBackfill.cjs
 * @returns {Record<string, object[]>}
 */
function recordSeasonRuns(characters) {
  const store = load();
  const result = {};
  for (const c of characters) {
    const prev = store[c.key];
    const newest = c.runs.filter((r) => seasonOf(r.url)).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    const season = newest ? seasonOf(newest.url) : prev?.season ?? null;
    if (!season) continue; // backfill before we've ever seen this character's season -- nothing to file it under
    const entry = prev?.season === season ? prev : { season, runs: {} };
    // Re-key on read so an archive written under an older key scheme still dedupes.
    const runs = Object.fromEntries(Object.values(entry.runs).map((r) => [runKey(r), r]));
    for (const r of c.runs) {
      if (r.url && seasonOf(r.url) !== season) continue;
      const k = runKey(r);
      if (r.url || !runs[k]) runs[k] = { ...runs[k], ...r };
    }
    store[c.key] = { season, runs, backfilledAt: c.backfilledAt ?? entry.backfilledAt ?? null };
    result[c.key] = Object.values(runs).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
  fs.writeFileSync(storePath(), JSON.stringify(store));
  return result;
}

/** When this character's season was last backfilled (ms), or null. */
function lastBackfilledAt(key) {
  return load()[key]?.backfilledAt ?? null;
}

module.exports = { recordSeasonRuns, lastBackfilledAt, seasonOf, runKey };
