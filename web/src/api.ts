import type { Raider } from '../../src/scoring/types';
import type { RawLootRecord, RawNeedLossRecord, RawTradeRecord } from '../../src/raid/lootLogic';

/**
 * Everything the page reads goes through the server gateway at <base>api/, which is read-only and Tailscale-only and adds the
 * proxy key itself: nothing secret ever reaches this code.
 */
const API = `${import.meta.env.BASE_URL}api/`;

export class ApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function request<T>(route: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const res = await fetch(`${API}${route}`, { method, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

/** What went wrong, in words a phone user can act on. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403 || err.status === 401) return 'The server refused this request. Is Tailscale connected on this phone?';
    if (err.status >= 500) return 'The Guild Tools server had a problem. Try again in a minute.';
    return `The server answered with an error (${err.status}).`;
  }
  return 'Could not reach the server. Check that Tailscale is connected.';
}

export interface RosterPayload {
  raiders: Raider[];
  fetchedAt: string;
  heroicBossesKilled: number | null;
}

/** A store record as the server holds it: the addon's fields plus what the store adds. */
export interface StoredLootRecord extends RawLootRecord {
  discordPostedAt?: string;
}

export interface LootPayload {
  records: StoredLootRecord[];
  trades: RawTradeRecord[];
  needLosses?: RawNeedLossRecord[];
}

export interface HeartbeatRow {
  officerName: string;
  /** Logging is on as far as that officer's app can tell (recently written, or the game says on). */
  chatLogActive: boolean;
  lastSeenAt: number;
}

export interface HeartbeatPayload {
  heartbeats: HeartbeatRow[];
  /** The server's clock (ms), so ages are right even if this phone's clock is off. */
  serverNow?: number;
}

export interface ProfessionsPayload {
  members: { mainName: string; characters: { characterName: string }[] }[];
}

// The roster route is a POST on the proxy (it runs the cached fetch) but changes nothing; every other route is a plain GET.
export const fetchRoster = () => request<RosterPayload>('roster', 'POST');
export const fetchLoot = () => request<LootPayload>('loot-records');
export const fetchHeartbeats = () => request<HeartbeatPayload>('loot-capture/heartbeats');
export const fetchProfessions = () => request<ProfessionsPayload>('professions/cached');
