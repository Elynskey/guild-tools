import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { screenLabelFor } from './screenLabels';

/**
 * Renders nothing -- lives inside <HashRouter> purely to log a screen_view event on
 * every route change, same reason FeedbackButton needs useLocation(). This is the one
 * side of usage tracking that has to come from the renderer (main.cjs has no
 * visibility into client-side routing) -- every other tracked event fires from inside
 * main.cjs itself, see its `track()` helper.
 */
export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    void window.electronAPI?.trackEvent('screen_view', screenLabelFor(location.pathname));
  }, [location.pathname]);

  return null;
}
