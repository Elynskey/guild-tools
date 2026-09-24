// Raider.IO public REST API — no auth required (confirmed: no securityDefinitions
// in their live OpenAPI spec). Provides M+ score, item level equipped, class/spec/role.
// Does NOT track a season high-water-mark for either score or ilvl — see snapshotStore.cjs.
//
// IMPORTANT: this module does NOT determine roster membership. A guild's Raider.IO
// roster includes every character in the guild (alts, socials, inactive members —
// confirmed 526 members for a guild whose actual raid team is ~30), which is both
// the wrong scope and would blow past the ~200req/min rate limit. The caller must
// supply the character name list (from wowaudit's team roster — see wowaudit.cjs).

const { updateSeasonHighs } = require('./snapshotStore.cjs');
const { recordSeasonRuns, runKey } = require('./mplusRunArchive.cjs');

const BASE = 'https://raider.io/api/v1';

// Blizzard realm-slug rules: lowercase, spaces -> hyphens, strip apostrophes.
function slugifyRealm(realm) {
  return realm
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\s+/g, '-');
}

// A name alone isn't a safe key across this pipeline -- confirmed live this session
// that two different real guild members can share a character name on different
// realms (the "Dunbarke" incident: wowaudit had the wrong realm for one of them,
// and every name-only join downstream would have silently pulled the OTHER
// person's RIO/gear data under the right name). This composite key is what
// fetchRoster.cjs/merge.cjs use everywhere a character needs to be looked up
// unambiguously; WCL's own tables are the one exception -- see the long comment in
// fetchRoster.cjs about why those still key by bare name.
function charKey(name, realm) {
  return `${name}::${slugifyRealm(realm)}`;
}

// Raider.IO's active_spec_role is uppercase ('TANK'|'HEALING'|'DPS'); our Raider type wants lowercase.
const ROLE_MAP = { TANK: 'tank', HEALING: 'healer', DPS: 'dps' };

// realm here is the CHARACTER's own realm, not necessarily the guild's — connected-realm
// guilds can have members whose characters live on a different (linked) realm. wowaudit's
// roster carries each character's real realm; using the guild's realm for everyone 404s/400s
// for anyone not actually on it (confirmed live — e.g. a member found on "Argent Dawn").
// Real shape confirmed live against this guild's own roster: an array of run objects,
// newest first, capped at the 10 most recent -- {dungeon, short_name, mythic_level,
// completed_at, score, num_keystone_upgrades, icon_url, url, spec, role, ...}. Trimmed
// down to just what the app actually shows. spec/role are what the character played IN
// that key (confirmed live: a raid tank keying as Havoc, a raid healer's active spec
// reading Elemental while 7 of their last 10 keys were Restoration) -- the M+ Comp
// screen uses these, not the raid role.
function mapRun(run) {
  const mapped = {
    dungeon: run.dungeon,
    level: run.mythic_level,
    completedAt: run.completed_at,
    score: run.score,
    upgrades: run.num_keystone_upgrades,
    iconUrl: run.icon_url,
    url: run.url,
    spec: run.spec?.name ?? null,
    // Per-run role is already lowercase ('tank'|'healer'|'dps'), unlike active_spec_role.
    role: ['tank', 'healer', 'dps'].includes(run.role) ? run.role : null,
  };
  return { id: runKey(mapped), ...mapped };
}

// Every run list a profile offers, so a key shows up if it's recent, a dungeon best or
// alternate, among the highest, or among this/last week's highest -- one request either
// way. Still not every key (see mplusRunArchive.cjs); run counts gives the true total.
const SEASON_RUN_FIELDS = [
  'mythic_plus_recent_runs',
  'mythic_plus_best_runs',
  'mythic_plus_alternate_runs',
  'mythic_plus_highest_level_runs',
  'mythic_plus_weekly_highest_level_runs',
  'mythic_plus_previous_weekly_highest_level_runs',
];

async function fetchCharacterProfile(region, realm, name) {
  const fields = [
    'mythic_plus_scores_by_season:current',
    'gear',
    'mythic_plus_recent_runs',
    'mythic_plus_best_runs:all',
    'mythic_plus_alternate_runs:all',
    'mythic_plus_highest_level_runs',
    'mythic_plus_weekly_highest_level_runs',
    'mythic_plus_previous_weekly_highest_level_runs',
    'mythic_plus_dungeon_run_counts',
  ].join(',');
  const url = `${BASE}/characters/profile?region=${region}&realm=${slugifyRealm(realm)}&name=${encodeURIComponent(name)}&fields=${encodeURIComponent(fields)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Raider.IO character fetch failed for ${name}-${realm}: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const seasonRuns = new Map();
  for (const field of SEASON_RUN_FIELDS) for (const run of data[field] ?? []) if (run.url) seasonRuns.set(run.url, mapRun(run));
  const counts = data.mythic_plus_dungeon_run_counts;
  // One real key per dungeon they've run -- run-review (mplusBackfill.cjs) needs one to
  // ask about, and it carries the dungeon's par time for working out chests.
  const dungeonRefs = (data.mythic_plus_best_runs ?? []).map((r) => ({
    zoneId: r.zone_id,
    dungeon: r.dungeon,
    level: r.mythic_level,
    clearTimeMs: r.clear_time_ms,
    completedAt: r.completed_at,
    parTimeMs: r.par_time_ms,
    iconUrl: r.icon_url,
  }));
  return {
    key: charKey(name, realm),
    name: data.name,
    realm,
    class: data.class,
    spec: data.active_spec_name,
    role: ROLE_MAP[data.active_spec_role] ?? 'dps',
    rioCurrent: data.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0,
    ilvlEquipped: data.gear?.item_level_equipped ?? 0,
    mythicPlusRuns: (data.mythic_plus_recent_runs ?? []).map(mapRun),
    mythicPlusSeasonRuns: [...seasonRuns.values()],
    // Raider.IO's own count of every key they've done this season -- how many the archive should end up holding.
    dungeonRefs,
    mythicPlusSeasonKeys: Array.isArray(counts) ? counts.reduce((sum, d) => sum + (d.season_runs_total ?? 0), 0) : null,
  };
}

/**
 * @param {{ name: string, realm: string, region: string }} guild — guild.region is used for every character; guild.realm is only the default/fallback
 * @param {Array<{ name: string, realm?: string }>} characters — the raid team's roster (from wowaudit), NOT the full guild
 * @returns {Promise<Array<{ key, name, realm, class, spec, role, rioCurrent, rioHighestThisSeason, ilvlEquipped, ilvlHighestThisSeason, mythicPlusRuns, mythicPlusSeasonRuns, mythicPlusSeasonKeys }>>} keyed by charKey(name, realm) via the `key` field -- see the comment on charKey for why bare name isn't safe to join on
 */
async function fetchRaiderIO(guild, characters) {
  const withScores = await Promise.all(characters.map((c) => fetchCharacterProfile(guild.region, c.realm || guild.realm, c.name)));

  const highs = updateSeasonHighs(withScores);
  const archived = recordSeasonRuns(withScores.map((m) => ({ key: m.key, runs: m.mythicPlusSeasonRuns })));

  return withScores.map((m) => ({
    ...m,
    mythicPlusSeasonRuns: archived[m.key] ?? m.mythicPlusSeasonRuns,
    rioHighestThisSeason: highs[m.key]?.rioHighestThisSeason ?? m.rioCurrent,
    ilvlHighestThisSeason: highs[m.key]?.ilvlHighestThisSeason ?? m.ilvlEquipped,
  }));
}

module.exports = { fetchRaiderIO, fetchCharacterProfile, slugifyRealm, charKey };
