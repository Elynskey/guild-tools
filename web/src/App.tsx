import { useEffect, useState } from 'react';
import { fetchHeartbeats, fetchLoot, fetchProfessions, fetchRoster } from './api';
import { useLoad } from './useLoad';
import { timeAgo } from './format';
import { RaidersScreen } from './screens/RaidersScreen';
import { LootScreen } from './screens/LootScreen';
import { CaptureScreen } from './screens/CaptureScreen';

type Tab = 'raiders' | 'loot' | 'capture';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'raiders', label: 'Raiders', icon: '⚔' },
  { key: 'loot', label: 'Loot', icon: '◈' },
  { key: 'capture', label: 'Capture', icon: '◉' },
];

const readTab = (): Tab => {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'loot' || hash === 'capture' || hash === 'raiders') return hash;
  try {
    const saved = window.localStorage.getItem('gt.tab');
    if (saved === 'loot' || saved === 'capture' || saved === 'raiders') return saved;
  } catch {
    // remembering the tab is a convenience only
  }
  return 'raiders';
};

const MIN = 60_000;

export function App() {
  const [tab, setTabState] = useState<Tab>(readTab);
  const [, tick] = useState(0);
  // Roster is cached server-side for minutes, so it refreshes slowly; loot and officer status are cheap and change during a raid.
  const roster = useLoad(fetchRoster, 5 * MIN);
  const loot = useLoad(fetchLoot, 30_000);
  const beats = useLoad(fetchHeartbeats, 15_000);
  const professions = useLoad(fetchProfessions, 30 * MIN);

  const setTab = (t: Tab) => {
    setTabState(t);
    window.location.hash = t;
    try {
      window.localStorage.setItem('gt.tab', t);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onHash = () => setTabState(readTab());
    window.addEventListener('hashchange', onHash);
    const clock = setInterval(() => tick((n) => n + 1), 30_000); // keeps "4 min ago" honest between refreshes
    return () => {
      window.removeEventListener('hashchange', onHash);
      clearInterval(clock);
    };
  }, []);

  const active = tab === 'raiders' ? roster : tab === 'loot' ? loot : loot;
  const updated = active.updatedAt ? `updated ${timeAgo(active.updatedAt)}` : '';

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Guild Tools</h1>
          <span className="muted small">Casual Raid Days · officers · read-only {updated && `· ${updated}`}</span>
        </div>
        <button className="chip" onClick={() => { roster.refresh(); loot.refresh(); beats.refresh(); }} aria-label="Refresh everything">Refresh</button>
      </header>
      <main>
        {tab === 'raiders' && <RaidersScreen roster={roster} />}
        {tab === 'loot' && <LootScreen loot={loot} roster={roster} professions={professions} />}
        {tab === 'capture' && <CaptureScreen loot={loot} beats={beats} />}
      </main>
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
            <span className="ic" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
