import { useEffect, useState } from 'react';
import type { CraftRequest } from './types';

// Local-only for now (per-install, not shared across officers) — the plan is to post
// these to a Discord channel eventually, not to stand up a custom backend. localStorage
// is the right fit until that's wired in: no server, survives app restarts.
const STORAGE_KEY = 'crd-craft-requests';

function load(): CraftRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(requests: CraftRequest[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch {
    // storage unavailable (private browsing, quota, etc) — request just won't persist
  }
}

export function useCraftRequests() {
  const [requests, setRequests] = useState<CraftRequest[]>(() => load());

  useEffect(() => save(requests), [requests]);

  const addRequest = (requester: string, profession: string, description: string) => {
    const entry: CraftRequest = { id: crypto.randomUUID(), requester, profession, description, createdAt: new Date().toISOString(), fulfilled: false };
    setRequests((prev) => [entry, ...prev]);
  };

  const toggleFulfilled = (id: string) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, fulfilled: !r.fulfilled } : r)));
  };

  const removeRequest = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return { requests, addRequest, toggleFulfilled, removeRequest };
}
