const path = require('node:path');

// Resolves a writable directory for this app's persisted JSON files. Inside the
// Electron app that's app.getPath('userData'). This same module also runs unmodified
// as part of the API proxy server (a bare Node process, no Electron installed) -- there,
// require('electron') throws (module not found), so DATA_DIR (set in the proxy's systemd
// unit) takes over, defaulting to ./data next to the server if unset.
function resolveDataDir() {
  try {
    return require('electron').app.getPath('userData');
  } catch {
    return process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  }
}

module.exports = { resolveDataDir };
