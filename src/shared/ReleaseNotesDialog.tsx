import { useState } from 'react';
import { Dialog } from '../design-system/Dialog';
import { Button } from '../design-system/Button';
import { notesToShow, RELEASE_NOTES, type ReleaseNote } from '../releaseNotes/releaseNotes';

const SEEN_KEY = 'guildTools.lastSeenReleaseNotes';

// localStorage can throw (blocked/cleared storage); the popup is a convenience, so a
// failure to read means "nothing recorded" and a failure to write just means it may show
// once more next launch -- never worth breaking the app over.
function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function writeLastSeen(version: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, version);
  } catch {
    // ignore -- see above
  }
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function Note({ note }: { note: ReleaseNote }) {
  return (
    <div>
      <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 2 }}>
        v{note.version} · {formatDate(note.date)}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-m)', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 10 }}>{note.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {note.highlights.map((h) => (
          <div key={h.heading}>
            <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 'var(--text-body-m)' }}>{h.heading}</div>
            <div style={{ color: 'var(--text-body)', fontSize: 'var(--text-body-s)', lineHeight: 1.55 }}>{h.body}</div>
          </div>
        ))}
      </div>
      {note.headsUp && (
        <div style={{ marginTop: 12, padding: '8px 12px', border: '1px solid var(--border-hairline)', borderLeft: '2px solid var(--status-warning)', borderRadius: 3, fontSize: 'var(--text-body-s)', color: 'var(--text-body)' }}>
          <b style={{ color: 'var(--status-warning)' }}>Heads up: </b>
          {note.headsUp}
        </div>
      )}
    </div>
  );
}

/** "What's new" popup: shown once after an update, for each release the officer hasn't seen notes for (see releaseNotes.ts). Closing it -- any way -- marks this version seen. */
export function ReleaseNotesDialog() {
  const [notes] = useState(() => notesToShow(RELEASE_NOTES, __APP_VERSION__, readLastSeen()));
  const [open, setOpen] = useState(notes.length > 0);

  if (!open || notes.length === 0) return null;

  const close = () => {
    writeLastSeen(__APP_VERSION__);
    setOpen(false);
  };

  return (
    <Dialog
      title="What's new in Guild Tools"
      eyebrow="Just updated"
      onClose={close}
      width={560}
      footer={
        <Button variant="primary" onClick={close}>
          Got it
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {notes.map((n) => (
          <Note key={n.version} note={n} />
        ))}
      </div>
    </Dialog>
  );
}
