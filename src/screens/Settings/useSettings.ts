import { useCallback, useEffect, useState } from 'react';
import type { GuildToolsSettings } from '../../electron';

const EMPTY: GuildToolsSettings = { craftOrdersChannelId: '', raidSignupsChannelId: '', lootLogChannelId: '' };

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

  const save = useCallback(
    (next: GuildToolsSettings) => {
      setSettings(next);
      if (!electron) return;
      setSaving(true);
      void electron
        .saveSettings(next)
        .then((saved) => {
          setSettings(saved);
          setSavedAt(Date.now());
        })
        .finally(() => setSaving(false));
    },
    [electron],
  );

  return { settings, loading, saving, savedAt, save, available: !!electron };
}
