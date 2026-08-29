const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Without this, Electron derives the app name (and therefore the userData path)
// from package.json's "name" field ("raider-status"), not the "Guild Tools"
// branding an officer would actually look for on disk.
app.setName('Guild Tools');

// .env location: prefer the writable userData dir (the app's own install directory
// becomes a read-only asar archive once packaged, so that's the only place a
// packaged install can persist an officer-edited .env). Falls back to the
// repo-relative path so `npm run electron:dev` keeps working unchanged.
const userDataEnvPath = path.join(app.getPath('userData'), '.env');
const devEnvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(userDataEnvPath) ? userDataEnvPath : devEnvPath });

const { fetchRoster } = require('./dataSources/fetchRoster.cjs');
const { fetchProfessions, getCachedProfessions } = require('./dataSources/fetchProfessions.cjs');
const { fetchRecipeCatalogue, getCachedRecipeCatalogue } = require('./dataSources/fetchRecipeCatalogue.cjs');
const { fetchRaidNightsList, fetchPullFeedback } = require('./dataSources/fetchPullFeedback.cjs');
const { fetchNightSnapshotForCode } = require('./dataSources/fetchNightSnapshot.cjs');
const { checkForUpdate } = require('./dataSources/updateCheck.cjs');
const { getProxyConfig } = require('./dataSources/proxyConfig.cjs');
const { listCraftRequests, addCraftRequest, fulfillCraftRequest, removeCraftRequest } = require('./dataSources/fetchCraftRequests.cjs');
const { signIn: bnetSignIn } = require('./dataSources/bnetAuth.cjs');
const { signIn: discordSignIn } = require('./dataSources/discordAuth.cjs');
const { loadSession, saveSession, clearSession } = require('./dataSources/authSession.cjs');
const { getWowPathConfig, setWowPath, installAddon } = require('./dataSources/lootLog.cjs');
const { fetchLootLog, addManualLootRecord, updateLootRecord, removeLootRecord, removeLootTrade } = require('./dataSources/fetchLootLog.cjs');
const { getItemIconUrls } = require('./dataSources/fetchItemIcons.cjs');
const { fetchBossLootTable } = require('./dataSources/fetchBossLootTable.cjs');
const { getSettings, saveSettings } = require('./dataSources/fetchSettings.cjs');
const {
  listRaidSignups,
  getRaidSignup,
  createRaidSignup,
  setRaidSignupAssignments,
  finalizeRaidSignup,
} = require('./dataSources/fetchRaidSignups.cjs');

// Sign-in state is remembered for 14 days (see authSession.cjs) so an officer isn't
// re-proving guild membership through a browser every single launch -- restored here at
// startup, refreshed on every sign-in, cleared on explicit sign-out. Either provider
// satisfies the gate; whichever was used last is what's stored -- Discord additionally
// proves CRD Discord-server membership (see discordAuth.cjs), Battle.net only proves
// account ownership (unchanged from its original scope).
let authState = loadSession();
ipcMain.handle('auth:getState', async () => authState);
ipcMain.handle('auth:signIn', async () => {
  const user = await bnetSignIn();
  authState = { provider: 'battlenet', displayName: user.battletag, id: user.id };
  saveSession(authState);
  return authState;
});
ipcMain.handle('auth:signInDiscord', async () => {
  authState = await discordSignIn();
  saveSession(authState);
  return authState;
});
ipcMain.handle('auth:signOut', async () => {
  authState = null;
  clearSession();
});

ipcMain.handle('roster:fetch', async () => fetchRoster());
ipcMain.handle('professions:getCached', async () => getCachedProfessions());
ipcMain.handle('professions:fetch', async (event) => fetchProfessions((progress) => event.sender.send('professions:progress', progress)));
ipcMain.handle('recipeCatalogue:getCached', async () => getCachedRecipeCatalogue());
ipcMain.handle('recipeCatalogue:fetch', async () => fetchRecipeCatalogue());
ipcMain.handle('raidNights:list', async () => fetchRaidNightsList());
ipcMain.handle('pullFeedback:fetch', async (_event, code) => fetchPullFeedback(code));
ipcMain.handle('nightSnapshot:fetch', async (_event, code) => fetchNightSnapshotForCode(code));
ipcMain.handle('update:check', async () => checkForUpdate(app.getVersion()));
ipcMain.handle('update:openReleasePage', async (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://github.com/')) shell.openExternal(url);
});

