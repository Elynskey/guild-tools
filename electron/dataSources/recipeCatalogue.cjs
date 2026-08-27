// Recipe catalogue — Blizzard's Profession Game Data API (static namespace, NOT the
// profile-{region} namespace professions.cjs/bnet.cjs use for character data — this is
// guild-independent reference data: which recipes EXIST, not who knows them).
//
// Endpoints (standard Blizzard Game Data API, same OAuth client as the rest of this app):
//   GET /data/wow/profession/index                              -> { professions: [{id, name}] }
//   GET /data/wow/profession/{id}                                -> { skill_tiers: [{id, name}] }
//   GET /data/wow/profession/{id}/skill-tier/{tierId}            -> { categories: [{ recipes: [{id, name}] }] }
//
// Tier `name` comes back in the same "<Expansion> <Profession>" format character-side tier
// names already use (e.g. "Khaz Algar Blacksmithing") — confirmed live for character
// professions in professions.cjs; stripping the profession name off it the same way
// src/professions/expansions.ts's deriveExpansionLabel does gives the expansion label.

const { getClientCredentialsToken } = require('./oauth.cjs');

// Mirrors src/professions/professionCatalog.ts's ALL_PROFESSIONS -- duplicated rather than
// imported because the Electron main process runs these .cjs files directly (no build step),
// so it can't require a .ts source file from src/. Keep the two lists in sync by hand.
const ALL_PROFESSIONS = ['Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Inscription', 'Jewelcrafting', 'Leatherworking', 'Tailoring', 'Herbalism', 'Mining', 'Skinning'];

const TOKEN_URL = 'https://oauth.battle.net/token';
const MAX_RETRIES = 3;
const CONCURRENCY = 10;

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.BNET_CLIENT_ID, process.env.BNET_CLIENT_SECRET);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function staticGet(region, pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  return bnetGet(region, `${pathAndQuery}${sep}namespace=static-${region}&locale=en_US`);
}

/** Same stripping rule as src/professions/expansions.ts's deriveExpansionLabel. */
function deriveExpansionLabel(tierName, profession) {
  const stripped = tierName.replace(profession, '').trim();
  return stripped || tierName;
}

async function mapConcurrent(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err) {
        results[idx] = { error: err };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * @param {string} region
 * @returns {Promise<import('../../src/professions/types').RecipeCatalogue>}
 */
async function fetchRecipeCatalogue(region) {
  const index = await staticGet(region, '/data/wow/profession/index');
  const tracked = index.professions.filter((p) => ALL_PROFESSIONS.includes(p.name));

  const catalogue = {};

  await mapConcurrent(tracked, CONCURRENCY, async (prof) => {
    const detail = await staticGet(region, `/data/wow/profession/${prof.id}`);
    const tiers = detail.skill_tiers ?? [];

    const byExpansion = {};
    const tierResults = await mapConcurrent(tiers, CONCURRENCY, async (tier) => {
      const tierData = await staticGet(region, `/data/wow/profession/${prof.id}/skill-tier/${tier.id}`);
      const recipes = (tierData.categories ?? []).flatMap((c) => (c.recipes ?? []).map((r) => r.name));
      return { expansion: deriveExpansionLabel(tier.name, prof.name), recipes };
    });

    for (const t of tierResults) {
      if (t?.error) continue;
      byExpansion[t.expansion] = [...(byExpansion[t.expansion] ?? []), ...t.recipes];
    }
    catalogue[prof.name] = byExpansion;
  });

  return catalogue;
}

module.exports = { fetchRecipeCatalogue, deriveExpansionLabel };
