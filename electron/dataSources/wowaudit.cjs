// wowaudit REST API, API-key auth. Base host confirmed live (nucleus.wowaudit.com
// returns 401 rather than 404 for unauthenticated /v1/team, matching their embedded
// OpenAPI spec's documented paths).
//
// Role in this pipeline: NOT gear/enchant/gem data — verified their public API
// doesn't expose that at all (grepped their full spec, zero matches). What it DOES
// give us that nothing else does: the actual raid-team roster (character list +
// role + rank), scoped to one team via the API key. Raider.IO's guild endpoint
// returns the whole guild (hundreds of alts/socials); wowaudit's /v1/characters is
// the real "who are our 30 raiders" source.
//
// Auth header format is unconfirmed against a real key (OpenAPI type is `apiKey` in
// the `Authorization` header, which suggests the raw key, not `Bearer <key>` — try
// raw first; if wowaudit rejects it, switch to the Bearer-prefixed variant below).

const BASE = 'https://nucleus.wowaudit.com/v1';

async function wowauditGet(pathname) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { Authorization: process.env.WOWAUDIT_API_KEY },
  });
  if (!res.ok) throw new Error(`wowaudit fetch failed for ${pathname}: ${res.status} ${res.statusText}`);
  return res.json();
}

// wowaudit's role values ('Melee'|'Ranged'|'Heal'|'Tank') don't map 1:1 to our
// Role type — Melee/Ranged are both 'dps' here (perf-column semantics are the same
// for both; the design only distinguishes tank/healer/dps).
const ROLE_MAP = { Tank: 'tank', Heal: 'healer', Melee: 'dps', Ranged: 'dps' };

/**
 * @returns {Promise<Array<{ name: string, role: 'tank'|'healer'|'dps', rank: string }>>}
 */
async function fetchWowauditRoster() {
  const team = await wowauditGet('/team');
  if (process.env.WOWAUDIT_TEAM_ID && String(team.id) !== String(process.env.WOWAUDIT_TEAM_ID)) {
    console.warn(`[wowaudit] WOWAUDIT_TEAM_ID (${process.env.WOWAUDIT_TEAM_ID}) doesn't match the API key's team (${team.id}) — using the key's team.`);
  }

  const characters = await wowauditGet('/characters');
  return characters
    .filter((c) => c.status === 'tracking')
    .map((c) => ({
      name: c.name,
      realm: c.realm, // NOT necessarily the guild's own realm — connected-realm guilds can have members on other realms
      role: ROLE_MAP[c.role] ?? 'dps',
      rank: c.rank,
    }));
}

/** Kept separate from fetchWowauditRoster so fetchRoster.cjs can call the specific piece it needs. */
async function fetchWowaudit() {
  return fetchWowauditRoster();
}

module.exports = { fetchWowaudit, fetchWowauditRoster };
