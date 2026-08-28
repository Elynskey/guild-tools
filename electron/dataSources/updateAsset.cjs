// Downloads the latest release's Windows installer from the private guild-tools repo --
// the repo is private (Blizzard icon redistribution reasons, see README), so the app
// itself can't fetch a release asset with no credentials the way it could on a public
// repo. This runs server-side only, using GITHUB_TOKEN (a fine-grained PAT scoped to
// just this repo, Contents: read-only) -- the packaged app never holds this token, it
// asks the proxy to fetch on its behalf, same pattern as every other real credential in
// this pipeline.

const REPO = 'Elynskey/guild-tools';

async function fetchLatestReleaseMeta() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub release lookup failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Finds the Windows installer asset on the latest release and returns a stream of its
 * raw bytes. The asset's own `url` (the GitHub API URL, not `browser_download_url`) is
 * what accepts an Accept: application/octet-stream request with token auth for a
 * private-repo asset -- browser_download_url only works with a real browser session.
 */
async function fetchInstallerAssetStream() {
  const release = await fetchLatestReleaseMeta();
  const asset = (release.assets ?? []).find((a) => a.name.endsWith('.exe'));
  if (!asset) throw new Error('No .exe asset found on the latest release.');

  const res = await fetch(asset.url, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`GitHub asset download failed: ${res.status} ${res.statusText}`);

  return { stream: res.body, filename: asset.name, size: asset.size };
}

module.exports = { fetchInstallerAssetStream };
