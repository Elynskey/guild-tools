import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../design-system/Crest';
import { useTestMode } from '../shared/useTestMode';
import { DeveloperBanner } from './DeveloperBanner';

/** Only renders its children in the "Guild Tools (Test)" build, under a yellow "Developer" banner. In a normal install the route is a polite dead end, not a screen. */
export function TestOnly({ children }: { children: ReactNode }) {
  const testMode = useTestMode();
  if (testMode === null) return null; // one tick to find out, no flash of the wrong thing
  if (testMode) {
    return (
      <>
        <DeveloperBanner />
        {children}
      </>
    );
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', color: 'var(--text-body)', fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
      <Crest size={56} />
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', color: 'var(--text-strong)' }}>Test builds only</div>
      <div style={{ maxWidth: 420, color: 'var(--text-muted)', fontSize: 'var(--text-body-s)', lineHeight: 1.6 }}>This tool lives in Guild Tools (Test), not in the version officers use.</div>
      <Link to="/">Back to Guild Tools</Link>
    </div>
  );
}
