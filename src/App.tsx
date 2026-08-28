import { HashRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './screens/Landing/Landing';
import { RaiderStatus } from './screens/RaiderStatus/RaiderStatus';
import { Professions } from './screens/Professions/Professions';
import { PullFeedback } from './screens/PullFeedback/PullFeedback';
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
  if (!auth.authenticated) return <LoginScreen signIn={auth.signIn} signingIn={auth.signingIn} error={auth.error} />;

  return (
    <HashRouter>
      <UpdateBanner />
      <VersionTag />
      <Routes>
        <Route path="/" element={<Landing battletag={auth.battletag} signOut={auth.signOut} />} />
        <Route path="/raider-status" element={<RaiderStatus />} />
        <Route path="/professions" element={<Professions />} />
        <Route path="/pull-feedback" element={<PullFeedback />} />
      </Routes>
    </HashRouter>
  );
}
