// A small in-memory diary of what the loot pipeline just did on THIS PC: a boss kill seen in the
// combat log, a Need win seen in the chat log, whether a win could be attributed, what was pushed
// to the shared store. It exists for the test-only Loot Logger Monitor (Guild Tools (Test)), so
// "did it work?" is a timeline you can read instead of something to infer -- but it is cheap and
// harmless, so every build fills it in memory. Only a test build also writes it to a file (enablePersistence).
//
// kind: 'boss-kill' | 'chat-win' | 'enrich' | 'store-sync' | 'addon-sync'

const fs = require('node:fs');

const MAX_EVENTS = 300;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const events = [];
let sequence = 0;
let persistPath = null;

/**
 * Also append every event, one JSON object per line, to `file` -- so the whole session survives the app closing
 * and can be read from outside it (a test build turns this on). A file already over 2 MB is set aside as
 * `<file>.old` first, so it can never grow without bound.
 */
function enablePersistence(file) {
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_FILE_BYTES) fs.renameSync(file, `${file}.old`);
    persistPath = file;
  } catch (err) {
    console.error('[pipelineLog] Could not set up persistence (non-fatal):', err);
    persistPath = null;
  }
}

/** @param {string} kind @param {string} text one plain sentence @param {object} [meta] */
function record(kind, text, meta) {
  const event = { id: ++sequence, at: Date.now(), kind, text, meta: meta ?? null };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  if (persistPath) {
    try {
      fs.appendFileSync(persistPath, `${JSON.stringify({ ...event, iso: new Date(event.at).toISOString() })}\n`);
    } catch {
      persistPath = null; // a read-only or vanished folder must never break the pipeline
    }
  }
}

/** Newest last. */
function recent(limit = 120) {
  return events.slice(-limit);
}

function resetForTests() {
  events.length = 0;
  sequence = 0;
  persistPath = null;
}

module.exports = { record, recent, enablePersistence, resetForTests, MAX_EVENTS, MAX_FILE_BYTES };
