import { HashRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './screens/Landing/Landing';
import { RaiderStatus } from './screens/RaiderStatus/RaiderStatus';
import { Professions } from './screens/Professions/Professions';
import { PullFeedback } from './screens/PullFeedback/PullFeedback';
import { UpdateBanner } from './shared/UpdateBanner';
import { VersionTag } from './shared/VersionTag';

// HashRouter, not BrowserRouter: the Electron production build loads index.html
// via file://, which has no server to resolve path-based routes — hash routing
// works identically in the Vite dev server, the browser build, and Electron.
export function App() {
  return (
    <HashRouter>
      <UpdateBanner />
      <VersionTag />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/raider-status" element={<RaiderStatus />} />
        <Route path="/professions" element={<Professions />} />
        <Route path="/pull-feedback" element={<PullFeedback />} />
      </Routes>
    </HashRouter>
  );
}
