// What we can honestly say about "is chat logging on?" for this PC.
//
// The file's timestamp is NOT a reliable way to tell. WoW keeps chat lines in memory and writes WoWChatLog.txt only when you
// log out (confirmed live 2026-09-19/20, WoW 12.1.0: 24 KB of half an hour's chat landed in one write at logout, every
// flush has coincided with a logout, and a /reload written 50 seconds before one did NOT write it). So a stale file usually
// means "logging is on, WoW just hasn't written it yet", not "logging is off". Judging by the file alone raised false
// "not logging" alarms all night.
//
// Two facts are trustworthy:
//   * a RECENT write is proof that logging works (`writing`);
//   * the game's own reading (C_ChatInfo.IsLoggingChat), which the addon saves to its SavedVariables at login and at
//     every reload/logout (the addon's own file IS written at a reload), so the app can read it soon after (`gameReading`, with its time).
// Everything else is `unknown`, and is reported as "can't tell", never as "off".
//
//   writing      the log file was written to recently: logging is on and being written
//   on-buffered  the game says logging is on; the file is behind, and catches up when you next log out
//   off          the game says logging is OFF: the one state that needs the officer to act
//   unknown      no reading yet (addon older than 1.7, or never reloaded since), and the file is quiet

/** @typedef {'writing' | 'on-buffered' | 'off' | 'unknown'} ChatLogState */

/**
 * @param {{ active: boolean, gameReading: { on: boolean, at: number } | null }} facts `active` = the file was written within the app's freshness window
 * @returns {ChatLogState}
 */
function deriveChatLogState({ active, gameReading }) {
  if (active) return 'writing';
  if (gameReading && gameReading.on === true) return 'on-buffered';
  if (gameReading && gameReading.on === false) return 'off';
  return 'unknown';
}

/** Is chat logging on, as far as anyone can tell? `unknown` is not a yes: nothing here vouches for it. */
function isLoggingOn(state) {
  return state === 'writing' || state === 'on-buffered';
}

module.exports = { deriveChatLogState, isLoggingOn };
