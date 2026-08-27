import { useEffect, useState } from 'react';
import type { UpdateInfo } from '../electron';

/** Checks once per launch against the public version manifest (electron/dataSources/updateCheck.cjs). */
export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    void window.electronAPI.checkForUpdate().then(setUpdateInfo);
  }, []);

  return {
    updateInfo: dismissed ? null : updateInfo,
    dismiss: () => setDismissed(true),
    openReleasePage: () => {
      if (updateInfo) void window.electronAPI?.openReleasePage(updateInfo.releaseUrl);
    },
  };
}
