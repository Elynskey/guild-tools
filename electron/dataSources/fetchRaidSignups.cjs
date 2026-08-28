const store = require('./signupsStore.cjs');
const proxyClient = require('./proxyClient.cjs');

// Raid signups are inherently officer-wide/Discord-facing data (the whole point is a
// Discord post members click), same proxy-vs-local branch as craft requests and loot
// records -- local mode still works for browsing/creating in dev, it just has no bot
// process to actually receive Discord clicks.

async function listRaidSignups() {
  if (proxyClient.isAvailable()) return proxyClient.listRaidSignups();
  return store.load();
}

async function getRaidSignup(id) {
  if (proxyClient.isAvailable()) return proxyClient.getRaidSignup(id);
  return store.get(id);
}

async function createRaidSignup(raidName, teamType, signupText) {
  if (proxyClient.isAvailable()) return proxyClient.createRaidSignup(raidName, teamType, signupText);
  return store.create(raidName, teamType, signupText);
}

async function setRaidSignupAssignments(id, assignments) {
  if (proxyClient.isAvailable()) return proxyClient.setRaidSignupAssignments(id, assignments);
  return store.setAssignments(id, assignments);
}

async function finalizeRaidSignup(id) {
  if (proxyClient.isAvailable()) return proxyClient.finalizeRaidSignup(id);
  return store.finalize(id);
}

module.exports = { listRaidSignups, getRaidSignup, createRaidSignup, setRaidSignupAssignments, finalizeRaidSignup };
