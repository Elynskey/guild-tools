const store = require('./gotmStore.cjs');
const proxyClient = require('./proxyClient.cjs');

// Guildie of the Month is Discord-facing data (voting happens entirely via a Discord
// button + ephemeral select, handled by bot.cjs on the proxy) -- same proxy-vs-local
// branch as raid signups and craft requests. Local mode still works for browsing/
// creating in dev, it just has no bot process to actually receive votes.

async function listGotmPosts() {
  if (proxyClient.isAvailable()) return proxyClient.listGotmPosts();
  return store.load();
}

async function getGotmPost(id) {
  if (proxyClient.isAvailable()) return proxyClient.getGotmPost(id);
  const entry = store.get(id);
  if (entry) entry.tally = store.tally(entry);
  return entry;
}

async function getCurrentGotmPost() {
  if (proxyClient.isAvailable()) return proxyClient.getCurrentGotmPost();
  const entry = store.getCurrent();
  if (entry) entry.tally = store.tally(entry);
  return entry;
}

async function createGotmPost(openedBy, introText) {
  if (proxyClient.isAvailable()) return proxyClient.createGotmPost(openedBy, introText);
  return store.create(openedBy, introText);
}

async function remindGotmVoters(id, reminderText) {
  if (proxyClient.isAvailable()) return proxyClient.remindGotmVoters(id, reminderText);
  return store.sendReminder(id, reminderText);
}

async function closeGotmVoting(id, officerTieBreak = false) {
  if (proxyClient.isAvailable()) return proxyClient.closeGotmVoting(id, officerTieBreak);
  return store.resolveWinner(id, 'prod', { officerTieBreak });
}

async function chooseGotmTieWinner(id, nomineeId, chosenBy) {
  if (proxyClient.isAvailable()) return proxyClient.chooseGotmTieWinner(id, nomineeId, chosenBy);
  return store.chooseTieWinner(id, nomineeId, chosenBy);
}

async function announceGotmWinner(id, winnerAnnounceText) {
  if (proxyClient.isAvailable()) return proxyClient.announceGotmWinner(id, winnerAnnounceText);
  return store.announceWinner(id, winnerAnnounceText);
}

module.exports = { listGotmPosts, getGotmPost, getCurrentGotmPost, createGotmPost, remindGotmVoters, closeGotmVoting, chooseGotmTieWinner, announceGotmWinner };
