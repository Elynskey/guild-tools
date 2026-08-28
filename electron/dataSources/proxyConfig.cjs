// Resolves the API-proxy connection details. Checked first as environment variables
// (handy for testing proxy mode locally by just setting env vars, no rebuild needed),
// falling back to proxyConfig.generated.cjs -- a gitignored file written by
// scripts/inject-proxy-config.mjs from .env.proxy at build time, the only way these
// values ship inside the packaged installer. These three are the deliberate exception
// to "secrets never get bundled": PROXY_API_KEY is a low-value key the proxy itself
// can reject/rotate by shipping a new app version, BNET_CLIENT_ID isn't a secret in
// OAuth at all (only BNET_CLIENT_SECRET is, and that never leaves the proxy server),
// and PROXY_BASE_URL isn't sensitive either.
function loadGenerated() {
  try {
    return require('./proxyConfig.generated.cjs');
  } catch {
    return {};
  }
}

function getProxyConfig() {
  const generated = loadGenerated();
  return {
    baseUrl: process.env.PROXY_BASE_URL || generated.PROXY_BASE_URL || null,
    apiKey: process.env.PROXY_API_KEY || generated.PROXY_API_KEY || null,
    bnetClientId: process.env.BNET_CLIENT_ID || generated.BNET_CLIENT_ID || null,
  };
}

module.exports = { getProxyConfig };
