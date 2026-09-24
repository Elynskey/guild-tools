const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');
const { fetchCharacterProfile, charKey } = require('./raiderio.cjs');
const { recordSeasonRuns, getArchivedRuns } = require('./mplusRunArchive.cjs');
const { backfillSeason } = require('./mplusBackfill.cjs');
const { resolveMainName } = require('./altGroups.cjs');

// M+ Comp's pool: every guild member who has run a key this season -- not just the raid
// roster. Raider.IO lists the guild (528 characters) without scores, so each one needs its
// own profile request. Measured 2026-09-23: 307 members seen by Raider.IO in the last three
// months, 80 of them with keys this season, ~4 minutes paced. So this runs in the
// background, at most every REFRESH_MS, and serves the last result from a file meanwhile.
// Their keys go through the same season archive + backfill as the raid roster's.

const BASE = 'https://raider.io/api/v1';
const REFRESH_MS = 12 * 60 * 60 * 1000;
const ACTIVE_WITHIN_MS = 90 * 24 * 60 * 60 * 1000;
const PACE_MS = 300;

let refreshing = null;

function cachePath() {
  return path.join(resolveDataDir(), 'mplus-guild.json');
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf8'));
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only what M+ Comp needs; runs are added from the archive when served.
function slim(p) {
  return {
    key: p.key,
    name: p.name,
    realm: p.realm,
    class: p.class,
    spec: p.spec,
    role: p.role,
    rioCurrent: p.rioCurrent,
    mythicPlusSeasonKeys: p.mythicPlusSeasonKeys,
    person: resolveMainName(p.name),
  };
}

function withRuns(c) {
  return { ...c, mythicPlusSeasonRuns: getArchivedRuns(c.key) };
}

/** Rebuilds the list of guild members with keys this season. Resolves when done. */
async function refreshGuildKeyers(guild, { now = Date.now, paceMs = PACE_MS, logger = console } = {}) {
  const url = `${BASE}/guilds/profile?region=${guild.region}&realm=${encodeURIComponent(guild.realm)}&name=${encodeURIComponent(guild.name)}&fields=members`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Raider.IO guild fetch failed: ${res.status}`);
  const members = (await res.json()).members ?? [];
  const cutoff = new Date(now() - ACTIVE_WITHIN_MS).toISOString();
  const active = members.filter((m) => (m.character?.last_crawled_at ?? '') >= cutoff);

  const keyers = [];
  for (const m of active) {
    try {
      const p = await fetchCharacterProfile(guild.region, m.character.realm, m.character.name);
      if (p.mythicPlusSeasonKeys > 0) keyers.push(p);
    } catch (err) {
      logger.warn(`[mplusGuild] ${m.character.name}: ${err.message}`);
    }
    await sleep(paceMs);
  }
  recordSeasonRuns(keyers.map((p) => ({ key: p.key, runs: p.mythicPlusSeasonRuns })));
  fs.writeFileSync(cachePath(), JSON.stringify({ at: now(), checked: active.length, characters: keyers.map(slim) }));
  logger.log(`[mplusGuild] ${keyers.length} of ${active.length} active guild characters have keys this season.`);
  // Then fill in their older keys (daily per character, see mplusBackfill.cjs).
  await backfillSeason(guild.region, keyers, { now, logger });
  return keyers.length;
}

function startRefresh(guild) {
  if (refreshing) return;
  refreshing = refreshGuildKeyers(guild)
    .catch((err) => console.error('[mplusGuild] refresh failed:', err))
    .finally(() => {
      refreshing = null;
    });
}

/**
 * Guild members with keys this season, with their archived runs. Serves the last saved
 * list straight away and refreshes it in the background when it's stale or missing.
 * @returns {{ at: number | null, refreshing: boolean, characters: object[] }}
 */
function getGuildKeyers(guild, { now = Date.now } = {}) {
  const cache = loadCache();
  if (!cache || now() - cache.at > REFRESH_MS) startRefresh(guild);
  return { at: cache?.at ?? null, refreshing: !!refreshing, characters: (cache?.characters ?? []).map(withRuns) };
}

/**
 * One character typed in by an officer, from any guild or none: their profile, season
 * keys (backfilled now, ~8 requests) and alt owner. Null if Raider.IO doesn't know them.
 */
async function lookupCharacter(region, realm, name) {
  let p;
  try {
    p = await fetchCharacterProfile(region, realm, name);
  } catch {
    return null;
  }
  recordSeasonRuns([{ key: p.key, runs: p.mythicPlusSeasonRuns }]);
  await backfillSeason(region, [p]);
  return withRuns(slim(p));
}

module.exports = { getGuildKeyers, refreshGuildKeyers, lookupCharacter, charKey };
