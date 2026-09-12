const discordPost = require('./discordPost.cjs');

// "Send me feedback" -- a DM straight to the maintainer's own Discord account, not a
// channel post. FEEDBACK_DISCORD_USER_ID is a real Discord user ID (not a secret, but
// kept in .env rather than committed for the same reason every other guild-specific ID
// in this app lives there instead of in source). Works identically from the real app
// and a test-mode build -- feedback is one of the few things NOT mode-isolated, since
// the whole point is it always reaches the same person regardless of which build sent it.
async function sendFeedback({ message, screen, appVersion, mode, sender }) {
  if (!message) throw new Error('message is required.');
  const userId = process.env.FEEDBACK_DISCORD_USER_ID;
  if (!userId) throw new Error('Feedback isn\'t configured (FEEDBACK_DISCORD_USER_ID missing).');

  const lines = [
    `📝 **App feedback**${sender ? ` from ${sender}` : ''}`,
    `${screen || 'Unknown screen'} · v${appVersion || '?'}${mode === 'test' ? ' · TEST MODE' : ''}`,
    '',
    message,
  ];
  await discordPost.sendDirectMessage(userId, { content: lines.join('\n') });
  return { ok: true };
}

module.exports = { sendFeedback };
