// Discord sign-in (authorization-code OAuth) -- the lead sign-in option alongside
// Battle.net (see bnetAuth.cjs, which this file mirrors exactly). Same desktop-app
// pattern (RFC 8252): open the system browser to Discord's real login/consent page,
// catch the redirect on a short-lived local HTTP listener on a DIFFERENT port than
// Battle.net's (53136 vs 53135, so the two flows can never collide). No password ever
// touches this app.
//
// Unlike Battle.net, Discord sign-in also proves guild membership: the server-side
// exchange (see proxy's authExchange.cjs) checks the signed-in user against the CRD
// Discord server's member list via the bot token, and rejects with a distinct
// "not_a_member" error if they're not in it -- that's the actual gate this app needed
// once real API keys started shipping inside the installer (see the API proxy work).
//
// Requires DISCORD_CLIENT_ID/SECRET (wherever they now live) to have this exact
// redirect URI registered in the Discord Developer Portal -- a manual step only the
// application owner can do.

const http = require('node:http');
const crypto = require('node:crypto');
const { shell } = require('electron');
const { getProxyConfig } = require('./proxyConfig.cjs');
const proxyClient = require('./proxyClient.cjs');

const REDIRECT_PORT = 53136;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USERINFO_URL = 'https://discord.com/api/users/@me';

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/** Exchanges an authorization code for the signed-in user's identity, verifying CRD Discord membership. @returns {Promise<{provider: 'discord', displayName: string, id: string}>} */
async function resolveUser(code) {
  if (proxyClient.isAvailable()) return proxyClient.exchangeDiscordAuthCode(code);

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  });
  if (!tokenRes.ok) throw new Error(`Discord token exchange failed: ${tokenRes.status} ${tokenRes.statusText}`);
  const tokenData = await tokenRes.json();

  const userRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  if (!userRes.ok) throw new Error(`Discord userinfo fetch failed: ${userRes.status} ${userRes.statusText}`);
  const user = await userRes.json();

  const memberRes = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  });
  if (memberRes.status === 404) {
    const err = new Error('That Discord account isn\'t a member of the Casual Raid Days server.');
    err.code = 'not_a_member';
    throw err;
  }
  if (!memberRes.ok) throw new Error(`Discord membership check failed: ${memberRes.status} ${memberRes.statusText}`);

  return { provider: 'discord', displayName: user.username, id: user.id };
}

function page(title, body) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#12100c;color:#cfc9bb;text-align:center;padding-top:80px">` +
    `<h2 style="color:#f6efdd">${title}</h2><p>${body}</p></body></html>`;
}

/** @returns {Promise<{ provider: 'discord', displayName: string, id: string }>} */
function signIn() {
  const generated = getProxyConfig();
  const discordClientId = process.env.DISCORD_CLIENT_ID || generated.discordClientId;
  if (!discordClientId) {
    return Promise.reject(new Error('Discord isn\'t configured (DISCORD_CLIENT_ID missing).'));
  }
  if (!proxyClient.isAvailable() && !process.env.DISCORD_CLIENT_SECRET) {
    return Promise.reject(new Error('Discord isn\'t configured (DISCORD_CLIENT_SECRET missing).'));
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
          res.end(page(err.code === 'not_a_member' ? 'Not a CRD member' : 'Sign-in failed', `${err.message} You can close this tab and try again in Guild Tools.`));
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
      res.end(page(`Signed in as ${user.displayName}`, 'You can close this tab and return to Guild Tools.'));
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
        client_id: discordClientId,
        scope: 'identify',
        state,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        prompt: 'consent',
      })}`;
      shell.openExternal(authorizeUrl);
    });
  });
}

module.exports = { signIn, REDIRECT_URI };
