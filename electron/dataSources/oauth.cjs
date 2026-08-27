// Shared OAuth2 client-credentials helper — both Warcraft Logs and Blizzard's
// Battle.net API use the same flow: HTTP Basic auth with client ID/secret,
// grant_type=client_credentials, returns a bearer token with an expiry.
// Verified live against Warcraft Logs' and Blizzard's actual token endpoints
// (both correctly reject requests with 401 rather than 404, confirming the
// endpoints/flow — only the credentials themselves are untested).

const tokenCache = new Map(); // tokenUrl -> { token, expiresAt }

async function getClientCredentialsToken(tokenUrl, clientId, clientSecret) {
  const cached = tokenCache.get(tokenUrl);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`OAuth token request to ${tokenUrl} failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  tokenCache.set(tokenUrl, { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

module.exports = { getClientCredentialsToken };
