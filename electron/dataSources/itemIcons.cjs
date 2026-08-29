// Item icons for Loot History -- unlike bossIcons.ts's small hand-curated table (a
// fixed ~9 bosses per tier), loot items are numerous and only known once they actually
// drop, so this fetches live from Blizzard's Media API instead. Same OAuth
// client-credentials pattern as bnet.cjs. Cached to a local JSON file (itemId -> url,
// or null for a confirmed-no-icon item) since item icons never change -- avoids
// re-fetching the same items across every raid night.

const { getClientCredentialsToken } = require('./oauth.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

const TOKEN_URL = 'https://oauth.battle.net/token';

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.BNET_CLIENT_ID, process.env.BNET_CLIENT_SECRET);
}

function cachePath() {
  return path.join(resolveDataDir(), 'item-icon-cache.json');
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
}

async function fetchOneItemIconUrl(itemId, token, region) {
  const url = `https://${region}.api.blizzard.com/data/wow/media/item/${itemId}?namespace=static-${region}&locale=en_US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.assets?.find((a) => a.key === 'icon')?.value ?? null;
}

/** @param {number[]} itemIds @returns {Promise<Record<number, string | null>>} */
async function fetchItemIconUrls(itemIds, region = 'us') {
  const unique = [...new Set(itemIds.filter((id) => id != null))];
  const cache = loadCache();
  const missing = unique.filter((id) => cache[id] === undefined);

  if (missing.length > 0) {
    const token = await getToken();
    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          return [id, await fetchOneItemIconUrl(id, token, region)];
        } catch {
          return [id, null];
        }
      }),
    );
    for (const [id, url] of fetched) cache[id] = url;
    saveCache(cache);
  }

  return Object.fromEntries(unique.map((id) => [id, cache[id] ?? null]));
}

module.exports = { fetchItemIconUrls };
