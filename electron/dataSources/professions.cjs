// Professions data — Blizzard Battle.net Game Data API, same OAuth client as bnet.cjs.
// Verified live: guild roster endpoint returns { character: {name, realm.slug, ...}, rank }
// for the WHOLE guild (hundreds of members, not just the raid-tracked roster); character
// summary includes a real last_login_timestamp (ms epoch); the professions endpoint
// returns primaries[]/secondaries[] with tiers[] (skill_points/max_skill_points) and
// known_recipes[] per tier — all confirmed against real characters.
//
// This intentionally does NOT use wowaudit's roster — wowaudit only tracks the raid
// team (~28 characters); professions should cover the whole active guild.
//
// Account grouping (which characters belong to the same real person) is NOT available
// from any API — that requires each player's personal OAuth consent (Blizzard's
// Account API), which an app-only credential can't get. See altGroups.cjs for the
// officer-maintained mapping this uses instead.

const { getClientCredentialsToken } = require('./oauth.cjs');
const { slugifyRealm } = require('./raiderio.cjs');
const { resolveMainName } = require('./altGroups.cjs');

const TOKEN_URL = 'https://oauth.battle.net/token';
const ACTIVE_WITHIN_DAYS = 30;
// Blizzard's documented per-client limit is 100 req/sec; 8 was leaving most of that
// headroom unused and made a ~2000-request full-guild scan take several minutes.
const CONCURRENCY = 20;
const MAX_RETRIES = 3;

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.BNET_CLIENT_ID, process.env.BNET_CLIENT_SECRET);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A full scan is ~2000 requests (roster + one summary + one professions call per active
// character). Confirmed live that bursting this fires scattered transient failures
// (a 404 rate way out of line with spot-checking the same characters individually) —
// retry with backoff rather than treating every transient blip as "character not found".
async function bnetGet(region, pathAndQuery, attempt = 1) {
  const token = await getToken();
  const res = await fetch(`https://${region}.api.blizzard.com${pathAndQuery}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) return res.json();
  if (attempt < MAX_RETRIES && (res.status === 404 || res.status === 429 || res.status >= 500)) {
    await sleep(300 * attempt);
    return bnetGet(region, pathAndQuery, attempt + 1);
  }
  throw new Error(`Battle.net request failed (${pathAndQuery}): ${res.status} ${res.statusText}`);
}

async function fetchGuildRoster(guild) {
  const guildSlug = guild.name.toLowerCase().replace(/\s+/g, '-');
  const realmSlug = slugifyRealm(guild.realm);
  const data = await bnetGet(guild.region, `/data/wow/guild/${realmSlug}/${guildSlug}/roster?namespace=profile-${guild.region}&locale=en_US`);
  return data.members.map((m) => ({ name: m.character.name, realm: m.character.realm.slug }));
}

async function fetchCharacterSummary(region, realmSlug, name) {
  return bnetGet(region, `/profile/wow/character/${realmSlug}/${name.toLowerCase()}?namespace=profile-${region}&locale=en_US`);
}

async function fetchCharacterProfessions(region, realmSlug, name) {
  return bnetGet(region, `/profile/wow/character/${realmSlug}/${name.toLowerCase()}/professions?namespace=profile-${region}&locale=en_US`);
}

function parseProfessionBlock(list) {
  return (list ?? []).map((p) => ({
    profession: p.profession.name,
    tiers: (p.tiers ?? []).map((t) => ({
      tierName: t.tier.name,
      skillPoints: t.skill_points ?? 0,
      maxSkillPoints: t.max_skill_points ?? 0,
      knownRecipes: (t.known_recipes ?? []).map((r) => r.name),
    })),
  }));
}

/** Runs async `fn` over `items` with bounded concurrency, tolerating individual failures. */
async function mapConcurrent(items, limit, fn, onProgress) {
  const results = [];
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err) {
        results[idx] = { error: err };
      }
      done++;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * @param {{ name: string, realm: string, region: string }} guild
 * @param {(progress: { phase: 'activity'|'professions', done: number, total: number }) => void} [onProgress]
 * @returns {Promise<Array<{ mainName: string, characters: Array<{characterName, realm, class, lastLoginDaysAgo, professions}> }>>}
 */
async function fetchActiveMembersWithProfessions(guild, onProgress) {
  const roster = await fetchGuildRoster(guild);
  console.log(`[professions] Guild roster: ${roster.length} total members. Checking last-login for each (this takes a while)...`);

  const summaries = await mapConcurrent(
    roster,
    CONCURRENCY,
    async (m) => {
      const summary = await fetchCharacterSummary(guild.region, m.realm, m.name);
      return { ...m, summary };
    },
    (done, total) => onProgress?.({ phase: 'activity', done, total }),
  );

  const now = Date.now();
  const failed = summaries.filter((s) => s.error);
  if (failed.length > 0) {
    console.warn(`[professions] ${failed.length} of ${roster.length} summary fetches failed (rate limit or transient error) — example:`, failed[0].error?.message);
  }
  const active = summaries.filter((s) => {
    if (s.error || !s.summary?.last_login_timestamp) return false;
    const daysAgo = (now - s.summary.last_login_timestamp) / 86_400_000;
    return daysAgo <= ACTIVE_WITHIN_DAYS;
  });
  console.log(`[professions] ${active.length} of ${roster.length} members active in the last ${ACTIVE_WITHIN_DAYS} days.`);

  const withProfessions = await mapConcurrent(
    active,
    CONCURRENCY,
    async (m) => {
      const profData = await fetchCharacterProfessions(guild.region, m.realm, m.name);
      const professions = [...parseProfessionBlock(profData.primaries), ...parseProfessionBlock(profData.secondaries)];
      return {
        characterName: m.name,
        realm: m.summary.realm?.name ?? m.realm,
        class: m.summary.character_class?.name ?? 'Unknown',
        lastLoginDaysAgo: Math.round((now - m.summary.last_login_timestamp) / 86_400_000),
        professions,
      };
    },
    (done, total) => onProgress?.({ phase: 'professions', done, total }),
  );

  const characters = withProfessions.filter((c) => !c.error);

  // Group by officer-maintained alt mapping.
  const byMain = new Map();
  for (const c of characters) {
    const mainName = resolveMainName(c.characterName);
    if (!byMain.has(mainName)) byMain.set(mainName, []);
    byMain.get(mainName).push(c);
  }

  return [...byMain.entries()].map(([mainName, chars]) => ({ mainName, characters: chars }));
}

module.exports = { fetchActiveMembersWithProfessions, fetchGuildRoster };
