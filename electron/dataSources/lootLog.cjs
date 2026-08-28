const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');
const { readLuaVariable } = require('./luaTableReader.cjs');

// Loot history is purely local: it comes from the GuildToolsLoot addon's
// SavedVariables file on THIS machine's WoW installation, not from any server or the
// API proxy -- there's nothing to sync, this only ever reflects whoever's PC Guild
// Tools happens to be running on (see the plan notes for why that's an acceptable v1
// scope: Group Loot broadcasts roll results to the whole raid, so it doesn't matter
// whose client captured them).

const DEFAULT_WOW_PATH = 'C:\\Program Files (x86)\\World of Warcraft\\_retail_';

function configPath() {
  return path.join(resolveDataDir(), 'wow-path.json');
}

function loadConfiguredPath() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8')).wowPath ?? null;
  } catch {
    return null;
  }
}

function saveConfiguredPath(wowPath) {
  fs.writeFileSync(configPath(), JSON.stringify({ wowPath }, null, 2));
}

function isRealWowPath(candidate) {
  return !!candidate && fs.existsSync(path.join(candidate, 'WTF'));
}

/** Configured path if it still looks real, else the standard Windows default if that looks real, else whatever's configured (may be null). */
function resolveWowPath() {
  const configured = loadConfiguredPath();
  if (isRealWowPath(configured)) return configured;
  if (isRealWowPath(DEFAULT_WOW_PATH)) return DEFAULT_WOW_PATH;
  return configured;
}

/** Account folder names vary per installation, so this scans WTF/Account/* for whichever one actually has our SavedVariables file, rather than asking the officer to type their account name. */
function findSavedVariablesFile(wowPath) {
  const accountsDir = path.join(wowPath, 'WTF', 'Account');
  let entries;
  try {
    entries = fs.readdirSync(accountsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(accountsDir, entry.name, 'SavedVariables', 'GuildToolsLoot.lua');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @returns {{ records: object[], trades: object[], status: 'ok' | 'not_configured' | 'addon_not_installed' }}
 */
function getLootRecords() {
  const wowPath = resolveWowPath();
  if (!isRealWowPath(wowPath)) return { records: [], trades: [], status: 'not_configured' };

  const svFile = findSavedVariablesFile(wowPath);
  if (!svFile) return { records: [], trades: [], status: 'addon_not_installed' };

  const source = fs.readFileSync(svFile, 'utf8');
  const db = readLuaVariable(source, 'GuildToolsLootDB');
  if (!db) return { records: [], trades: [], status: 'addon_not_installed' };

  return { records: db.records ?? [], trades: db.trades ?? [], status: 'ok' };
}

function getWowPathConfig() {
  return { configured: loadConfiguredPath(), resolved: resolveWowPath(), valid: isRealWowPath(resolveWowPath()) };
}

function setWowPath(wowPath) {
  saveConfiguredPath(wowPath);
}

// Copies the addon's source (shipped inside this app, see package.json's build.files)
// into <wowPath>/Interface/AddOns/GuildToolsLoot -- read/write via fs directly (not
// fs.copyFile) so this works transparently whether the source lives on a real disk
// (dev mode) or inside the packaged app's read-only asar archive.
function installAddon() {
  const wowPath = resolveWowPath();
  if (!isRealWowPath(wowPath)) throw new Error('WoW installation not found -- set the path first.');

  const srcDir = path.join(__dirname, '..', '..', 'addon', 'GuildToolsLoot');
  const destDir = path.join(wowPath, 'Interface', 'AddOns', 'GuildToolsLoot');
  fs.mkdirSync(destDir, { recursive: true });

  for (const file of fs.readdirSync(srcDir)) {
    const content = fs.readFileSync(path.join(srcDir, file));
    fs.writeFileSync(path.join(destDir, file), content);
  }
  return destDir;
}

module.exports = { getLootRecords, getWowPathConfig, setWowPath, installAddon };
