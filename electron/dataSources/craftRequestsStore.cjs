const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');
const settingsStore = require('./settingsStore.cjs');
const discordPost = require('./discordPost.cjs');

// Persisted crafting-request board. Same JSON-file-in-DATA_DIR pattern as
// professionsCache.cjs/recipeCatalogueCache.cjs -- this file runs unmodified both as
// part of the Electron app's local (non-proxy) fallback and as part of the API proxy
// server, where it's the shared, officer-wide store (see craftRequests.cjs's
// proxy-vs-local branch for which mode is active).
//
// Also posts to Discord (add() on creation, fulfill() on completion) when a craft-orders
// channel is configured (see settingsStore.cjs) -- wrapped so a Discord outage or missing
// config never blocks the board itself from working.

function storePath() {
  return path.join(resolveDataDir(), 'craft-requests.json');
}

/** @returns {import('../../src/professions/types').CraftRequest[]} */
function load() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), 'utf8'));
  } catch {
    return [];
  }
}

function save(requests) {
  fs.writeFileSync(storePath(), JSON.stringify(requests, null, 2));
}

function buildEmbed(entry) {
  const fields = [
    { name: 'Requester', value: entry.requester, inline: true },
    { name: 'Profession', value: entry.profession, inline: true },
  ];
  if (entry.fulfilled) fields.push({ name: 'Status', value: `✅ Completed by ${entry.fulfilledBy}` });
  return {
    embeds: [
      {
        title: entry.fulfilled ? '~~New crafting request~~' : 'New crafting request',
        description: entry.description,
        color: entry.fulfilled ? 0x4c7a4c : 0xd4b358,
        fields,
      },
    ],
  };
}

async function add(requester, profession, description) {
  const requests = load();
  const entry = {
    id: crypto.randomUUID(),
    requester,
    profession,
    description,
    createdAt: new Date().toISOString(),
    fulfilled: false,
    fulfilledBy: null,
    discordMessageId: null,
  };

  const channelId = settingsStore.load().craftOrdersChannelId;
  if (channelId) {
    try {
      const message = await discordPost.postMessage(channelId, buildEmbed(entry));
      entry.discordMessageId = message.id;
    } catch (err) {
      console.error('[craftRequests] Discord post failed:', err);
    }
  }

  requests.unshift(entry);
  save(requests);
  return requests;
}

/** Toggles fulfilled state; fulfilledBy is only recorded going open -> fulfilled, cleared going back. */
async function fulfill(id, fulfilledBy) {
  const requests = load();
  const target = requests.find((r) => r.id === id);
  if (!target) return requests;

  const willFulfill = !target.fulfilled;
  target.fulfilled = willFulfill;
  target.fulfilledBy = willFulfill ? fulfilledBy : null;
  save(requests);

  const channelId = settingsStore.load().craftOrdersChannelId;
  if (channelId && target.discordMessageId) {
    try {
      await discordPost.editMessage(channelId, target.discordMessageId, buildEmbed(target));
    } catch (err) {
      console.error('[craftRequests] Discord edit failed:', err);
    }
  }

  return requests;
}

function remove(id) {
  const requests = load().filter((r) => r.id !== id);
  save(requests);
  return requests;
}

module.exports = { load, add, fulfill, remove };
