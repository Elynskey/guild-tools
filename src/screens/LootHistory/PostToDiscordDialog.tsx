import { Dialog } from '../../design-system/Dialog';
import { Button } from '../../design-system/Button';

interface PostToDiscordDialogProps {
  messages: string[];
  onClose: () => void;
  onConfirm: () => void;
  posting: boolean;
  error: string | null;
}

/** Confirm-before-send: posting is a real, visible, hard-to-take-back action (a message in the guild's Discord channel), so this always shows exactly what's about to go out before it's sent -- no one-click posting. */
export function PostToDiscordDialog({ messages, onClose, onConfirm, posting, error }: PostToDiscordDialogProps) {
  const bossCount = messages.length;

  return (
    <Dialog
      title="Post to Discord"
      eyebrow="Loot History"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={posting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={posting || bossCount === 0}>
            {posting ? 'Posting…' : `Post ${bossCount} message${bossCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>
          This posts one message per boss to the guild's configured loot channel, for everything shown in this raid night. It doesn't check
          whether this was already posted automatically -- only post if you mean to (re-announcing an older night, or after a correction).
        </p>
        <div
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-sunken)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {messages.map((m, i) => (
            <pre key={i} style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m}
            </pre>
          ))}
        </div>
        {error && <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--status-danger)' }}>{error}</p>}
      </div>
    </Dialog>
  );
}
