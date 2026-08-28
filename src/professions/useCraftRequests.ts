import { useCallback, useEffect, useState } from 'react';
import type { CraftRequest } from './types';

// Inside the real Electron app, requests go through the main process (IPC), which
// itself is officer-wide (server-persisted via the API proxy when configured, a local
// JSON file otherwise) -- not per-install localStorage. Outside Electron (plain
// browser/dev preview, no window.electronAPI), there's no main process to route
// through, so this falls back to localStorage, same as the sample-data fallback
// everywhere else in this app.
const STORAGE_KEY = 'crd-craft-requests';

function loadLocal(): CraftRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(requests: CraftRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch {
    // storage unavailable (private browsing, quota, etc) — request just won't persist
  }
}

export function useCraftRequests() {
  const electron = window.electronAPI;
  const [requests, setRequests] = useState<CraftRequest[]>(() => (electron ? [] : loadLocal()));

  useEffect(() => {
    if (!electron) return;
    electron.listCraftRequests().then(setRequests);
  }, [electron]);

  useEffect(() => {
    if (electron) return;
    saveLocal(requests);
  }, [electron, requests]);

  const addRequest = useCallback(
    (requester: string, profession: string, description: string) => {
      if (electron) {
        void electron.addCraftRequest(requester, profession, description).then(setRequests);
        return;
      }
      const entry: CraftRequest = { id: crypto.randomUUID(), requester, profession, description, createdAt: new Date().toISOString(), fulfilled: false };
      setRequests((prev) => [entry, ...prev]);
    },
    [electron],
  );

  const toggleFulfilled = useCallback(
    (id: string) => {
      if (electron) {
        void electron.toggleCraftRequestFulfilled(id).then(setRequests);
        return;
      }
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, fulfilled: !r.fulfilled } : r)));
    },
    [electron],
  );

  const removeRequest = useCallback(
    (id: string) => {
      if (electron) {
        void electron.removeCraftRequest(id).then(setRequests);
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
    },
    [electron],
  );

  return { requests, addRequest, toggleFulfilled, removeRequest };
}
