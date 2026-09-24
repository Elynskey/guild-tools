// Builds the TEST copy of the loot addon -- GuildToolsLootTest -- from the real one, so the two can
// be installed side by side and the test one can be changed and thrown away without touching what
// officers run. Generated, never hand-edited: change addon/GuildToolsLoot (or the experiments in
// scripts/test-addon/test-extras.lua) and run this again.
//
//   npm run addon:test            builds addon-test/GuildToolsLootTest (git-ignored)
//   npm run addon:test:install    ...and copies it into the WoW AddOns folder
//
// What differs from the real addon:
//   - its own name, folder, SavedVariables (GuildToolsLootTestDB) and slash command (/gtloottest),
//     so nothing collides and nothing it records reaches the Guild Tools app or production data;
//   - chat lines in a different colour, "TEST" in the name, and the CRD crest as its icon in the
//     in-game AddOns list;
//   - tracking LOOSENED to every kind of content (raids of any difficulty, dungeons, delves, ...), with
//     each record noting its zone/content type/difficulty, and /gtloottest track strict to put the real
//     rules back;
//   - the experiments in test-extras.lua appended (/gtloottest logmark, selftest, last, track).
import { mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT, 'addon', 'GuildToolsLoot');
const EXTRAS = path.join(ROOT, 'scripts', 'test-addon', 'test-extras.lua');
const OUT_DIR = path.join(ROOT, 'addon-test', 'GuildToolsLootTest');
const EMBLEM = path.join(ROOT, 'assets', 'guild-emblem.png');
const DEFAULT_ADDONS = 'C:\\Program Files (x86)\\World of Warcraft\\_retail_\\Interface\\AddOns';
const ICON_SIZE = 128; // WoW textures must be a power of two

/** Replace `needle` exactly `count` times or fail loudly -- if the real addon changes shape, the generator must break, not silently ship a half-loosened copy. */
function replaceExactly(text, needle, replacement, count = 1) {
  const found = text.split(needle).length - 1;
  if (found !== count) throw new Error(`Expected ${count} occurrence(s) of ${JSON.stringify(needle.slice(0, 70))} in the real addon, found ${found}. Update scripts/make-test-addon.mjs.`);
  return text.split(needle).join(replacement);
}

// The loosened-tracking helpers, dropped in right after the real addon's `currentDifficulty` local so the
// rest of the copied code can use them. Tracking everything is the default; /gtloottest track strict
// restores the real addon's rules (this tier's raid, Normal/Heroic only).
const TRACK_ALL_HELPERS = `local currentDifficulty = nil

-- TEST ADDON: tracking is loosened to every kind of content (raids of any difficulty, dungeons,
-- delves, ...). /gtloottest track strict restores the real addon's rules.
local function testTrackAll()
  return GuildToolsLootTestDB ~= nil and GuildToolsLootTestDB.trackAll ~= false
end
local function testContent()
  local _, instanceType = IsInInstance()
  local name, _, difficultyID = GetInstanceInfo()
  return name, instanceType, difficultyID
end
local function testDifficultyLabel()
  local _, _, difficultyID = testContent()
  if not difficultyID or difficultyID == 0 then return nil end
  local label = GetDifficultyInfo and GetDifficultyInfo(difficultyID)
  return label or ("difficulty " .. difficultyID)
end`;

/** The real addon's Lua, renamed so it can live beside the original, with tracking loosened. Exported for tests. */
export function transformLua(lua) {
  let out = lua
    .replaceAll('GuildToolsLootDB', 'GuildToolsLootTestDB')
    .replaceAll('GUILDTOOLSLOOT', 'GUILDTOOLSLOOTTEST')
    .replaceAll('GuildToolsLootPanel', 'GuildToolsLootTestPanel')
    .replaceAll('AddOns\\\\GuildToolsLoot\\\\', 'AddOns\\\\GuildToolsLootTest\\\\')
    .replace(/\/gtloot(?!test)/g, '/gtloottest')
    .replace(/Guild Tools Loot(?! TEST)/g, 'Guild Tools Loot TEST')
    // chat lines in a different colour than the real addon's gold
    .replaceAll('|cffd4b358Guild Tools Loot TEST', '|cff4cc9f0Guild Tools Loot TEST');

  // --- loosen what is tracked ---
  out = replaceExactly(out, 'local currentDifficulty = nil', TRACK_ALL_HELPERS);
  out = replaceExactly(out, 'local function isTrackedEncounter(encounterID)\n  if isTrackedRaidDifficulty() then return true end', 'local function isTrackedEncounter(encounterID)\n  if testTrackAll() then return true end\n  if isTrackedRaidDifficulty() then return true end');
  // the difficulty label captured at each boss pull: any content, by its real in-game name
  out = replaceExactly(out, '    currentDifficulty = currentRaidDifficultyLabel()\n', '    currentDifficulty = currentRaidDifficultyLabel() or (testTrackAll() and testDifficultyLabel() or nil)\n');
  // every record says where it came from, so the test data can tell dungeon from raid from delve
  out = replaceExactly(
    out,
    '    difficulty = difficultyOverride or currentDifficulty,\n',
    '    difficulty = difficultyOverride or currentDifficulty or (testTrackAll() and testDifficultyLabel() or nil),\n    zone = testContent(),\n    contentType = select(2, testContent()),\n    difficultyID = select(3, testContent()),\n',
    2,
  );
  // a new instance is a new context: don't carry the last boss (or last zone\'s difficulty) into loot from trash or a chest
  out = replaceExactly(out, '  elseif event == "PLAYER_ENTERING_WORLD" then\n    recordCharacter()\n', '  elseif event == "PLAYER_ENTERING_WORLD" then\n    recordCharacter()\n    if testTrackAll() then currentBoss = nil currentEncounterID = nil currentDifficulty = nil end\n');
  return out;
}

