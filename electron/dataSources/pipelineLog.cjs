// A small in-memory diary of what the loot pipeline just did on THIS PC: a boss kill seen in the
// combat log, a Need win seen in the chat log, whether a win could be attributed, what was pushed
// to the shared store. It exists for the test-only Loot Logger Monitor (Guild Tools (Test)), so
// "did it work?" is a timeline you can read instead of something to infer -- but it is cheap and
// harmless, so every build fills it (nothing else reads it, and nothing is written to disk).
//
// kind: 'boss-kill' | 'chat-win' | 'enrich' | 'store-sync' | 'addon-sync'

const MAX_EVENTS = 300;
const events = [];
let sequence = 0;

/** @param {string} kind @param {string} text one plain sentence @param {object} [meta] */
function record(kind, text, meta) {
  events.push({ id: ++sequence, at: Date.now(), kind, text, meta: meta ?? null });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

/** Newest last. */
function recent(limit = 120) {
  return events.slice(-limit);
}

function resetForTests() {
  events.length = 0;
  sequence = 0;
}

module.exports = { record, recent, resetForTests, MAX_EVENTS };
