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
  if (!res.ok) throw new Error(`Boss loot table fetch failed: ${url} -- ${res.status} ${res.statusText}`);
  return res.json();
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

  const itemDetails = await Promise.all(
    [...itemIds].map(async (id) => {
      try {
        return [id, await bnetGet(`${base}/data/wow/item/${id}?namespace=static-${region}&locale=en_US`, token)];
      } catch {
        return [id, null]; // one bad item shouldn't take down the whole table
      }
    }),
  );

  const items = {};
  for (const [id, detail] of itemDetails) {
    if (!detail) continue;
    items[id] = {
      name: detail.name,
      slot: detail.inventory_type?.name ?? 'Other',
      armorWeight: detail.item_class?.name === 'Armor' ? (detail.item_subclass?.name ?? null) : null,
    };
  }

  return { bosses, lootByBoss, items, instanceIds: INSTANCE_IDS, fetchedAt: new Date().toISOString() };
}

module.exports = { fetchBossLootTable, INSTANCE_IDS };
