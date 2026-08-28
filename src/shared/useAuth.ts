import { useCallback, useEffect, useState } from 'react';

/**
 * Battle.net sign-in gate for the desktop app. Only enforced inside the real
 * Electron app -- outside it (plain browser/dev preview, no window.electronAPI),
 * there's no real data to protect anyway, same reasoning as the sample-data
 * fallback everywhere else in this app.
 *
 * Session lives in Electron's main-process memory only (see main.cjs), reset every
 * app launch by design -- sign in once per session rather than a persisted token.
 */
export function useAuth() {
  const required = !!window.electronAPI;
  const [battletag, setBattletag] = useState<string | null>(null);
  const [checking, setChecking] = useState(required);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!required) return;
    window.electronAPI!
      .getAuthState()
      .then((state) => setBattletag(state?.battletag ?? null))
      .finally(() => setChecking(false));
  }, [required]);

  const signIn = useCallback(() => {
    if (!required) return;
    setSigningIn(true);
    setError(null);
    window
      .electronAPI!.signIn()
      .then((state) => setBattletag(state.battletag))
      .catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed.'))
      .finally(() => setSigningIn(false));
  }, [required]);

  const signOut = useCallback(() => {
    if (!required) return;
    void window.electronAPI!.signOut().then(() => setBattletag(null));
  }, [required]);

  return {
    authenticated: !required || battletag !== null,
    battletag,
    checking,
    signingIn,
    error,
    signIn,
    signOut,
  };
}
