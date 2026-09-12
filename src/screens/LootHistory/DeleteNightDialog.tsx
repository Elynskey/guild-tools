import { Dialog } from '../../design-system/Dialog';
import { Button } from '../../design-system/Button';

interface DeleteNightDialogProps {
  entryCount: number;
  nightLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}

/** Confirm-before-delete: this removes every record/trade (and any background need-loss data) for the whole selected night in one irreversible action, so it always shows what's about to go -- no one-click bulk delete. */
export function DeleteNightDialog({ entryCount, nightLabel, onClose, onConfirm, deleting, error }: DeleteNightDialogProps) {
  return (
    <Dialog
      title="Delete this raid night?"
      eyebrow="Loot History"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : `Delete ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
          </Button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>
        This permanently deletes every loot record and trade logged for <b>{nightLabel}</b> -- {entryCount} {entryCount === 1 ? 'entry' : 'entries'} shown
        below, plus any background Need-loss data from the same window. This can't be undone from the app, and it's tombstoned server-side so a later
        sync won't bring it back.
      </p>
      {error && <p style={{ margin: '12px 0 0', fontSize: 'var(--text-body-s)', color: 'var(--status-danger)' }}>{error}</p>}
    </Dialog>
  );
}
