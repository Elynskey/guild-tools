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

function storePath() {
  return path.join(resolveDataDir(), 'gotm.json');
}

/** @returns {object[]} */
function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return [];
  }
}

function save(posts) {
  fs.writeFileSync(storePath(), JSON.stringify(posts, null, 2));
}

function get(id) {
  return load().find((p) => p.id === id) ?? null;
}

/** Most recent record still open for voting -- where bot.cjs records a vote against, and the app's default view. */
function getCurrent() {
  return load().find((p) => !p.closedAt) ?? null;
}

function buildComponents(id) {
  return [{ type: 1, components: [{ type: 2, style: 1, label: 'Vote', custom_id: `gotmvote:${id}` }] }];
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function create(openedBy, introText) {
  if (!introText) throw new Error('introText is required.');
  const channelId = settingsStore.load().gotmChannelId;
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
  const posts = load();
  posts.unshift(entry);
  save(posts);

  if (channelId) {
    try {
      const message = await discordPost.postMessage(channelId, { content: introText, components: buildComponents(entry.id) });
      const latest = load();
      const stored = latest.find((p) => p.id === entry.id);
      if (stored) {
        stored.discordMessageId = message.id;
        save(latest);
        entry.discordMessageId = message.id;
      }
    } catch (err) {
      console.error('[gotm] Discord post failed:', err);
    }
  }

  return entry;
}

/** Posts a one-off officer-written reminder to the same channel -- no state change on the record itself, just a nudge. Rejected once voting is closed (nothing left to remind anyone about). */
async function sendReminder(id, reminderText) {
  if (!reminderText) throw new Error('reminderText is required.');
  const entry = get(id);
  if (!entry) return null;
  if (entry.closedAt) throw new Error('Voting is already closed -- nothing to remind anyone about.');
  if (!entry.discordChannelId) throw new Error('No Discord channel configured for this vote.');
  await discordPost.postMessage(entry.discordChannelId, { content: reminderText });
  return entry;
}

/** Re-voting (same Discord user picking a different nominee) replaces their existing vote rather than stacking a duplicate. Rejected (treated the same as not-found) once voting is closed -- otherwise a vote whose ephemeral select was still open at the moment an officer closed voting would silently count anyway. */
function recordVote(id, { voterId, voterUsername, nomineeId, nomineeUsername }) {
  const posts = load();
  const entry = posts.find((p) => p.id === id);
  if (!entry || entry.closedAt) return null;

  entry.votes = entry.votes.filter((v) => v.voterId !== voterId);
  entry.votes.push({ voterId, voterUsername, nomineeId, nomineeUsername, votedAt: new Date().toISOString() });
  save(posts);
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

/** Resolves (but does not announce) a winner -- random draw among anyone tied for first, so the officer can see who won before writing the announcement post. Idempotent: a repeat call (double-click, a race between two officers) must not re-roll the tiebreak and flip the winner after it may have already been announced. */
function resolveWinner(id) {
  const posts = load();
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
  if (entry.closedAt) return entry;
  const standings = tally(entry);
  if (standings.length === 0) return entry;

  const topCount = standings[0].count;
  const tied = standings.filter((s) => s.count === topCount);
  const winner = tied[Math.floor(Math.random() * tied.length)];

  entry.winnerId = winner.nomineeId;
  entry.winnerUsername = winner.nomineeUsername;
  entry.winnerTieBrokeAmong = tied.length > 1 ? tied.map((t) => ({ id: t.nomineeId, username: t.nomineeUsername })) : null;
  entry.closedAt = new Date().toISOString();
  save(posts);
  return entry;
}

/** Posts the officer's own celebration-register text as a new message -- never auto-generated. Idempotent: once a winnerAnnounceMessageId exists, a repeat call returns the entry unchanged rather than posting a second announcement. */
async function announceWinner(id, winnerAnnounceText) {
  if (!winnerAnnounceText) throw new Error('winnerAnnounceText is required.');
  const posts = load();
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
  if (!entry.closedAt) throw new Error('Voting must be closed (winner resolved) before announcing.');
  if (entry.winnerAnnounceMessageId) return entry;

  entry.winnerAnnounceText = winnerAnnounceText;
  save(posts);

  if (entry.discordChannelId) {
    try {
      const message = await discordPost.postMessage(entry.discordChannelId, { content: winnerAnnounceText });
      entry.winnerAnnounceMessageId = message.id;
      save(posts);
    } catch (err) {
      console.error('[gotm] Discord announce post failed:', err);
    }
  }

  return entry;
}

module.exports = { load, get, getCurrent, create, sendReminder, recordVote, tally, resolveWinner, announceWinner };
