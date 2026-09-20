import { useCallback, useEffect, useState } from 'react';
import { config } from '../../config';
import type { GuildToolsSettings } from '../../electron';

const EMPTY: GuildToolsSettings = {
  raidSignupsChannelId: '',
  lootLogChannelId: '',
  gotmChannelId: '',
  testRaidSignupsChannelId: '',
  testGotmChannelId: '',
  testLootLogChannelId: '',
  gates: { ...config.gates },
  minDps: 0,
  autoPostLoot: true,
  excludedBossesFromDps: [],
};

// Officer-wide, server-persisted via the API proxy when configured (see
// electron/dataSources/fetchSettings.cjs) -- there's no meaningful browser-preview
// fallback here (channel IDs are meaningless outside a real Electron+proxy setup), so
// this hook is a no-op outside window.electronAPI rather than pretending to save.
export function useSettings() {
  const electron = window.electronAPI;
  const [settings, setSettings] = useState<GuildToolsSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!electron) {
      setLoading(false);
      return;
    }
    electron.getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [electron]);

  // Waits for the proxy round-trip before touching `settings`/`savedAt` -- an earlier
  // version updated `settings` optimistically before the network call resolved, so a
  // failed save (proxy unreachable, etc.) looked identical to a successful one: the
  // field kept showing the typed value with no error, and only a reload would reveal
  // it never actually persisted.
  const save = useCallback(
    (next: GuildToolsSettings): Promise<boolean> => {
      if (!electron) return Promise.resolve(false);
      setSaving(true);
      setSaveError(null);
      return electron
        .saveSettings(next)
        .then((saved) => {
          setSettings(saved);
          setSavedAt(Date.now());
          return true;
        })
        .catch((err: Error) => {
          setSaveError(err.message || 'Could not save settings.');
          return false;
        })
        .finally(() => setSaving(false));
    },
    [electron],
  );

  return { settings, loading, saving, savedAt, saveError, save, available: !!electron };
}
