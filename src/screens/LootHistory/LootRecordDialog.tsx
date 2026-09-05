import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { IconSelect } from '../../design-system/IconSelect';
import { BossIcon } from '../../raid/BossIcon';
import { classCanEquip } from '../../raid/classArmor';
import type { BossLootTable } from '../../electron';
import { itemLabel } from '../../raid/lootLogic';
import type { LootEntry } from '../../raid/lootLogic';

interface LootRecordDialogProps {
  /** Present when editing an existing record; absent when adding a new one. */
  entry?: LootEntry;
  onClose: () => void;
  /** keepOpen: true for "Save & add another" (dialog stays open for the next item on the same night) -- only ever true from the add flow, never from edit. Resolves false on failure (e.g. a duplicate-win rejection) so the dialog knows to stay open and show saveError instead of clearing its fields as if it had succeeded. */
  onSave: (fields: { winner: string; itemName: string; boss: string; slot: string; time?: number; itemId?: number | null }, keepOpen: boolean) => Promise<boolean>;
  onDelete?: () => void;
  saving: boolean;
  /** Set when the most recent save attempt failed (e.g. manualAdd's duplicate-win check) -- cleared automatically on the next attempt. */
  saveError?: string | null;
  /** Null when unavailable (no Electron, no proxy, or a failed live fetch with nothing cached) -- the add flow falls back to plain text fields in that case. */
  bossLootTable?: BossLootTable | null;
  /** Character name -> class, from the live roster -- drives item eligibility filtering. */
  classByName?: Record<string, string>;
  itemIcons?: Record<number, string | null>;
}

