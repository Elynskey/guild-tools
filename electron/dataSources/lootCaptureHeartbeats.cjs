// Proxy-side aggregation of "which officers' Guild Tools apps are currently tailing an
// active chat log" -- answers "is at least one person actually capturing loot live
// right now" without everyone having to compare notes mid-raid. Only meaningful on the
// shared proxy (where every officer's app reports in) -- the packaged app's local
// fallback has no other officers to aggregate, so it never calls this at all.
//
// Deliberately in-memory only, not persisted to loot-records.json or any file: a
// heartbeat older than STALE_MS is worthless (that officer's app may have closed, or
// WoW may not even be running), so there's nothing worth surviving a proxy restart for
// -- every live instance re-reports within one poll interval regardless. Same
// "ephemeral is fine here" reasoning as why this isn't mode-isolated like
// analyticsStore -- prod/test have separate Discord config but there's no real harm in
// a test-mode build's heartbeat showing up alongside prod's; this never touches guild
// data or posts anywhere.

const STALE_MS = 30 * 1000; // 3x the app's own 10s poll interval -- tolerates one missed beat, treats two as gone.
const heartbeats = new Map(); // officerName -> { chatLogActive: boolean, lastSeenAt: number }

function recordHeartbeat(officerName, chatLogActive) {
  if (!officerName) return;
  heartbeats.set(officerName, { chatLogActive: !!chatLogActive, lastSeenAt: Date.now() });
}

// Prunes stale entries as a side effect of listing rather than on a separate timer --
// this only ever gets called by the same officers whose freshness it's checking, so
// there's no risk of the map growing unbounded between calls.
function listActiveHeartbeats() {
  const now = Date.now();
  const result = [];
  for (const [officerName, entry] of heartbeats) {
    if (now - entry.lastSeenAt > STALE_MS) {
      heartbeats.delete(officerName);
      continue;
    }
    result.push({ officerName, chatLogActive: entry.chatLogActive, lastSeenAt: entry.lastSeenAt });
  }
  return result;
}

module.exports = { recordHeartbeat, listActiveHeartbeats };
