// Battle.net user login (authorization-code OAuth), distinct from oauth.cjs's
// client-credentials flow (app-to-app, no human involved -- used for the Game Data
// API calls elsewhere in this pipeline). This is the standard desktop-app OAuth
// pattern (RFC 8252): open the system browser to Blizzard's real login page, catch
// the redirect on a short-lived local HTTP listener, done. No password ever touches
// this app. That local-listener half stays identical in every build -- the browser
// and the redirect are always on the signed-in person's own machine.
//
// The code -> token EXCHANGE (the one step that needs BNET_CLIENT_SECRET) branches:
// packaged installs have no real BNET_CLIENT_SECRET of their own, so they hand the
// code to the API proxy's /auth/exchange instead, which holds the secret server-side
// (see resolveUser() below). Local dev (no PROXY_BASE_URL set) still exchanges
// directly with Blizzard using the local .env's BNET_CLIENT_SECRET, unchanged.
//
// Also verifies guild membership: the 'wow.profile' scope lets us read which WoW
// characters are linked to the signed-in Battle.net account, cross-checked against
// the CRD guild's actual roster (professions.cjs's fetchGuildRoster, same Blizzard
// guild-roster endpoint used elsewhere) -- not just "has a Battle.net account," which
// was this gate's original (explicitly provisional) scope.
//
// Requires the SAME Battle.net API client (BNET_CLIENT_ID/SECRET, wherever they now
// live) to have this exact redirect URI registered at develop.battle.net -- that's a
// manual step only the account owner can do, this code can't register it for them.

const http = require('node:http');
const crypto = require('node:crypto');
const { shell } = require('electron');
const { getProxyConfig } = require('./proxyConfig.cjs');
const proxyClient = require('./proxyClient.cjs');
const { fetchGuildRoster } = require('./professions.cjs');

const REDIRECT_PORT = 53135;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTHORIZE_URL = 'https://oauth.battle.net/authorize';
const TOKEN_URL = 'https://oauth.battle.net/token';
const USERINFO_URL = 'https://oauth.battle.net/userinfo';

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/** Throws a tagged (err.code = 'not_a_member') error if none of this account's WoW characters are on the CRD roster. */
async function assertGuildMembership(accessToken) {
  const guild = { name: process.env.GUILD_NAME, realm: process.env.GUILD_REALM, region: process.env.GUILD_REGION };
  const region = guild.region || 'us';

  const profileRes = await fetch(`https://${region}.api.blizzard.com/profile/user/wow?namespace=profile-${region}&locale=en_US`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) throw new Error(`Battle.net WoW profile fetch failed: ${profileRes.status} ${profileRes.statusText}`);
  const profile = await profileRes.json();
  const myCharacters = (profile.wow_accounts ?? []).flatMap((a) => a.characters ?? []);

  const roster = await fetchGuildRoster(guild);
  const rosterKeys = new Set(roster.map((r) => `${r.name.toLowerCase()}::${r.realm}`));

  const isMember = myCharacters.some((c) => rosterKeys.has(`${c.name.toLowerCase()}::${c.realm?.slug}`));
  if (!isMember) {
    const err = new Error('None of your Battle.net account\'s characters are on the Casual Raid Days roster.');
    err.code = 'not_a_member';
    throw err;
  }
}

/** Exchanges an authorization code for the signed-in user's identity, verifying CRD guild membership. @returns {Promise<{battletag: string, id: number}>} */
async function resolveUser(code) {
  if (proxyClient.isAvailable()) return proxyClient.exchangeAuthCode(code);

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.BNET_CLIENT_ID}:${process.env.BNET_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }).toString(),
  });
  if (!tokenRes.ok) throw new Error(`Battle.net token exchange failed: ${tokenRes.status} ${tokenRes.statusText}`);
  const tokenData = await tokenRes.json();

  // LOG-ONLY for now: profile/user/wow 403'd for real accounts in production (see the
  // prompt:'consent' fix above and the matching note in the proxy's authExchange.cjs)
  // -- never blocks sign-in until a real login confirms the fix actually works.
  try {
    await assertGuildMembership(tokenData.access_token);
    console.log('[bnetAuth] Guild membership check: PASSED (not enforced yet).');
  } catch (err) {
    console.warn('[bnetAuth] Guild membership check FAILED (not enforced yet):', err.message);
  }

  const userRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  if (!userRes.ok) throw new Error(`Battle.net userinfo fetch failed: ${userRes.status} ${userRes.statusText}`);
  const user = await userRes.json();
  return { battletag: user.battletag, id: user.id };
}

function page(title, body) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#12100c;color:#cfc9bb;text-align:center;padding-top:80px">` +
    `<h2 style="color:#f6efdd">${title}</h2><p>${body}</p></body></html>`;
}

/** @returns {Promise<{ battletag: string, id: number }>} */
function signIn() {
  const { bnetClientId } = getProxyConfig();
  if (!bnetClientId) {
    return Promise.reject(new Error('Battle.net isn\'t configured (BNET_CLIENT_ID missing).'));
  }
  if (!proxyClient.isAvailable() && !process.env.BNET_CLIENT_SECRET) {
    return Promise.reject(new Error('Battle.net isn\'t configured (BNET_CLIENT_SECRET missing).'));
  }

  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');
    let settled = false;

    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Sign-in timed out -- the browser window was never completed.')));
    }, SIGN_IN_TIMEOUT_MS);

    const server = http.createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        try {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(page(err.code === 'not_a_member' ? 'Not a CRD member' : 'Sign-in failed', `${err.code === 'not_a_member' ? err.message : 'Something went wrong.'} You can close this tab and try again in Guild Tools.`));
        } catch {
          // response already sent
        }
        finish(() => reject(err));
      });
    });

    async function handleRequest(req, res) {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(page('Sign-in cancelled', 'You can close this tab.'));
        finish(() => reject(new Error('Sign-in was cancelled.')));
        return;
      }

      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(page('Sign-in failed', 'State mismatch -- please try again.'));
        finish(() => reject(new Error('OAuth state mismatch on callback -- aborting.')));
        return;
      }

      const code = url.searchParams.get('code');
      const user = await resolveUser(code);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page(`Signed in as ${user.battletag}`, 'You can close this tab and return to Guild Tools.'));
      finish(() => resolve(user));
    }

    function finish(action) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      action();
    }

    server.on('error', (err) => {
      finish(() => reject(new Error(`Could not start the local sign-in listener on port ${REDIRECT_PORT}: ${err.message}`)));
    });

    server.listen(REDIRECT_PORT, () => {
      const authorizeUrl = `${AUTHORIZE_URL}?${new URLSearchParams({
        client_id: bnetClientId,
        scope: 'openid wow.profile',
        state,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        // Forces a fresh consent screen -- without it, Battle.net can silently reuse
        // an EARLIER, narrower consent grant (this app originally only requested
        // 'openid') instead of actually granting the newly-added 'wow.profile' scope,
        // which is what caused profile/user/wow to 403 in production even though the
        // token exchange itself succeeded. Confirmed pattern from Blizzard's own
        // developer forums (see the plan notes for the reasoning), not yet verified
        // live -- that verification is why assertGuildMembership runs log-only for now.
        prompt: 'consent',
      })}`;
      shell.openExternal(authorizeUrl);
    });
  });
}

module.exports = { signIn, REDIRECT_URI };
