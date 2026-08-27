const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// .env location: prefer the writable userData dir (the app's own install directory
// becomes a read-only asar archive once packaged, so that's the only place a
// packaged install can persist an officer-edited .env). Falls back to the
// repo-relative path so `npm run electron:dev` keeps working unchanged.
const userDataEnvPath = path.join(app.getPath('userData'), '.env');
const devEnvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(userDataEnvPath) ? userDataEnvPath : devEnvPath });

const { fetchRoster } = require('./dataSources/fetchRoster.cjs');
const { fetchProfessions } = require('./dataSources/fetchProfessions.cjs');

ipcMain.handle('roster:fetch', async () => fetchRoster());
ipcMain.handle('professions:fetch', async () => fetchProfessions());

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
