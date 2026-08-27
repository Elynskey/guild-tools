import { HashRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './screens/Landing/Landing';
import { RaiderStatus } from './screens/RaiderStatus/RaiderStatus';
import { Professions } from './screens/Professions/Professions';

// HashRouter, not BrowserRouter: the Electron production build loads index.html
// via file://, which has no server to resolve path-based routes — hash routing
// works identically in the Vite dev server, the browser build, and Electron.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/raider-status" element={<RaiderStatus />} />
        <Route path="/professions" element={<Professions />} />
      </Routes>
    </HashRouter>
  );
}
