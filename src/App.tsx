import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './screens/Landing/Landing';
import { RaiderStatus } from './screens/RaiderStatus/RaiderStatus';
import { Professions } from './screens/Professions/Professions';
import { PullFeedback } from './screens/PullFeedback/PullFeedback';
import { LootHistory } from './screens/LootHistory/LootHistory';
import { SeasonLootReport } from './screens/SeasonLootReport/SeasonLootReport';
import { MythicPlus } from './screens/MythicPlus/MythicPlus';
import { Settings } from './screens/Settings/Settings';
import { RaidSignups } from './screens/RaidSignups/RaidSignups';
import { GuildieOfTheMonth } from './screens/GuildieOfTheMonth/GuildieOfTheMonth';
import { Analytics } from './screens/Analytics/Analytics';
import { UpdateBanner } from './shared/UpdateBanner';
import { VersionTag } from './shared/VersionTag';
import { TestModeBanner } from './shared/TestModeBanner';
import { FeedbackButton } from './shared/FeedbackButton';
import { ReleaseNotesDialog } from './shared/ReleaseNotesDialog';
import { AnalyticsTracker } from './shared/AnalyticsTracker';
import { LoginScreen } from './shared/LoginScreen';
import { useAuth } from './shared/useAuth';

// HashRouter, not BrowserRouter: the Electron production build loads index.html
// via file://, which has no server to resolve path-based routes — hash routing
// works identically in the Vite dev server, the browser build, and Electron.
export function App() {
  const auth = useAuth();
  const launched = useRef(false);

  // Fires once per session, the moment sign-in resolves -- doubles as the "who's
  // running what version" check-in alongside every screen_view (see AnalyticsTracker).
  useEffect(() => {
    if (auth.authenticated && !launched.current) {
      launched.current = true;
      void window.electronAPI?.trackEvent('app_launch', 'Landing');
    }
  }, [auth.authenticated]);

  if (auth.checking) return null; // one tick to read the existing session, no flash of the login screen
  if (!auth.authenticated) {
    return <LoginScreen signIn={auth.signInBattleNet} signingIn={auth.signingIn} error={auth.error} />;
  }

  return (
    <HashRouter>
      <AnalyticsTracker />
      <TestModeBanner />
      <UpdateBanner />
      <VersionTag />
      <ReleaseNotesDialog />
      <FeedbackButton displayName={auth.displayName} />
      <Routes>
        <Route path="/" element={<Landing displayName={auth.displayName} signOut={auth.signOut} />} />
        <Route path="/raider-status" element={<RaiderStatus />} />
        <Route path="/professions" element={<Professions />} />
        <Route path="/pull-feedback" element={<PullFeedback />} />
        <Route path="/loot-history" element={<LootHistory />} />
        <Route path="/loot-report" element={<SeasonLootReport />} />
        <Route path="/mythic-plus" element={<MythicPlus />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/raid-signups" element={<RaidSignups />} />
        <Route path="/gotm" element={<GuildieOfTheMonth />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </HashRouter>
  );
}
