const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Officer-editable settings -- currently just the Discord channel IDs the new posting
// features need. Same JSON-file-in-resolveDataDir() pattern as craftRequestsStore.cjs;
// runs unmodified in the Electron app's local fallback and on the API proxy, where it's
// the shared, officer-wide copy. Deliberately holds only non-secret config an officer
// should be able to paste in from the app -- the bot token and other real credentials
// stay in .env.proxy, never exposed here.

function storePath() {
  return path.join(resolveDataDir(), 'settings.json');
}

const DEFAULTS = { raidSignupsChannelId: '', lootLogChannelId: '' };

/** @returns {{raidSignupsChannelId: string, lootLogChannelId: string}} */
function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  const next = { ...DEFAULTS, ...settings };
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2));
  return next;
}

module.exports = { load, save };
