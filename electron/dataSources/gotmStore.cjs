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
  const posts = load();
  const entry = {
    id: crypto.randomUUID(),
    month: currentMonth(),
    openedBy: openedBy ?? null,
    introText,
    createdAt: new Date().toISOString(),
    discordChannelId: null,
    discordMessageId: null,
    votes: [],
    closedAt: null,
    winnerId: null,
    winnerUsername: null,
    winnerTieBrokeAmong: null,
    winnerAnnounceText: null,
    winnerAnnounceMessageId: null,
  };

  const channelId = settingsStore.load().gotmChannelId;
  if (channelId) {
    entry.discordChannelId = channelId;
    try {
      const message = await discordPost.postMessage(channelId, { content: introText, components: buildComponents(entry.id) });
      entry.discordMessageId = message.id;
    } catch (err) {
      console.error('[gotm] Discord post failed:', err);
    }
  }

  posts.unshift(entry);
  save(posts);
  return entry;
}

/** Re-voting (same Discord user picking a different nominee) replaces their existing vote rather than stacking a duplicate. */
function recordVote(id, { voterId, voterUsername, nomineeId, nomineeUsername }) {
  const posts = load();
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;

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

/** Resolves (but does not announce) a winner -- random draw among anyone tied for first, so the officer can see who won before writing the announcement post. */
function resolveWinner(id) {
  const posts = load();
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
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

/** Posts the officer's own celebration-register text as a new message -- never auto-generated. */
async function announceWinner(id, winnerAnnounceText) {
  if (!winnerAnnounceText) throw new Error('winnerAnnounceText is required.');
  const posts = load();
  const entry = posts.find((p) => p.id === id);
  if (!entry) return null;
  if (!entry.closedAt) throw new Error('Voting must be closed (winner resolved) before announcing.');

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

module.exports = { load, get, getCurrent, create, recordVote, tally, resolveWinner, announceWinner };
