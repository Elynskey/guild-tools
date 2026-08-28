const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
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
ipcMain.handle('clipboard:write', async (_event, text) => {
  if (typeof text === 'string') clipboard.writeText(text);
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
