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
});
