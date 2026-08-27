// Officer-maintained alt -> main character mapping. No API can group characters by
// "same real person" (needs each player's personal Blizzard OAuth consent, which an
// app-only credential can't get) — so this is a plain editable JSON file instead.
// Format: { "MainName": ["MainName", "AltOne", "AltTwo"] }. Any character not
// listed is treated as its own "main" (shown standalone).
//
// Read from the writable userData dir when present (the packaged app's own install
// directory is a read-only asar archive, so that's the only place an officer can
// actually edit this after installing), falling back to the repo-relative copy so
// `npm run electron:dev` keeps working unchanged.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function resolveFilePath() {
  const userDataPath = path.join(app.getPath('userData'), 'alt-groups.json');
  if (fs.existsSync(userDataPath)) return userDataPath;
  return path.join(__dirname, '..', '..', 'alt-groups.json');
}

let cache = null;

function loadGroups() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(resolveFilePath(), 'utf8'));
    const altToMain = new Map();
    for (const [main, names] of Object.entries(raw)) {
      for (const name of names) altToMain.set(name, main);
    }
    cache = altToMain;
  } catch {
    cache = new Map();
  }
  return cache;
}

function resolveMainName(characterName) {
  return loadGroups().get(characterName) ?? characterName;
}

module.exports = { resolveMainName };