// One-click update: the proxy holds the only credential (GITHUB_TOKEN) that can read a
// release asset from this private repo, so the app asks it to fetch on its behalf rather
// than talking to GitHub directly. Downloads the installer, launches it (shell.openPath
// runs an .exe on Windows, prompting UAC same as double-clicking it), then quits so the
// installer's overwrite of this app's own files doesn't conflict with it still running --
// the same close-then-install sequence used for every manual release this session.
ipcMain.handle('update:downloadAndInstall', async () => {
  const { baseUrl, apiKey } = getProxyConfig();
  if (!baseUrl || !apiKey) throw new Error('Update download requires the API proxy to be configured.');

  const res = await fetch(`${baseUrl}/update/download`, { headers: { 'X-Proxy-Key': apiKey } });
  if (!res.ok) throw new Error(`Update download failed: ${res.status} ${res.statusText}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const dest = path.join(app.getPath('temp'), 'Guild-Tools-Setup-latest.exe');
  fs.writeFileSync(dest, buffer);

  const openErr = await shell.openPath(dest);
  if (openErr) throw new Error(`Could not launch the installer: ${openErr}`);

  setTimeout(() => app.quit(), 800);
  return { ok: true };
});

// Fixed to this app's own Discord application -- not user/client-supplied, so there's no
// open-redirect concern in exposing it over IPC. Guild scope only (no applications.commands
// -- this bot uses buttons on messages it posts, not slash commands); permissions=83968 is
// Send Messages + Embed Links + Read Message History. Adding the bot to a server needs
// "Manage Server," so this is usually something to hand to the GM rather than click here.
const DISCORD_BOT_INVITE_URL = 'https://discord.com/api/oauth2/authorize?client_id=1543017047884304474&permissions=83968&scope=bot';
ipcMain.handle('discordBot:getInviteUrl', async () => DISCORD_BOT_INVITE_URL);
ipcMain.handle('discordBot:openInvite', async () => {
  shell.openExternal(DISCORD_BOT_INVITE_URL);
});
ipcMain.handle('clipboard:write', async (_event, text) => {
  if (typeof text === 'string') clipboard.writeText(text);
});
ipcMain.handle('craftRequests:list', async () => listCraftRequests());
ipcMain.handle('craftRequests:add', async (_event, requester, profession, description) => addCraftRequest(requester, profession, description));
ipcMain.handle('craftRequests:fulfill', async (_event, id, fulfilledBy) => fulfillCraftRequest(id, fulfilledBy));
ipcMain.handle('craftRequests:remove', async (_event, id) => removeCraftRequest(id));
ipcMain.handle('lootLog:get', async () => fetchLootLog());
ipcMain.handle('lootLog:addManual', async (_event, record) => addManualLootRecord(record));
ipcMain.handle('lootLog:update', async (_event, id, patch) => updateLootRecord(id, patch));
ipcMain.handle('lootLog:remove', async (_event, id) => removeLootRecord(id));
ipcMain.handle('lootLog:removeTrade', async (_event, id) => removeLootTrade(id));
ipcMain.handle('itemIcons:get', async (_event, itemIds) => getItemIconUrls(itemIds));
ipcMain.handle('bossLootTable:get', async () => fetchBossLootTable());
ipcMain.handle('lootLog:getWowPath', async () => getWowPathConfig());
ipcMain.handle('lootLog:setWowPath', async (_event, wowPath) => {
  setWowPath(wowPath);
  return getWowPathConfig();
});
ipcMain.handle('lootLog:pickFolder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Select your World of Warcraft folder (the one containing "_retail_")' });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('settings:get', async () => getSettings());
ipcMain.handle('settings:save', async (_event, settings) => saveSettings(settings));
ipcMain.handle('raidSignups:list', async () => listRaidSignups());
ipcMain.handle('raidSignups:get', async (_event, id) => getRaidSignup(id));
ipcMain.handle('raidSignups:create', async (_event, raidName, teamType, signupText) => createRaidSignup(raidName, teamType, signupText));
ipcMain.handle('raidSignups:setAssignments', async (_event, id, assignments) => setRaidSignupAssignments(id, assignments));
ipcMain.handle('raidSignups:finalize', async (_event, id) => finalizeRaidSignup(id));
ipcMain.handle('lootLog:installAddon', async () => {
  try {
    const dest = installAddon();
    return { ok: true, dest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    backgroundColor: '#12100c',
    autoHideMenuBar: true,
    title: 'Guild Tools',
    icon: path.join(__dirname, '..', 'build-resources', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const devServerUrl = process.env.ELECTRON_START_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
