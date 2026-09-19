/** Same rule the proxy applies (signupsStore.resolveChannelId), checked here first so the dialog can say what is wrong instead of the post failing with a generic server error. Blank is fine: it means "use the raid signups channel from Settings". */
export function channelIdError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^\d{15,25}$/.test(v) ? null : 'That is not a Discord channel ID. It is a long number: right-click the channel in Discord (Developer Mode on) and choose Copy Channel ID.';
}
