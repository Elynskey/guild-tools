// Battle.net user login (authorization-code OAuth), distinct from oauth.cjs's
// client-credentials flow (app-to-app, no human involved -- used for the Game Data
// API calls elsewhere in this pipeline). This is the standard desktop-app OAuth
// pattern (RFC 8252): open the system browser to Blizzard's real login page, catch
// the redirect on a short-lived local HTTP listener, exchange the code for a token
// server-side, done. No password ever touches this app.
//
// Requires the SAME Battle.net API client (BNET_CLIENT_ID/SECRET) to have this
// exact redirect URI registered at develop.battle.net -- that's a manual step only
// the account owner can do, this code can't register it for them.

const http = require('node:http');
const crypto = require('node:crypto');
const { shell } = require('electron');

const REDIRECT_PORT = 53135;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTHORIZE_URL = 'https://oauth.battle.net/authorize';
const TOKEN_URL = 'https://oauth.battle.net/token';
const USERINFO_URL = 'https://oauth.battle.net/userinfo';

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

function page(title, body) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#12100c;color:#cfc9bb;text-align:center;padding-top:80px">` +
    `<h2 style="color:#f6efdd">${title}</h2><p>${body}</p></body></html>`;
}

/** @returns {Promise<{ battletag: string, id: number }>} */
function signIn() {
  if (!process.env.BNET_CLIENT_ID || !process.env.BNET_CLIENT_SECRET) {
    return Promise.reject(new Error('Battle.net isn\'t configured (BNET_CLIENT_ID/BNET_CLIENT_SECRET missing).'));
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
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(page('Sign-in failed', 'Something went wrong. You can close this tab and try again in Guild Tools.'));
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

      const userRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
      if (!userRes.ok) throw new Error(`Battle.net userinfo fetch failed: ${userRes.status} ${userRes.statusText}`);
      const user = await userRes.json();

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page(`Signed in as ${user.battletag}`, 'You can close this tab and return to Guild Tools.'));
      finish(() => resolve({ battletag: user.battletag, id: user.id }));
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
        client_id: process.env.BNET_CLIENT_ID,
        scope: 'openid',
        state,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
      })}`;
      shell.openExternal(authorizeUrl);
    });
  });
}

module.exports = { signIn, REDIRECT_URI };
