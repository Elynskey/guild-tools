import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { IconSelect } from '../../design-system/IconSelect';
import { BossIcon } from '../../raid/BossIcon';
import { classCanEquip } from '../../raid/classArmor';
import type { BossLootTable } from '../../electron';
import type { LootEntry } from '../../raid/lootLogic';

interface LootRecordDialogProps {
  /** Present when editing an existing record; absent when adding a new one. */
  entry?: LootEntry;
  onClose: () => void;
  onSave: (fields: { winner: string; itemName: string; boss: string; slot: string }) => void;
  onDelete?: () => void;
  saving: boolean;
  /** Null when unavailable (no Electron, no proxy, or a failed live fetch with nothing cached) -- the add flow falls back to plain text fields in that case. */
  bossLootTable?: BossLootTable | null;
  /** Character name -> class, from the live roster -- drives item eligibility filtering. */
  classByName?: Record<string, string>;
  itemIcons?: Record<number, string | null>;
}

function itemLabel(link: string): string {
  const match = link.match(/\[(.+)\]/);
  return match ? match[1] : link;
}

function itemIconImg(url: string | null | undefined) {
  if (!url) return undefined;
  return <img src={url} alt="" style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--border-iron)', flex: 'none', objectFit: 'cover' }} />;
}

/** Character name -> class, case-insensitive fallback for a name typed with different casing than the roster's. */
function lookupClass(name: string, classByName: Record<string, string>): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (classByName[trimmed]) return classByName[trimmed];
  const lower = trimmed.toLowerCase();
  const match = Object.entries(classByName).find(([n]) => n.toLowerCase() === lower);
  return match?.[1] ?? null;
}

/**
 * The smart add flow: character -> verified class -> boss -> class-eligible items (from
 * this tier's real loot table) -> slot auto-filled from the item. Used only when adding
 * (not editing) and only when a loot table actually loaded -- see bossLootTable prop.
 */
function SmartAddFields({
  winner,
  setWinner,
  bossLootTable,
  classByName,
  itemIcons,
  onPick,
}: {
  winner: string;
  setWinner: (v: string) => void;
  bossLootTable: BossLootTable;
  classByName: Record<string, string>;
  itemIcons: Record<number, string | null>;
  onPick: (fields: { boss: string; itemName: string; slot: string }) => void;
}) {
  const [boss, setBoss] = useState<string | null>(null);
  const [itemId, setItemId] = useState<number | null>(null);

  const matchedClass = lookupClass(winner, classByName);

  const bossOptions = useMemo(
    () => bossLootTable.bosses.map((b) => ({ value: b.name, label: b.name, icon: <BossIcon boss={b.name} size={18} /> })),
    [bossLootTable],
  );

  const itemOptions = useMemo(() => {
    if (!boss) return [];
    const ids = bossLootTable.lootByBoss[boss] ?? [];
    return ids
      .map((id) => {
        const detail = bossLootTable.items[id];
        return detail ? { id, ...detail } : null;
      })
      .filter((x): x is { id: number; name: string; slot: string; armorWeight: string | null } => x != null)
      .filter((it) => !matchedClass || classCanEquip(matchedClass, it.armorWeight))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((it) => ({ value: String(it.id), label: it.name, icon: itemIconImg(itemIcons[it.id]) }));
  }, [boss, bossLootTable, matchedClass, itemIcons]);

  const selectedItem = itemId != null ? bossLootTable.items[itemId] : null;

  useEffect(() => {
    setItemId(null);
  }, [boss]);

  useEffect(() => {
    if (boss && selectedItem) onPick({ boss, itemName: selectedItem.name, slot: selectedItem.slot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss, selectedItem]);

  return (
    <>
      <Input
        label="Winner"
        placeholder="Character name"
        value={winner}
        onChange={(e) => setWinner(e.target.value)}
        autoFocus
        hint={winner.trim() ? (matchedClass ? `Class: ${matchedClass}` : "Class unknown -- showing every boss's full item list") : undefined}
      />
      <IconSelect label="Boss" placeholder="Select a boss" options={bossOptions} value={boss} onChange={(v) => setBoss(v)} />
      <IconSelect
        label="Item"
        placeholder={boss ? 'Select an item' : 'Pick a boss first'}
        options={itemOptions}
        value={itemId != null ? String(itemId) : null}
        onChange={(v) => setItemId(Number(v))}
        disabled={!boss}
      />
      <Input label="Slot" value={selectedItem?.slot ?? ''} readOnly disabled hint="Filled in automatically from the selected item" />
    </>
  );
}

/** Manual correction tool -- for whatever neither the addon's chat parser nor its C_LootHistory capture caught (or caught wrong). */
export function LootRecordDialog({ entry, onClose, onSave, onDelete, saving, bossLootTable, classByName = {}, itemIcons = {} }: LootRecordDialogProps) {
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

  // Editing an existing record keeps the plain text form -- the entry's original boss/
  // item text doesn't necessarily match a real entry in this tier's loot table (old
  // data, a different tier, or something the addon captured that isn't in the Journal),
  // so forcing it through the dropdown flow would risk silently discarding it.
  const useSmartAdd = !entry && !!bossLootTable;

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
        {useSmartAdd ? (
          <SmartAddFields
            winner={winner}
            setWinner={setWinner}
            bossLootTable={bossLootTable}
            classByName={classByName}
            itemIcons={itemIcons}
            onPick={(fields) => {
              setBoss(fields.boss);
              setItemName(fields.itemName);
              setSlot(fields.slot);
            }}
          />
        ) : (
          <>
            <Input label="Winner" placeholder="Character name" value={winner} onChange={(e) => setWinner(e.target.value)} autoFocus />
            <Input label="Item" placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            <Input label="Boss" placeholder="Optional" value={boss} onChange={(e) => setBoss(e.target.value)} />
            <Input label="Slot" placeholder="Optional -- e.g. Head, Trinket" value={slot} onChange={(e) => setSlot(e.target.value)} />
          </>
        )}
      </div>
    </Dialog>
  );
}
