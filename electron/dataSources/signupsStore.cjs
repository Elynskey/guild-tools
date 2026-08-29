const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveDataDir } = require('./dataDir.cjs');
const settingsStore = require('./settingsStore.cjs');
const discordPost = require('./discordPost.cjs');

// Season-start team-formation signups -- one Discord post per raid team (Heroic
// Progression / Alt Raid), members click a role button to sign up, an officer manually
// assigns primary/backup from the app (never automatic -- see the plan notes), then
// posts the final roster back. Same JSON-file-in-resolveDataDir() pattern as every other
// shared store in this pipeline.

function storePath() {
  return path.join(resolveDataDir(), 'raid-signups.json');
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
  return load().find((s) => s.id === id) ?? null;
}

const ROLE_LABEL = { tank: 'Tank', healer: 'Healer', dps: 'DPS' };
const TEAM_LABEL = { heroic: 'Heroic Progression', alt: 'Alt Raid' };

// Discord message-component type numbers (1 = Action Row, 2 = Button, style 1 = primary/
// blurple, style 2 = secondary/grey) -- posted as plain REST JSON since this is built by
// discordPost.cjs (no Gateway connection needed to POST a message with buttons; only
// bot.cjs, the Gateway process, needs discord.js to RECEIVE the resulting clicks).
function buildComponents(id) {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 1, label: 'Tank', custom_id: `signup:${id}:tank` },
        { type: 2, style: 1, label: 'Healer', custom_id: `signup:${id}:healer` },
        { type: 2, style: 1, label: 'DPS', custom_id: `signup:${id}:dps` },
      ],
    },
    {
      type: 1,
      components: [{ type: 2, style: 2, label: 'View Signups', custom_id: `viewsignups:${id}` }],
    },
  ];
}

function buildEmbed(entry) {
  const counts = { tank: 0, healer: 0, dps: 0 };
  for (const s of entry.signups) counts[s.role] = (counts[s.role] ?? 0) + 1;
  return {
    title: `${entry.raidName} — ${TEAM_LABEL[entry.teamType] ?? entry.teamType}`,
    description: entry.signupText,
    color: 0xd4b358,
    fields: [
      { name: 'Tank', value: String(counts.tank), inline: true },
      { name: 'Healer', value: String(counts.healer), inline: true },
      { name: 'DPS', value: String(counts.dps), inline: true },
    ],
    footer: { text: 'Click a role below to sign up.' },
  };
}

async function create(raidName, teamType, signupText) {
  if (!raidName || !teamType || !signupText) throw new Error('raidName, teamType, and signupText are all required.');
  const posts = load();
  const entry = {
    id: crypto.randomUUID(),
    raidName,
    teamType,
    signupText,
    createdAt: new Date().toISOString(),
    discordChannelId: null,
    discordMessageId: null,
    signups: [],
    assignments: { tank: [], healer: [], dps: [] },
    finalizedAt: null,
  };

  const channelId = settingsStore.load().raidSignupsChannelId;
  if (channelId) {
    entry.discordChannelId = channelId;
    try {
      const message = await discordPost.postMessage(channelId, { embeds: [buildEmbed(entry)], components: buildComponents(entry.id) });
      entry.discordMessageId = message.id;
    } catch (err) {
      console.error('[raidSignups] Discord post failed:', err);
    }
  }

  posts.unshift(entry);
  save(posts);
  return entry;
}

/** Re-signing up (same Discord user, e.g. changing role) replaces their existing entry rather than stacking a duplicate. */
async function addSignup(id, { discordUserId, discordUsername, characterName, role }) {
  const posts = load();
  const entry = posts.find((s) => s.id === id);
  if (!entry) return null;

  entry.signups = entry.signups.filter((s) => s.discordUserId !== discordUserId);
  entry.signups.push({ discordUserId, discordUsername, characterName, role, signedUpAt: new Date().toISOString() });
  save(posts);

  if (entry.discordChannelId && entry.discordMessageId) {
    try {
      await discordPost.editMessage(entry.discordChannelId, entry.discordMessageId, { embeds: [buildEmbed(entry)], components: buildComponents(entry.id) });
    } catch (err) {
      console.error('[raidSignups] Discord edit failed:', err);
    }
  }

  return entry;
}

function setAssignments(id, assignments) {
  const posts = load();
  const entry = posts.find((s) => s.id === id);
  if (!entry) return null;
  entry.assignments = assignments;
  save(posts);
  return entry;
}

function characterOrUsername(entry, discordUserId) {
  const signup = entry.signups.find((s) => s.discordUserId === discordUserId);
  return signup ? signup.characterName || signup.discordUsername : discordUserId;
}

async function finalize(id) {
  const posts = load();
  const entry = posts.find((s) => s.id === id);
  if (!entry) return null;
  entry.finalizedAt = new Date().toISOString();
  save(posts);

  if (entry.discordChannelId) {
    const lines = ['tank', 'healer', 'dps'].map((role) => {
      const primary = entry.assignments[role].filter((a) => a.tier === 'primary').map((a) => characterOrUsername(entry, a.discordUserId));
      const backup = entry.assignments[role].filter((a) => a.tier === 'backup').map((a) => characterOrUsername(entry, a.discordUserId));
      return `**${ROLE_LABEL[role]}**\nPrimary: ${primary.join(', ') || '—'}\nBackup: ${backup.join(', ') || '—'}`;
    });
    try {
      await discordPost.postMessage(entry.discordChannelId, {
        content: `📋 **${entry.raidName} — final roster**`,
        embeds: [{ title: TEAM_LABEL[entry.teamType] ?? entry.teamType, description: lines.join('\n\n'), color: 0x4c7a4c }],
      });
    } catch (err) {
      console.error('[raidSignups] Discord finalize post failed:', err);
    }
  }

  return entry;
}

module.exports = { load, get, create, addSignup, setAssignments, finalize };
