// Resolves the API-proxy connection details. Checked first as environment variables
// (handy for testing proxy mode locally by just setting env vars, no rebuild needed),
// falling back to proxyConfig.generated.cjs -- a gitignored file written by
// scripts/inject-proxy-config.mjs from .env.proxy at build time, the only way these
// values ship inside the packaged installer. These are the deliberate exception to
// "secrets never get bundled": PROXY_API_KEY is a low-value key the proxy itself can
// reject/rotate by shipping a new app version, BNET_CLIENT_ID/DISCORD_CLIENT_ID aren't
// secrets in OAuth at all (only the matching *_SECRET values are, and those never
// leave the proxy server), and PROXY_BASE_URL isn't sensitive either.
function loadGenerated() {
  try {
    return require('./proxyConfig.generated.cjs');
  } catch {
    return {};
  }
}

// True only for a "Guild Tools (Test)" build (see scripts/dist-test.mjs) or a local
// dev run with GUILD_TOOLS_TEST_MODE=1 set -- makes Raid Signups/GOTM tag every
// request with X-Guild-Tools-Mode: test (see proxyClient.cjs), so they read/write
// completely separate data and post to CRD-TEST's channels instead of the real ones.
// Nothing else in the app changes: Raider Status, Loot History, Professions etc. still
// show real production data either way, since only Raid Signups/GOTM ever write
// anywhere that isolation actually matters.
function isTestMode() {
  const generated = loadGenerated();
  return process.env.GUILD_TOOLS_TEST_MODE === '1' || generated.TEST_MODE === true;
}

function getProxyConfig() {
  const generated = loadGenerated();
  return {
    baseUrl: process.env.PROXY_BASE_URL || generated.PROXY_BASE_URL || null,
    apiKey: process.env.PROXY_API_KEY || generated.PROXY_API_KEY || null,
    bnetClientId: process.env.BNET_CLIENT_ID || generated.BNET_CLIENT_ID || null,
    discordClientId: process.env.DISCORD_CLIENT_ID || generated.DISCORD_CLIENT_ID || null,
    testMode: isTestMode(),
  };
}

module.exports = { getProxyConfig };
