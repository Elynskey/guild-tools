const fs = require('node:fs');
const path = require('node:path');
const { resolveDataDir } = require('./dataDir.cjs');

// Officer-editable settings -- Discord channel IDs, this tier's gates/DPS bar, and
// which bosses (if any) get excluded from the DPS check. Same JSON-file-in-
// resolveDataDir() pattern as craftRequestsStore.cjs; runs unmodified in the Electron
// app's local fallback and on the API proxy, where it's the shared, officer-wide copy.
// Deliberately holds only non-secret config an officer should be able to paste in from
// the app -- the bot token and other real credentials stay in .env.proxy, never
// exposed here.
//
// gates/minDps used to be a hardcoded client-side constant (config.gates) and a
// server-only .env var (MIN_DPS_REQUIREMENT) respectively -- both required a code
// change and a new app release just to update a number every time the tier's
// requirements moved. Moved here so a GM can edit them from Settings instead.
// MIN_DPS_REQUIREMENT in .env is still read as a fallback (see warcraftlogs.cjs) for
// as long as minDps here is unset (0), so an existing deploy keeps working unchanged
// until someone actually visits Settings and sets a real value.

function storePath() {
  return path.join(resolveDataDir(), 'settings.json');
}

/** Raw stored contents, no DEFAULTS/env-fallback resolution applied -- the merge base for save(), so a save() never bakes a resolved fallback value (e.g. minDps's env fallback) permanently into the file. */
function readStored() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return {};
  }
}

const DEFAULTS = {
  raidSignupsChannelId: '',
  lootLogChannelId: '',
  gotmChannelId: '',
  // Separate channel config for the test-mode build (see project docs) -- Raid
  // Signups/GOTM posts made from a "Guild Tools (Test)" install go here instead,
  // completely independent of the real channels above. Point these at CRD-TEST (or
  // whatever staging server is in use) once, and every test-mode signup/vote just
  // works without ever touching production config.
  testRaidSignupsChannelId: '',
  testGotmChannelId: '',
  // Where a test-mode app's loot posts (auto-post and the manual "Post to Discord") go -- e.g. a CRD-TEST channel.
  testLootLogChannelId: '',
  gates: { rio: 1000, ilvl: 285 },
  minDps: 0,
  /** Shared, officer-wide: when true, Need wins are posted to lootLogChannelId automatically as they come in (see lootAutoPost.cjs). On by default; nothing posts until a loot channel is set, and an officer can switch it off in Settings (an explicit false is kept). */
  autoPostLoot: true,
  /** Boss names (exact fight-name match, same names bossIcons.ts/bossLootTable.cjs use) excluded from the DPS check -- deaths, healer/tank percentile, and pull counts are unaffected either way. */
  excludedBossesFromDps: [],
};

/**
 * minDps resolves to the MIN_DPS_REQUIREMENT env var whenever the stored value is 0
 * (never a meaningful real minimum on its own) -- so every reader, including the
 * Settings screen itself, always sees the actual EFFECTIVE number in use, not a
 * misleading "0" that looks broken while an env fallback is quietly doing the real
 * work underneath. Saving a real value here is what stops relying on the fallback.
 * @returns {{raidSignupsChannelId: string, lootLogChannelId: string, gotmChannelId: string, testRaidSignupsChannelId: string, testGotmChannelId: string, gates: {rio: number, ilvl: number}, minDps: number, excludedBossesFromDps: string[]}}
 */
function load() {
  const stored = { ...DEFAULTS, ...readStored() };
  if (!stored.minDps) stored.minDps = Number(process.env.MIN_DPS_REQUIREMENT ?? 0);
  return stored;
}

/**
 * Merges onto what's already stored (not just DEFAULTS) -- a partial PUT (e.g. just
 * {minDps: 90000}) used to wipe every other field back to its default, since the old
 * merge base was DEFAULTS alone. gates is merged one level deep for the same reason:
 * {gates: {rio: 1200}} alone used to silently drop ilvl.
 */
function save(settings) {
  const current = readStored();
  const next = {
    ...DEFAULTS,
    ...current,
    ...settings,
    gates: { ...DEFAULTS.gates, ...current.gates, ...(settings.gates ?? {}) },
  };
  fs.writeFileSync(storePath(), JSON.stringify(next, null, 2));
  return next;
}

module.exports = { load, save };
