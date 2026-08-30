// Real per-character portraits -- Blizzard's Character Media API, confirmed live
// (profile/wow/character/{realm}/{name}/character-media -> assets: [{key: 'avatar',
// value: <url>}, {key: 'main-raw', value: <url>}]). "avatar" is already a real,
// pre-cropped face portrait (unlike the boss Journal API, which only ever exposes one
// wide "zoom" body shot per creature -- no CSS cropping tricks needed here). The URL's
// size segment (e.g. "/48/") isn't a freely choosable dimension -- other values 404'd
// live -- so this uses exactly the URL the API returns, never constructs its own.
//
// Same OAuth client-credentials pattern as bnet.cjs, and deliberately NOT cached to
// disk: a character's avatar can change (new gear, transmog, a race change) far more
// often than a WoW item's icon ever does, so this is refetched on every roster pull
// alongside gear completion, not cached like itemIcons.cjs's item art.

const { getClientCredentialsToken } = require('./oauth.cjs');
const { slugifyRealm, charKey } = require('./raiderio.cjs');

const TOKEN_URL = 'https://oauth.battle.net/token';

async function getToken() {
  return getClientCredentialsToken(TOKEN_URL, process.env.BNET_CLIENT_ID, process.env.BNET_CLIENT_SECRET);
}

async function fetchCharacterAvatarUrl(region, realm, name, token) {
  const url = `https://${region}.api.blizzard.com/profile/wow/character/${slugifyRealm(realm)}/${name.toLowerCase()}/character-media?namespace=profile-${region}&locale=en_US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.assets?.find((a) => a.key === 'avatar')?.value ?? null;
}

/**
 * @param {{ name: string, realm: string, region: string }} guild — guild.realm is only the fallback
 * @param {Array<{ name: string, realm?: string }>} characters
 * @returns {Promise<Record<string, string|null>>} charKey(name, realm) -> avatar portrait URL, or null when unavailable (character hidden profile, API hiccup, etc -- never fatal to the roster fetch)
 */
async function fetchCharacterPortraits(guild, characters) {
  const token = await getToken();
  const entries = await Promise.all(
    characters.map(async (c) => {
      const realm = c.realm || guild.realm;
      try {
        return [charKey(c.name, realm), await fetchCharacterAvatarUrl(guild.region, realm, c.name, token)];
      } catch {
        return [charKey(c.name, realm), null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

module.exports = { fetchCharacterPortraits };
