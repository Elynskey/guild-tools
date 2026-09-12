import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalyticsEvent } from '../../electron';

/** Friendly label for every curated action event name (see main.cjs's track() call sites) -- falls back to the raw event name for anything not listed, so a future event never renders blank. */
export const ACTION_LABELS: Record<string, string> = {
  raid_signup_created: 'Raid signup created',
  raid_signup_assignment_set: 'Raid signup assignment set',
  raid_signup_finalized: 'Raid signup finalized',
  gotm_created: 'GOTM vote opened',
  gotm_reminder_sent: 'GOTM reminder sent',
  gotm_closed: 'GOTM voting closed',
  gotm_announced: 'GOTM winner announced',
  loot_manual_added: 'Loot record added manually',
  loot_night_posted: 'Loot night posted to Discord',
  addon_installed: 'Loot addon installed',
  craft_request_added: 'Craft request added',
  craft_request_fulfilled: 'Craft request fulfilled',
  settings_saved: 'Settings saved',
  feedback_sent: 'Feedback sent',
  update_downloaded: 'Update downloaded',
  sign_in: 'Signed in',
};

export function actionLabelFor(event: string): string {
  return ACTION_LABELS[event] ?? event;
}

export interface CountRow {
  label: string;
  count: number;
}

export interface OfficerRow {
  displayName: string;
  appVersion: string | null;
  lastSeen: string;
}

export function useAnalytics() {
  const available = !!window.electronAPI;
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!available) return;
    setLoading(true);
    setError(null);
    window.electronAPI!
      .listAnalyticsEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message || 'Could not load analytics.'))
      .finally(() => setLoading(false));
  }, [available]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const screenCounts = useMemo<CountRow[]>(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.event !== 'screen_view' || !e.screen) continue;
      counts.set(e.screen, (counts.get(e.screen) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [events]);

  const actionCounts = useMemo<CountRow[]>(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.event === 'screen_view' || e.event === 'app_launch') continue;
      counts.set(e.event, (counts.get(e.event) ?? 0) + 1);
    }
    return [...counts.entries()].map(([event, count]) => ({ label: actionLabelFor(event), count })).sort((a, b) => b.count - a.count);
  }, [events]);

  const officers = useMemo<OfficerRow[]>(() => {
    const latest = new Map<string, AnalyticsEvent>();
    for (const e of events) {
      if (!e.displayName) continue;
      const current = latest.get(e.displayName);
      if (!current || new Date(e.at).getTime() > new Date(current.at).getTime()) latest.set(e.displayName, e);
    }
    return [...latest.values()]
      .map((e) => ({ displayName: e.displayName!, appVersion: e.appVersion, lastSeen: e.at }))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  }, [events]);

  const eventTypes = useMemo(() => [...new Set(events.map((e) => e.event))].sort(), [events]);

  return { available, events, loading, error, refresh, screenCounts, actionCounts, officers, eventTypes };
}
