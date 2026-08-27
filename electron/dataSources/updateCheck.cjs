// The GitHub repo is private (see README for why -- Blizzard icon redistribution),
// so its release API needs auth we won't ship inside the app. Instead we publish a
// tiny PUBLIC gist containing just {version, releaseUrl} -- no code or assets, just
// a version number -- and poll that with no credentials. Officers already have repo
// access, so clicking through still works.
const MANIFEST_URL = 'https://gist.githubusercontent.com/Elynskey/a723d622c41bc18da6e6f0aede9a5a21/raw/guild-tools-latest.json';

function isNewer(remote, current) {
  const r = String(remote).split('.').map(Number);
  const c = String(current).split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] ?? 0;
    const cv = c[i] ?? 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

/**
 * @param {string} currentVersion
 * @returns {Promise<{ version: string, releaseUrl: string } | null>}
 */
async function checkForUpdate(currentVersion) {
  try {
    const res = await fetch(MANIFEST_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.version || !data.releaseUrl) return null;
    if (!isNewer(data.version, currentVersion)) return null;
    return { version: data.version, releaseUrl: data.releaseUrl };
  } catch (err) {
    console.warn('[update] Check failed (non-fatal):', err.message);
    return null;
  }
}

module.exports = { checkForUpdate, isNewer };
