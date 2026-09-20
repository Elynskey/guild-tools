import { useEffect, useState } from 'react';

/**
 * Unmissable strip across the very top of the window whenever this install is a
 * "Guild Tools (Test)" build (see electron/dataSources/proxyConfig.cjs) -- Raid
 * Signups/GOTM from here post to a staging server (e.g. CRD-TEST), never the real
 * guild's channels, but everything else in the app (Raider Status, Loot History, etc.)
 * still shows real production data. This banner exists so nobody mistakes a test
 * install for the real one mid-demo and assumes a post went where it didn't.
 */
export function TestModeBanner() {
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    void window.electronAPI?.isTestMode().then(setTestMode);
  }, []);

  if (!testMode) return null;

  // Normal flow, not fixed -- every screen already has its own sticky (position:
  // sticky; top: 0) header, and a fixed overlay here would sit on top of those and
  // hide real controls (confirmed live: it covered Landing's Sign Out link entirely).
  // Living in normal flow above everything just pushes the whole app down by its own
  // height once, with no per-screen coordination needed.
  return (
    <div
      style={{
        padding: '5px 12px',
        textAlign: 'center',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-micro)',
        fontWeight: 700,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: '#1a1409',
        background: 'linear-gradient(90deg, var(--gold-300), var(--gold-400))',
        userSelect: 'none',
      }}
    >
      Test Mode -- Raid Signups, Guildie of the Month and Loot are separate from the real guild (staging server, own test loot log)
    </div>
  );
}