/** Unix seconds -> the local-time string a `datetime-local` input expects ("YYYY-MM-DDTHH:mm"). Built from local date/time parts, not toISOString (which is UTC), so the picker shows and edits wall-clock time -- what an officer typing in a raid's actual start time means. */
function toDatetimeLocalValue(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of toDatetimeLocalValue -- the input's value is already local time, so `new Date(str)` (no "Z") parses it as local, same as the picker displayed it. */
function fromDatetimeLocalValue(value: string): number | undefined {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
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

function buildBossOptions(bossLootTable: BossLootTable) {
  return bossLootTable.bosses.map((b) => ({ value: b.name, label: b.name, icon: <BossIcon boss={b.name} size={28} /> }));
}

/** Finds the item ID in this tier's loot table matching an existing entry's boss+item name, so editing can pre-select the same smart-picker fields instead of starting blank. Null if the entry's boss isn't in this tier's table, or its item name doesn't match any of that boss's drops (old data, a different tier, or something the addon captured that isn't in the Journal) -- the caller falls back to plain text fields in that case rather than risk silently discarding it. */
function findMatchingItemId(bossLootTable: BossLootTable, boss: string | null | undefined, itemName: string): number | null {
  if (!boss) return null;
  const ids = bossLootTable.lootByBoss[boss] ?? [];
  const match = ids.find((id) => bossLootTable.items[id]?.name === itemName);
  return match ?? null;
}

/**
 * The smart add flow: character -> verified class -> boss -> class-eligible items (from
 * this tier's real loot table) -> slot auto-filled from the item. Used for both adding
 * and editing whenever a loot table loaded AND (for editing) the entry's existing
 * boss+item actually matches something in it -- see findMatchingItemId/useSmartAdd.
 */
function SmartAddFields({
  winner,
  setWinner,
  bossLootTable,
  classByName,
  itemIcons,
  initialBoss = null,
  initialItemId = null,
  onPick,
}: {
  winner: string;
  setWinner: (v: string) => void;
  bossLootTable: BossLootTable;
  classByName: Record<string, string>;
  itemIcons: Record<number, string | null>;
  /** Pre-selects the pickers to an existing entry's values (editing) instead of starting blank (adding). */
  initialBoss?: string | null;
  initialItemId?: number | null;
  onPick: (fields: { boss: string; itemName: string; slot: string; itemId: number }) => void;
}) {
  const [boss, setBoss] = useState<string | null>(initialBoss);
  const [itemId, setItemId] = useState<number | null>(initialItemId);

  const matchedClass = lookupClass(winner, classByName);

  const bossOptions = useMemo(() => buildBossOptions(bossLootTable), [bossLootTable]);

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

  // Clears the item whenever the boss actually CHANGES -- compared against the last
  // boss value seen, not "has this effect run before": a boolean/ref flag breaks under
  // React 18 StrictMode's dev-only double-invoke of effects (confirmed live -- see the
  // matching comment in useProfessions.ts), which re-runs this with the SAME initial
  // `boss` value a second time and would otherwise look identical to a real change,
  // wiping out initialItemId (an edit's pre-selected item) right after the first paint.
  const prevBoss = useRef(initialBoss);
  useEffect(() => {
    if (boss === prevBoss.current) return;
    prevBoss.current = boss;
    setItemId(null);
  }, [boss]);

  useEffect(() => {
    if (boss && selectedItem && itemId != null) onPick({ boss, itemName: selectedItem.name, slot: selectedItem.slot, itemId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss, selectedItem, itemId]);

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
export function LootRecordDialog({ entry, onClose, onSave, onDelete, saving, bossLootTable, classByName = {}, itemIcons = {}, saveError }: LootRecordDialogProps) {
  const [winner, setWinner] = useState(entry?.winner ?? '');
  const [itemName, setItemName] = useState(entry ? itemLabel(entry.itemLink) : '');
  const [boss, setBoss] = useState(entry?.boss ?? '');
  const [slot, setSlot] = useState(entry?.slot ?? '');
  // Only ever set via the smart picker (a real item from this tier's loot table) --
  // stays null for the plain-text fallback fields and for editing, same as before this
  // existed. Lets a manual add still resolve a real icon instead of always going iconless.
  const [itemId, setItemId] = useState<number | null>(null);
  // Only meaningful for add (not edit) -- lets an officer logging a night after the fact
  // set the real date once, then add several items under it without re-picking each time.
  // Defaults to now; only sent along if actually adding.
  const [time, setTime] = useState(() => Math.floor(Date.now() / 1000));
  // Bumped on every "Save & add another" -- remounts SmartAddFields so its own internal
  // boss/item selection clears, without losing the chosen date/time above.
  const [formKey, setFormKey] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);

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

  // Editing gets the same smart picker as adding whenever the entry's existing
  // boss+item actually matches something in this tier's loot table (pre-selected, not
  // blank) -- falls back to the plain text form only when it doesn't (old data, a
  // different tier, or something the addon captured that isn't in the Journal), so
  // switching to the dropdown flow can never silently discard a real value.
  const matchedItemId = entry && bossLootTable ? findMatchingItemId(bossLootTable, entry.boss, itemLabel(entry.itemLink)) : null;
  const useSmartAdd = !!bossLootTable && (!entry || matchedItemId != null);
  const canSave = !!winner.trim() && !!itemName.trim() && !saving;

  const commit = async (keepOpen: boolean) => {
    const wasAdded = itemName.trim();
    const wasWinner = winner.trim();
    const ok = await onSave({ winner: wasWinner, itemName: wasAdded, boss: boss.trim(), slot: slot.trim(), time: entry ? undefined : time, itemId }, keepOpen);
    // A rejected save (e.g. a duplicate-win check) must NOT clear the fields as if it
    // had gone through -- that would just discard what the officer typed with no way
    // to retry it. Only reset for "add another" once the save actually succeeded.
    if (ok && keepOpen) {
      setJustAdded(`${wasAdded} logged for ${wasWinner}.`);
      setWinner('');
      setItemName('');
      setBoss('');
      setSlot('');
      setItemId(null);
      setFormKey((k) => k + 1);
    }
  };

  return (
    <Dialog
      title={entry ? 'Edit loot entry' : 'Add loot entry'}
      eyebrow="Manual correction"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          {entry && onDelete ? (
            <Button variant="danger" onClick={onDelete} disabled={saving}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {!entry && (
              <Button variant="secondary" disabled={!canSave} onClick={() => commit(true)}>
                Save &amp; add another
              </Button>
            )}
            <Button variant="primary" disabled={!canSave} onClick={() => commit(false)}>
              {saving ? 'Saving…' : entry ? 'Save' : 'Save & close'}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!entry && (
          <Input
            type="datetime-local"
            label="Raid night"
            value={toDatetimeLocalValue(time)}
            onChange={(e) => setTime(fromDatetimeLocalValue(e.target.value) ?? time)}
            hint="Set this once when logging a past night -- it stays put for every item you add below, so they all land in the same night."
          />
        )}
        {saveError && <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--status-danger)' }}>{saveError}</p>}
        {justAdded && !saveError && (
          <p style={{ margin: 0, fontSize: 'var(--text-body-s)', color: 'var(--status-success)' }}>{justAdded} Add the next item, or Save &amp; close when done.</p>
        )}
        {useSmartAdd ? (
          <SmartAddFields
            key={formKey}
            winner={winner}
            setWinner={setWinner}
            bossLootTable={bossLootTable}
            classByName={classByName}
            itemIcons={itemIcons}
            initialBoss={entry?.boss ?? null}
            initialItemId={matchedItemId}
            onPick={(fields) => {
              setBoss(fields.boss);
              setItemName(fields.itemName);
              setSlot(fields.slot);
              setItemId(fields.itemId);
            }}
          />
        ) : (
          <>
            <Input label="Winner" placeholder="Character name" value={winner} onChange={(e) => setWinner(e.target.value)} autoFocus />
            <Input label="Item" placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            {/* The item didn't match this tier's loot table (see useSmartAdd), but the boss
                itself still might -- picking from the real list beats free-typing it, and
                doesn't risk discarding anything since Item/Slot stay free text regardless. */}
            {bossLootTable ? (
              <IconSelect label="Boss" placeholder="Select a boss" options={buildBossOptions(bossLootTable)} value={boss || null} onChange={(v) => setBoss(v)} />
            ) : (
              <Input label="Boss" placeholder="Optional" value={boss} onChange={(e) => setBoss(e.target.value)} />
            )}
            <Input label="Slot" placeholder="Optional -- e.g. Head, Trinket" value={slot} onChange={(e) => setSlot(e.target.value)} />
          </>
        )}
      </div>
    </Dialog>
  );
}
