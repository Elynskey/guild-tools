const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');
const settingsStore = require('./settingsStore.cjs');
const discordPost = require('./discordPost.cjs');

// Guildie of the Month voting -- one record per calendar month. An officer writes the
// "voting is open" post themselves and it goes out with a single Vote button; clicking
// it (handled in bot.cjs) shows the clicker an ephemeral native Discord member-select,
// and picking someone records their vote here. One vote per Discord user per record is
// what makes "one vote per member per month" true -- re-voting replaces, same pattern
// as signupsStore.cjs's re-signup handling. Same JSON-file-in-resolveDataDir() pattern
// as every other shared store in this pipeline.
//
// Every function here takes a `mode` ('prod' | 'test'), defaulting to 'prod' so any
// existing caller that doesn't pass one keeps behaving exactly as before -- same
// dual-environment scheme as signupsStore.cjs (see its header comment for the full
// rationale). 'test' reads/writes gotm.test.json and posts to
// settings.testGotmChannelId instead of the real ones.

function storePath(mode) {
  return path.join(resolveDataDir(), mode === 'test' ? 'gotm.test.json' : 'gotm.json');
}

/** @returns {object[]} */
function load(mode) {
  try {
    return JSON.parse(fs.readFileSync(storePath(mode), 'utf8'));
  } catch {
    return [];
  }
}

function save(posts, mode) {
  fs.writeFileSync(storePath(mode), JSON.stringify(posts, null, 2));
}

function get(id, mode) {
  return load(mode).find((p) => p.id === id) ?? null;
}

/** Most recent record still open for voting -- where bot.cjs records a vote against, and the app's default view. */
function getCurrent(mode) {
  return load(mode).find((p) => !p.closedAt) ?? null;
}

