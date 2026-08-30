import { HashRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './screens/Landing/Landing';
import { RaiderStatus } from './screens/RaiderStatus/RaiderStatus';
import { Professions } from './screens/Professions/Professions';
import { PullFeedback } from './screens/PullFeedback/PullFeedback';
import { LootHistory } from './screens/LootHistory/LootHistory';
import { SeasonLootReport } from './screens/SeasonLootReport/SeasonLootReport';
import { Settings } from './screens/Settings/Settings';
import { RaidSignups } from './screens/RaidSignups/RaidSignups';
import { UpdateBanner } from './shared/UpdateBanner';
import { VersionTag } from './shared/VersionTag';
import { LoginScreen } from './shared/LoginScreen';
import { useAuth } from './shared/useAuth';

// HashRouter, not BrowserRouter: the Electron production build loads index.html
// via file://, which has no server to resolve path-based routes — hash routing
// works identically in the Vite dev server, the browser build, and Electron.
export function App() {
  const auth = useAuth();

  if (auth.checking) return null; // one tick to read the existing session, no flash of the login screen
  if (!auth.authenticated) {
    return <LoginScreen signIn={auth.signInBattleNet} signingIn={auth.signingIn} error={auth.error} />;
  }

  return (
    <HashRouter>
      <UpdateBanner />
      <VersionTag />
      <Routes>
        <Route path="/" element={<Landing displayName={auth.displayName} signOut={auth.signOut} />} />
        <Route path="/raider-status" element={<RaiderStatus />} />
        <Route path="/professions" element={<Professions />} />
        <Route path="/pull-feedback" element={<PullFeedback />} />
        <Route path="/loot-history" element={<LootHistory />} />
        <Route path="/loot-report" element={<SeasonLootReport />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/raid-signups" element={<RaidSignups />} />
      </Routes>
    </HashRouter>
  );
}