export function transformToc(toc) {
  const lines = toc
    .replace(/^## Title:.*$/m, '## Title: Guild Tools Loot TEST')
    .replace(/^## Notes:.*$/m, '## Notes: TEST copy of the Guild Tools loot addon for trying things on a real client. Its own data and /gtloottest commands; never reaches the Guild Tools app.')
    .replace(/^## Version:.*$/m, (m) => `${m}-test`)
    .replace(/^## SavedVariables:.*$/m, '## SavedVariables: GuildToolsLootTestDB')
    .replace('GuildToolsLoot.lua', 'GuildToolsLootTest.lua')
    .split('\n');
  const iconLine = '## IconTexture: Interface\\AddOns\\GuildToolsLootTest\\crd-logo';
  const existing = lines.findIndex((l) => l.startsWith('## IconTexture'));
  if (existing >= 0) lines[existing] = iconLine;
  else lines.splice(lines.findIndex((l) => l.startsWith('## SavedVariables')) + 1, 0, iconLine);
  return lines.join('\n');
}

/** 128x128 uncompressed 32-bit TGA (what WoW loads without a BLP converter) of the CRD crest, padded onto a transparent square. */
export async function crestTga(size = ICON_SIZE) {
  const inner = Math.round(size * 0.9);
  const { data, info } = await sharp(EMBLEM)
    .resize(inner, inner, { fit: 'inside' })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const header = Buffer.alloc(18);
  header[2] = 2; // uncompressed true-colour
  header.writeUInt16LE(size, 12);
  header.writeUInt16LE(size, 14);
  header[16] = 32; // bits per pixel
  header[17] = 0x08; // 8 alpha bits, origin bottom-left (rows are written bottom-up below)
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size * 4; // flip: TGA rows run bottom to top
    for (let x = 0; x < size; x++) {
      const s = srcRow + x * 4;
      const d = (y * size + x) * 4;
      pixels[d] = data[s + 2]; // B
      pixels[d + 1] = data[s + 1]; // G
      pixels[d + 2] = data[s]; // R
      pixels[d + 3] = data[s + 3]; // A
    }
  }
  return { tga: Buffer.concat([header, pixels]), channels: info.channels };
}

async function build() {
  // A fresh checkout on Windows has CRLF line endings; the replacements below match LF, so normalise first.
  const lf = (text) => text.replace(/
/g, '
');
  const lua = lf(await readFile(path.join(SRC_DIR, 'GuildToolsLoot.lua'), 'utf8'));
  const toc = lf(await readFile(path.join(SRC_DIR, 'GuildToolsLoot.toc'), 'utf8'));
  const extras = lf(await readFile(EXTRAS, 'utf8'));

  const generated = `${transformLua(lua).trimEnd()}\n\n${extras}`;
  for (const leftover of ['GuildToolsLootDB', 'SlashCmdList["GUILDTOOLSLOOT"]', 'SLASH_GUILDTOOLSLOOT1']) {
    if (generated.includes(leftover)) throw new Error(`Generated addon still contains "${leftover}" -- the rename missed something.`);
  }
  if (!generated.includes('SLASH_GUILDTOOLSLOOTTEST1 = "/gtloottest"')) throw new Error('Generated addon has no /gtloottest slash command.');

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'GuildToolsLootTest.lua'), generated);
  await writeFile(path.join(OUT_DIR, 'GuildToolsLootTest.toc'), transformToc(toc));
  const { tga } = await crestTga();
  await writeFile(path.join(OUT_DIR, 'crd-logo.tga'), tga);
  console.log(`Built ${path.relative(ROOT, OUT_DIR)} (Lua ${generated.length} chars, icon ${ICON_SIZE}x${ICON_SIZE} CRD crest)`);
}

async function install() {
  const addons = process.env.WOW_ADDONS_DIR || DEFAULT_ADDONS;
  if (!existsSync(addons)) throw new Error(`WoW AddOns folder not found: ${addons} (set WOW_ADDONS_DIR)`);
  const dest = path.join(addons, 'GuildToolsLootTest');
  await rm(dest, { recursive: true, force: true });
  await cp(OUT_DIR, dest, { recursive: true });
  console.log(`Installed to ${dest} -- restart WoW (a brand-new addon isn't seen until the client starts).`);
}

// Only run when invoked directly, so the transforms above can be imported by tests.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('make-test-addon.mjs')) {
  build()
    .then(() => (process.argv.includes('--install') ? install() : undefined))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