function buildComponents(id) {
  return [{ type: 1, components: [{ type: 2, style: 1, label: 'Vote', custom_id: `gotmvote:${id}` }] }];
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function create(openedBy, introText, mode = 'prod') {
  if (!introText) throw new Error('introText is required.');
  const settings = settingsStore.load();
  const channelId = mode === 'test' ? settings.testGotmChannelId : settings.gotmChannelId;
  const entry = {
    id: crypto.randomUUID(),
    month: currentMonth(),
    openedBy: openedBy ?? null,
    introText,
    createdAt: new Date().toISOString(),
    discordChannelId: channelId || null,
    discordMessageId: null,
    votes: [],
    closedAt: null,
    winnerId: null,
    winnerUsername: null,
    winnerTieBrokeAmong: null,
    winnerAnnounceText: null,
    winnerAnnounceMessageId: null,
  };

  // Saved before the Discord round-trip (an await), not after -- see the identical
  // comment in signupsStore.cjs's create() for why (a lost-update race across the
  // await would otherwise let one create() silently erase another's brand-new entry).
  const posts = load(mode);
  posts.unshift(entry);
  save(posts, mode);

  if (channelId) {
    try {
      const message = await discordPost.postMessage(channelId, { content: introText, components: buildComponents(entry.id) });
      const latest = load(mode);
      const stored = latest.find((p) => p.id === entry.id);
      if (stored) {
        stored.discordMessageId = message.id;
        save(latest, mode);
        entry.discordMessageId = message.id;
      }
    } catch (err) {
      console.error('[gotm] Discord post failed:', err);
    }
  }

  return entry;
}

/** Posts a one-off officer-written reminder to the same channel -- no state change on the record itself, just a nudge. Rejected once voting is closed (nothing left to remind anyone about). */
async function sendReminder(id, reminderText, mode = 'prod') {
  if (!reminderText) throw new Error('reminderText is required.');
  const entry = get(id, mode);
  if (!entry) return null;
  if (entry.closedAt || entry.tieBreakPending) throw new Error('Voting is already closed -- nothing to remind anyone about.');
  if (!entry.discordChannelId) throw new Error('No Discord channel configured for this vote.');
  await discordPost.postMessage(entry.discordChannelId, { content: reminderText });
  return entry;
}

/** Re-voting (same Discord user picking a different nominee) replaces their existing vote rather than stacking a duplicate. Rejected (treated the same as not-found) once voting is closed -- otherwise a vote whose ephemeral select was still open at the moment an officer closed voting would silently count anyway. */
function recordVote(id, { voterId, voterUsername, nomineeId, nomineeUsername }, mode = 'prod') {
  const posts = load(mode);
  const entry = posts.find((p) => p.id === id);
  if (!entry || entry.closedAt || entry.tieBreakPending) return null;

  entry.votes = entry.votes.filter((v) => v.voterId !== voterId);
  entry.votes.push({ voterId, voterUsername, nomineeId, nomineeUsername, votedAt: new Date().toISOString() });
  save(posts, mode);
  return entry;
}

/** @returns {{nomineeId: string, nomineeUsername: string, count: number}[]} sorted descending by count. */
function tally(entry) {
  const counts = new Map();
  for (const v of entry.votes) {
    const current = counts.get(v.nomineeId) ?? { nomineeId: v.nomineeId, nomineeUsername: v.nomineeUsername, count: 0 };
    current.count += 1;
    current.nomineeUsername = v.nomineeUsername;
    counts.set(v.nomineeId, current);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * Resolves (but does not announce) a winner, so the officer can see who won before writing the announcement post.
 *
 * A tie for first is broken one of two ways. With `options.officerTieBreak` (what the app asks for), voting is
 * closed but NO winner is picked: the record is marked `tieBreakPending` with the tied nominees, and an officer
 * chooses among them (see chooseTieWinner). Without it (older app versions that don't know about officer
 * tie-breaks) it stays a random draw, exactly as before, so an old client's Close button still works.
 *
 * Idempotent: a repeat call (double-click, a race between two officers) must not re-roll a random tiebreak or
 * reset a pending one, or flip a winner after it may have already been announced.
 */
function resolveWinner(id, mode = 'prod', options = {}) {
  const posts = load(mode);
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
  if (entry.closedAt || entry.tieBreakPending) return entry;
  const standings = tally(entry);
  if (standings.length === 0) return entry;

  const topCount = standings[0].count;
  const tied = standings.filter((s) => s.count === topCount);
  if (tied.length > 1 && options.officerTieBreak) {
    entry.tieBreakPending = true;
    entry.tiedNominees = tied.map((t) => ({ id: t.nomineeId, username: t.nomineeUsername }));
    save(posts, mode);
    return entry;
  }
  const winner = tied[Math.floor(Math.random() * tied.length)];

  entry.winnerId = winner.nomineeId;
  entry.winnerUsername = winner.nomineeUsername;
  entry.winnerTieBrokeAmong = tied.length > 1 ? tied.map((t) => ({ id: t.nomineeId, username: t.nomineeUsername })) : null;
  entry.closedAt = new Date().toISOString();
  save(posts, mode);
  return entry;
}

/** An officer's pick among the nominees who tied for first -- locks in the winner and closes the vote. Idempotent once closed (a second click, or two officers picking at once, returns the winner already chosen instead of changing it). Only someone who actually tied can be picked. */
function chooseTieWinner(id, nomineeId, chosenBy, mode = 'prod') {
  const posts = load(mode);
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
  if (entry.closedAt) return entry;
  if (!entry.tieBreakPending) throw new Error('There is no tie to break on this vote.');
  const pick = (entry.tiedNominees ?? []).find((t) => t.id === nomineeId);
  if (!pick) throw new Error('Pick one of the nominees who tied for first.');

  entry.winnerId = pick.id;
  entry.winnerUsername = pick.username;
  entry.winnerTieBrokeAmong = entry.tiedNominees;
  entry.winnerChosenBy = chosenBy || null;
  entry.tieBreakPending = false;
  entry.tiedNominees = null;
  entry.closedAt = new Date().toISOString();
  save(posts, mode);
  return entry;
}

/** Posts the officer's own celebration-register text as a new message -- never auto-generated. Idempotent: once a winnerAnnounceMessageId exists, a repeat call returns the entry unchanged rather than posting a second announcement. */
async function announceWinner(id, winnerAnnounceText, mode = 'prod') {
  if (!winnerAnnounceText) throw new Error('winnerAnnounceText is required.');
  const posts = load(mode);
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
  if (!entry.closedAt) throw new Error('Voting must be closed (winner resolved) before announcing.');
  if (entry.winnerAnnounceMessageId) return entry;

  entry.winnerAnnounceText = winnerAnnounceText;
  save(posts, mode);

  if (entry.discordChannelId) {
    try {
      const message = await discordPost.postMessage(entry.discordChannelId, { content: winnerAnnounceText });
      entry.winnerAnnounceMessageId = message.id;
      save(posts, mode);
    } catch (err) {
      console.error('[gotm] Discord announce post failed:', err);
    }
  }

  return entry;
}

module.exports = { load, get, getCurrent, create, sendReminder, recordVote, tally, resolveWinner, chooseTieWinner, announceWinner };
