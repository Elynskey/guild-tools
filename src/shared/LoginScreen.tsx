import { Crest } from '../design-system/Crest';
import { Button } from '../design-system/Button';

interface LoginScreenProps {
  signIn: () => void;
  signingIn: boolean;
  error: string | null;
}

export function LoginScreen({ signIn, signingIn, error }: LoginScreenProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-page)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-body)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 28,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Crest size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-m)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)' }}>
            Guild Tools
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 360, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Sign in with your Battle.net account to continue. Opens your browser -- your password never touches this app. We'll check that one of your characters is on the CRD roster.
        </p>
        <Button onClick={signIn} disabled={signingIn} iconLeft="log-in">
          {signingIn ? 'Waiting for browser…' : 'Sign in with Battle.net'}
        </Button>
        {error && <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--status-danger)' }}>{error}</p>}
      </div>
    </div>
  );
}
