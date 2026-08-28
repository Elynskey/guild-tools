import { useCallback, useEffect, useState } from 'react';

/**
 * Sign-in gate for the desktop app. Only enforced inside the real Electron app --
 * outside it (plain browser/dev preview, no window.electronAPI), there's no real data
 * to protect anyway, same reasoning as the sample-data fallback everywhere else in
 * this app. Either Discord or Battle.net satisfies the gate; Discord additionally
 * proves membership in the Casual Raid Days Discord server (see discordAuth.cjs),
 * Battle.net only proves account ownership.
 *
 * Session lives in Electron's main-process memory only (see main.cjs), reset every
 * app launch by design -- sign in once per session rather than a persisted token.
 */
export function useAuth() {
  const required = !!window.electronAPI;
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checking, setChecking] = useState(required);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!required) return;
    window.electronAPI!
      .getAuthState()
      .then((state) => setDisplayName(state?.displayName ?? null))
      .finally(() => setChecking(false));
  }, [required]);

  const signInWith = useCallback(
    (action: () => Promise<{ displayName: string }>) => {
      if (!required) return;
      setSigningIn(true);
      setError(null);
      action()
        .then((state) => setDisplayName(state.displayName))
        .catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed.'))
        .finally(() => setSigningIn(false));
    },
    [required],
  );

  const signInDiscord = useCallback(() => signInWith(() => window.electronAPI!.signInDiscord()), [signInWith]);
  const signInBattleNet = useCallback(() => signInWith(() => window.electronAPI!.signIn()), [signInWith]);

  const signOut = useCallback(() => {
    if (!required) return;
    void window.electronAPI!.signOut().then(() => setDisplayName(null));
  }, [required]);

  return {
    authenticated: !required || displayName !== null,
    displayName,
    checking,
    signingIn,
    error,
    signInDiscord,
    signInBattleNet,
    signOut,
  };
}
