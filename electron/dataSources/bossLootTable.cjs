// Boss loot tables for the smarter "Add loot entry" form -- Blizzard's Game Data
// Journal/Item APIs, same OAuth client-credentials pattern as bnet.cjs/itemIcons.cjs.
// Verified live against real calls this tier (Midnight Season 2):
//   - journal-instance/index -> .instances[]: this tier's two raids are id 1317
//     ("The Tidebound Grotto") and id 1320 ("The Venomous Abyss"), confirmed real.
//   - journal-instance/{id} -> .encounters[]: {id, name} pairs, confirmed real --
//     boss names match this app's other hand-maintained tier references (bossIcons.ts,
//     mechanicReference.cjs) exactly.
//   - journal-encounter/{id} -> .items[]: {id, item: {id, name, key}} -- item name is
//     directly available, no extra fetch needed, confirmed real.
//   - /data/wow/item/{id} -> inventory_type.name gives the slot directly (e.g.
//     "Trinket"), and item_class.name/item_subclass.name give armor weight
//     (Cloth/Leather/Mail/Plate) when item_class.name === "Armor" -- confirmed real
//     against both a Trinket (non-Armor, subclass "Miscellaneous") and a real chest
//     piece (Armor, subclass "Leather").
//
// This module only does the live fetch -- see bossLootTableCache.cjs for the disk
// cache and fetchBossLootTable.cjs for the proxy-vs-local/cache-or-fetch orchestration
// (same three-file split as professions.cjs/professionsCache.cjs/fetchProfessions.cjs).

const { getClientCredentialsToken } = require('./oauth.cjs');

const TOKEN_URL = 'https://oauth.battle.net/token';

// This tier's two raids (Midnight Season 2) -- update when the tier rotates.
const INSTANCE_IDS = [1317, 1320];

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.BNET_CLIENT_ID, process.env.BNET_CLIENT_SECRET);
}

async function bnetGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = new Error(`Boss loot table fetch failed: ${url} -- ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.retryAfterMs = res.headers.get('retry-after') ? Number(res.headers.get('retry-after')) * 1000 : null;
    throw err;
  }
  return res.json();
}

// Blizzard caps an API client at roughly 100 requests/second. The table used to fetch every
// item's details at once (131 concurrent requests) -- confirmed 2026-09-19 that exactly the
// first ~88 succeeded and the rest (all of Ula'tek's 18 items, all 17 of The Coiled Altar's,
// 8 of The Twin Fangs') failed, each failure swallowed as "one bad item shouldn't take down
// the table", and the incomplete table was then cached for a week. Item details are now
// fetched a few at a time, retrying transient failures (429/5xx) with backoff, and anything
// that still fails is REPORTED (missingItemIds) instead of silently dropped.
// Blizzard's inventory_type.name for something you can't wear is "Non-equippable"; the addon
// records the same thing as "Other" (GuildToolsLoot.lua's slotLabel). One vocabulary, so a
// manually-picked item and the addon's own record of it agree (found via the 2026-09-19
// replay: Slumbering Coil Curio came back "Non-equippable" from here, "Other" from the addon).
function normalizeSlot(name) {
  return !name || name === 'Non-equippable' ? 'Other' : name;
}

const ITEM_CONCURRENCY = 6;
const MAX_ATTEMPTS = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {number[]} ids
 * @param {{ get: (id: number) => Promise<any>, concurrency?: number, maxAttempts?: number, sleep?: (ms: number) => Promise<void> }} deps  get() throws an Error with .status (and optionally .retryAfterMs)
 * @returns {Promise<{ details: Map<number, any>, failedIds: number[] }>}
 */
async function fetchItemDetails(ids, { get, concurrency = ITEM_CONCURRENCY, maxAttempts = MAX_ATTEMPTS, sleep: wait = sleep }) {
  const details = new Map();
  const failedIds = [];
  let next = 0;

  async function fetchOne(id) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        details.set(id, await get(id));
        return;
      } catch (err) {
        const transient = err.status === 429 || (err.status >= 500 && err.status < 600) || err.status === undefined;
        if (!transient || attempt === maxAttempts) {
          failedIds.push(id);
          return;
        }
        await wait(err.retryAfterMs ?? 400 * 2 ** (attempt - 1));
      }
    }
  }

  async function worker() {
    while (next < ids.length) await fetchOne(ids[next++]);
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return { details, failedIds: failedIds.sort((a, b) => a - b) };
}

/**
 * Fetches this tier's full boss -> loot table -> item detail mapping live from Blizzard.
 * @returns {Promise<{ bosses: Array<{id: number, name: string}>, lootByBoss: Record<string, number[]>, items: Record<number, {name: string, slot: string, armorWeight: string|null}>, instanceIds: number[], fetchedAt: string }>}
 */
async function fetchBossLootTable(region = 'us') {
  const token = await getToken();
  const base = `https://${region}.api.blizzard.com`;

  const instances = await Promise.all(INSTANCE_IDS.map((id) => bnetGet(`${base}/data/wow/journal-instance/${id}?namespace=static-${region}&locale=en_US`, token)));

  const bosses = instances.flatMap((inst) => (inst.encounters ?? []).map((e) => ({ id: e.id, name: e.name })));

  const encounterDetails = await Promise.all(bosses.map((b) => bnetGet(`${base}/data/wow/journal-encounter/${b.id}?namespace=static-${region}&locale=en_US`, token)));

  const lootByBoss = {};
  const itemIds = new Set();
  bosses.forEach((b, i) => {
    const ids = [...new Set((encounterDetails[i].items ?? []).map((it) => it.item?.id).filter((id) => id != null))];
    lootByBoss[b.name] = ids;
    ids.forEach((id) => itemIds.add(id));
  });

  const { details, failedIds } = await fetchItemDetails([...itemIds], {
    get: (id) => bnetGet(`${base}/data/wow/item/${id}?namespace=static-${region}&locale=en_US`, token),
  });

  const items = {};
  for (const [id, detail] of details) {
    items[id] = {
      name: detail.name,
      slot: normalizeSlot(detail.inventory_type?.name),
      armorWeight: detail.item_class?.name === 'Armor' ? (detail.item_subclass?.name ?? null) : null,
    };
  }

  // One bad item still doesn't take the table down -- but it's no longer invisible: the ids
  // that never resolved are listed so the caller can fill them from an earlier table and
  // retry soon instead of trusting (and caching) a partial result for a week.
  if (failedIds.length > 0) console.error(`[bossLootTable] ${failedIds.length} of ${itemIds.size} item lookups failed after retries: ${failedIds.join(', ')}`);

  return { bosses, lootByBoss, items, instanceIds: INSTANCE_IDS, missingItemIds: failedIds, fetchedAt: new Date().toISOString() };
}

module.exports = { fetchBossLootTable, fetchItemDetails, normalizeSlot, INSTANCE_IDS };
