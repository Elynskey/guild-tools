const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');

// App usage log -- screen visits, key officer actions, and app-version check-ins, all
// in one flat event stream. Runs unmodified in the Electron app's local fallback and
// on the API proxy (same pattern as settingsStore.cjs -- no Discord posting involved,
// so no fork needed between the two). Mode-isolated like signupsStore.cjs/gotmStore.cjs:
// without this, using the test build to demo/QA Analytics itself would flood the real
// officer-usage log with fake traffic.
//
// Just a flat JSON file, no real database -- MAX_EVENTS/MAX_AGE_DAYS below keep it
// bounded. Sized against this guild's real scale (5-15 officers): at that scale even a
// spiky raid-night week lands nowhere near 15,000 events, so the count cap is the one
// that actually binds; the age cutoff is a secondary safety net against a long quiet
// stretch (or a pathological spam bug) leaving stale rows in what's meant to be a
// recent-usage dashboard.
const MAX_AGE_DAYS = 120;
const MAX_EVENTS = 15000;

function storePath(mode) {
  return path.join(resolveDataDir(), mode === 'test' ? 'analytics.test.json' : 'analytics.json');
}

/** @returns {object[]} */
function load(mode) {
  try {
    return JSON.parse(fs.readFileSync(storePath(mode), 'utf8'));
  } catch {
    return [];
  }
}

function save(events, mode) {
  fs.writeFileSync(storePath(mode), JSON.stringify(events, null, 2));
}

function trim(events) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const fresh = events.filter((e) => new Date(e.at).getTime() >= cutoff);
  return fresh.length > MAX_EVENTS ? fresh.slice(fresh.length - MAX_EVENTS) : fresh;
}

/**
 * @param {{event: string, screen?: string|null, displayName?: string|null, appVersion?: string|null, meta?: object|null}} input
 * @returns {{ok: true}}
 */
function record(input, mode = 'prod') {
  if (!input?.event) throw new Error('event is required.');
  const events = load(mode);
  events.push({
    id: crypto.randomUUID(),
    event: input.event,
    screen: input.screen ?? null,
    displayName: input.displayName ?? null,
    appVersion: input.appVersion ?? null,
    mode,
    meta: input.meta ?? null,
    at: new Date().toISOString(),
  });
  save(trim(events), mode);
  return { ok: true };
}

/** @returns {object[]} Already age/count-trimmed -- safe to hand back as-is, no server-side filtering needed at this scale. */
function list(mode = 'prod') {
  return load(mode);
}

module.exports = { record, list };
