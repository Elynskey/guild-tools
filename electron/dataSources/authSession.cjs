const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Remembers a signed-in officer for 14 days so they don't have to reopen a browser and
// re-prove guild membership every single app launch. Only the resolved identity (provider,
// displayName, id) is persisted, never a Battle.net/Discord token -- there's no refresh
// flow for either, so this is a "you proved membership recently" cache, not a live
// credential. Re-running the real sign-in flow (and its membership check) is still what
// happens once this expires or on an explicit sign-out.

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function sessionPath() {
  return path.join(resolveDataDir(), 'auth-session.json');
}

/** @returns {{provider: string, displayName: string, id: number} | null} */
function loadSession() {
  try {
    const session = JSON.parse(fs.readFileSync(sessionPath(), 'utf8'));
    if (typeof session.expiresAt !== 'number' || Date.now() >= session.expiresAt) return null;
    return { provider: session.provider, displayName: session.displayName, id: session.id };
  } catch {
    return null;
  }
}

function saveSession(authState) {
  fs.writeFileSync(sessionPath(), JSON.stringify({ ...authState, expiresAt: Date.now() + SESSION_TTL_MS }, null, 2));
}

function clearSession() {
  try {
    fs.unlinkSync(sessionPath());
  } catch {
    // nothing to clear
  }
}

module.exports = { loadSession, saveSession, clearSession };
