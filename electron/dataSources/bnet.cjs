// Blizzard Battle.net Game Data API — real gear/enchant/gem data (the thing
// wowaudit's public API turned out not to expose). OAuth client-credentials, same
// pattern as Warcraft Logs. Token endpoint confirmed live (returns 401 without
// credentials, as expected). The equipment endpoint's exact response field names
// below are NOT yet verified against a live authenticated response — they match
// Blizzard's well-documented Profile API shape used across many community tools,
// but should be confirmed with one real call once BNET_CLIENT_ID/SECRET exist,
// same caveat as Warcraft Logs' table/rankings JSON.

const { getClientCredentialsToken } = require('./oauth.cjs');
const { slugifyRealm, charKey } = require('./raiderio.cjs');

const TOKEN_URL = 'https://oauth.battle.net/token';

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.BNET_CLIENT_ID, process.env.BNET_CLIENT_SECRET);
}

// realm = the CHARACTER's own realm (see the matching comment in raiderio.cjs) — not
// necessarily the guild's, for connected-realm guilds with members on other realms.
async function fetchCharacterEquipment(region, realm, name) {
  const token = await getToken();
  const url = `https://${region}.api.blizzard.com/profile/wow/character/${slugifyRealm(realm)}/${name.toLowerCase()}/equipment?namespace=profile-${region}&locale=en_US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Battle.net equipment fetch failed for ${name}-${realm}: ${res.status} ${res.statusText}`);
  return res.json();
}

// Slots enchantable under current WoW mechanics — verified against two real
// characters' live equipment (one heavily enchanted, one not at all): neither had
// anything on HEAD/SHOULDER/NECK/WAIST/HANDS despite the well-geared character
// having every one of the slots below enchanted. WAIST and HANDS enchants were
// removed from the game entirely in a past expansion; HEAD/SHOULDER/NECK enchants
// still technically exist (reputation-gated) but are rare enough that counting
// their absence as a gap would unfairly tank otherwise well-optimized characters.
// WRIST and BACK (cloak) enchants don't exist this season either (confirmed live
// 2026-08-30 -- every single raider's gearDetail was flagging both as "missing",
// which is exactly the "well-geared character somehow missing this slot" smell
// that flagged WAIST/HANDS the same way) -- removed for the same reason.
const ENCHANTABLE_SLOTS = new Set(['CHEST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'MAIN_HAND', 'OFF_HAND']);

/**
 * Presence-only completion: % of enchantable slots that actually have an
 * enchantment, averaged with % of gem sockets that are filled. This is NOT the
 * design's originally-envisioned "correctness against a monthly Wowhead reference
 * table" — Wowhead has no API (confirmed in crd-raider-status-spec.md: "manual
 * lookup, no API"), so per-spec BiS correctness checking needs a manually
 * maintained reference table as a follow-up, not something fetchable live. This
 * presence check still catches the common case (empty socket, no enchant).
 *
 * Also returns which enchantable slots are missing an enchant (by their display
 * name -- `item.slot.name`, the same "localized name alongside the enum" shape
 * Blizzard's Journal/Item APIs use elsewhere in this pipeline) so the app can show
 * an officer exactly what's missing, not just the rounded score.
 */
function computeGearDetail(equipmentData) {
  const items = equipmentData.equipped_items ?? [];
  let enchantableCount = 0;
  let enchantedCount = 0;
  let socketCount = 0;
  let filledSocketCount = 0;
  const missingEnchants = [];

  for (const item of items) {
    const slotType = item.slot?.type;
    if (ENCHANTABLE_SLOTS.has(slotType)) {
      enchantableCount++;
      if (item.enchantments?.length) enchantedCount++;
      else missingEnchants.push(item.slot?.name ?? slotType);
    }
    for (const socket of item.sockets ?? []) {
      socketCount++;
      if (socket.item) filledSocketCount++;
    }
  }

  const enchantScore = enchantableCount ? (enchantedCount / enchantableCount) * 100 : 100;
  const socketScore = socketCount ? (filledSocketCount / socketCount) * 100 : 100;
  return {
    score: Math.round((enchantScore + socketScore) / 2),
    missingEnchants,
    emptySockets: socketCount - filledSocketCount,
    totalSockets: socketCount,
  };
}

/**
 * @param {{ name: string, realm: string, region: string }} guild — guild.realm is only the fallback
 * @param {Array<{ name: string, realm?: string }>} characters
 * @returns {Promise<Record<string, {score: number, missingEnchants: string[], emptySockets: number, totalSockets: number}>>}
 *   charKey(name, realm) -> gear detail -- keyed by realm-aware composite key, not bare name, for the same reason
 *   raiderio.cjs's charKey exists: two different real people can share a character name on different realms, and a
 *   bare-name key would silently overwrite one's gear data with the other's.
 */
async function fetchGearCompletion(guild, characters) {
  const entries = await Promise.all(
    characters.map(async (c) => {
      const realm = c.realm || guild.realm;
      const equipment = await fetchCharacterEquipment(guild.region, realm, c.name);
      return [charKey(c.name, realm), computeGearDetail(equipment)];
    }),
  );
  return Object.fromEntries(entries);
}

module.exports = { fetchGearCompletion, computeGearDetail };
