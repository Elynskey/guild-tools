import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog } from '../design-system/Dialog';
import { Input } from '../design-system/Input';
import { Button } from '../design-system/Button';
import { Toast } from '../design-system/Toast';
import { IconButton } from '../design-system/IconButton';

// One friendly label per route -- falls back to the raw path for anything not listed
// here (a new screen added later, say) rather than showing nothing.
const SCREEN_LABELS: Record<string, string> = {
  '/': 'Landing',
  '/raider-status': 'Raider Status',
  '/professions': 'Professions',
  '/pull-feedback': 'Pull Feedback',
  '/loot-history': 'Loot History',
  '/loot-report': 'Season Loot Report',
  '/mythic-plus': 'M+ Keys',
  '/settings': 'Settings',
  '/raid-signups': 'Raid Signups',
  '/gotm': 'Guildie of the Month',
};

interface FeedbackButtonProps {
  displayName: string | null;
}

/**
 * A persistent way to send feedback straight to the maintainer's Discord DMs, present
 * on every screen -- no separate channel to remember to check, no GitHub account
 * needed. Works identically from the real app and a test-mode build (the message
 * itself notes which one sent it); requires the desktop app connected to the proxy,
 * same as every other Discord-posting feature.
 */
export function FeedbackButton({ displayName }: FeedbackButtonProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const screen = SCREEN_LABELS[location.pathname] ?? location.pathname;
  const available = !!window.electronAPI;

  const submit = () => {
    if (!window.electronAPI || !message.trim()) return;
    setSending(true);
    setError(null);
    window.electronAPI
      .sendFeedback(message.trim(), screen, displayName)
      .then(() => {
        setSentAt(Date.now());
        setMessage('');
      })
      .catch((err: Error) => setError(err.message || 'Could not send feedback.'))
      .finally(() => setSending(false));
  };

  const close = () => {
    setOpen(false);
    // Cleared on close, not on send, so a success Toast stays visible for the brief
    // moment the dialog is closing instead of flashing away instantly.
    setSentAt(null);
    setError(null);
  };

  return (
    <>
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 50 }}>
        <IconButton icon="message-circle" label="Send feedback" framed onClick={() => setOpen(true)} />
      </div>

      {open && (
        <Dialog
          title="Send feedback"
          eyebrow={screen}
          onClose={close}
          footer={
            <Button variant="primary" disabled={!available || !message.trim() || sending} onClick={submit}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!available ? (
              <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--text-muted)' }}>
                Feedback requires the desktop app -- nothing to send from a browser preview.
              </p>
            ) : (
              <>
                <Input
                  multiline
                  label="What's going on?"
                  placeholder="A bug, an idea, anything that'd help"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  autoFocus
                />
                <p style={{ margin: 0, fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                  Sent as a direct message, straight to Ethan -- includes this screen name so there's no need to say
                  where you are.
                </p>
              </>
            )}
            {sentAt !== null && <Toast tone="success" title="Sent" message="Thanks -- it's on its way." />}
            {error && <Toast tone="danger" title="Couldn't send" message={error} />}
          </div>
        </Dialog>
      )}
    </>
  );
}
