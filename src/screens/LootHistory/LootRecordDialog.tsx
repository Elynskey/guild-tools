import { useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import type { LootEntry } from '../../raid/lootLogic';

interface LootRecordDialogProps {
  /** Present when editing an existing record; absent when adding a new one. */
  entry?: LootEntry;
  onClose: () => void;
  onSave: (fields: { winner: string; itemName: string; boss: string; slot: string }) => void;
  onDelete?: () => void;
  saving: boolean;
}

function itemLabel(link: string): string {
  const match = link.match(/\[(.+)\]/);
  return match ? match[1] : link;
}

/** Manual correction tool -- for whatever neither the addon's chat parser nor its C_LootHistory capture caught (or caught wrong). Item is entered by name only, since an officer typing this by hand has no real item link to give it. */
export function LootRecordDialog({ entry, onClose, onSave, onDelete, saving }: LootRecordDialogProps) {
  const [winner, setWinner] = useState(entry?.winner ?? '');
  const [itemName, setItemName] = useState(entry ? itemLabel(entry.itemLink) : '');
  const [boss, setBoss] = useState(entry?.boss ?? '');
  const [slot, setSlot] = useState(entry?.slot ?? '');

  // A standalone trade (no matching win record) isn't a "win" the app tracked -- it's
  // just a record that this character traded an item to someone. Nothing to edit, only
  // remove, since there's no winner/boss/slot for a trade to have been wrong about.
  if (entry?.standaloneTrade) {
    return (
      <Dialog
        title="Remove trade record"
        eyebrow="Manual correction"
        onClose={onClose}
        footer={
          <Button variant="danger" onClick={onDelete} disabled={saving || !onDelete}>
            {saving ? 'Removing…' : 'Remove'}
          </Button>
        }
      >
        <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-body)' }}>
          {itemLabel(entry.itemLink)} -- traded from <b>{entry.winner}</b> to <b>{entry.tradedTo}</b>. This isn't a tracked Need win, only a
          trade record -- there's nothing to edit, just remove it if it shouldn't be here.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={entry ? 'Edit loot entry' : 'Add loot entry'}
      eyebrow="Manual correction"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {entry && onDelete ? (
            <Button variant="danger" onClick={onDelete} disabled={saving}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" disabled={!winner.trim() || !itemName.trim() || saving} onClick={() => onSave({ winner: winner.trim(), itemName: itemName.trim(), boss: boss.trim(), slot: slot.trim() })}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Winner" placeholder="Character name" value={winner} onChange={(e) => setWinner(e.target.value)} autoFocus />
        <Input label="Item" placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
        <Input label="Boss" placeholder="Optional" value={boss} onChange={(e) => setBoss(e.target.value)} />
        <Input label="Slot" placeholder="Optional -- e.g. Head, Trinket" value={slot} onChange={(e) => setSlot(e.target.value)} />
      </div>
    </Dialog>
  );
}
