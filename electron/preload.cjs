const { contextBridge, ipcRenderer } = require('electron');

// The only bridge between the sandboxed renderer and the main process. No credentials
// or raw API responses cross this boundary — just the final, already-shaped roster data.
contextBridge.exposeInMainWorld('electronAPI', {
  getRoster: () => ipcRenderer.invoke('roster:fetch'),
  getProfessions: () => ipcRenderer.invoke('professions:fetch'),
  getCachedProfessions: () => ipcRenderer.invoke('professions:getCached'),
  onProfessionsProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('professions:progress', listener);
    return () => ipcRenderer.removeListener('professions:progress', listener);
  },
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  openReleasePage: (url) => ipcRenderer.invoke('update:openReleasePage', url),
  getCachedRecipeCatalogue: () => ipcRenderer.invoke('recipeCatalogue:getCached'),
  getRecipeCatalogue: () => ipcRenderer.invoke('recipeCatalogue:fetch'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  listRaidNights: () => ipcRenderer.invoke('raidNights:list'),
  getPullFeedback: (code) => ipcRenderer.invoke('pullFeedback:fetch', code),
  getNightSnapshot: (code) => ipcRenderer.invoke('nightSnapshot:fetch', code),
  getAuthState: () => ipcRenderer.invoke('auth:getState'),
  signIn: () => ipcRenderer.invoke('auth:signIn'),
  signOut: () => ipcRenderer.invoke('auth:signOut'),
});
