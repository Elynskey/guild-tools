import { useEffect, useState } from 'react';

/**
 * Is this the "Guild Tools (Test)" build? null while the answer is still coming back, false in a normal
 * install or a plain browser preview. Test-only tools (Analytics, the Loot Logger Monitor) key off this,
 * so a normal officer install never shows them.
 */
export function useTestMode(): boolean | null {
  const [testMode, setTestMode] = useState<boolean | null>(null);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      setTestMode(false);
      return;
    }
    let live = true;
    api
      .isTestMode()
      .then((v) => live && setTestMode(!!v))
      .catch(() => live && setTestMode(false));
    return () => {
      live = false;
    };
  }, []);
  return testMode;
}
