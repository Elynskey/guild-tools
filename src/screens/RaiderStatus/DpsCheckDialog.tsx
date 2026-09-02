import { useEffect, useState } from 'react';
import { Dialog } from '../../design-system/Dialog';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { Icon } from '../../design-system/Icon';
import { BossIcon } from '../../raid/BossIcon';
import { TIER_BOSS_NAMES } from '../../raid/bossIcons';
import { useSettings } from '../Settings/useSettings';

interface DpsCheckDialogProps {
  onClose: () => void;
  /** Called after a successful save -- Raider Status uses this to re-fetch the
   * roster so the new minimum/exclusions show up without a manual refresh. */
  onSaved?: () => void;
}

/**
 * The same minimum-DPS field and per-boss exclusion checkboxes as the Settings
 * screen's "Raid info" / "DPS check exclusions" cards, surfaced right on Raider
 * Status too -- officers kept expecting a visible control here rather than having
 * to know a separate Settings page exists. Reuses useSettings() directly (same
 * IPC/save path as Settings.tsx) rather than duplicating the load/save logic;
 * channel IDs and the Discord bot invite stay Settings-only since they're
 * unrelated to what this dialog is for.
 */
export function DpsCheckDialog({ onClose, onSaved }: DpsCheckDialogProps) {
  const { settings, loading, saving, savedAt, save, available } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(settings);
  }, [settings, dirty]);

  const setMinDps = (value: string) => {
    const num = Number(value);
    setDraft({ ...draft, minDps: Number.isFinite(num) ? num : draft.minDps });
    setDirty(true);
  };

  const toggleBossExclusion = (boss: string) => {
    const excluded = draft.excludedBossesFromDps.includes(boss) ? draft.excludedBossesFromDps.filter((b) => b !== boss) : [...draft.excludedBossesFromDps, boss];
    setDraft({ ...draft, excludedBossesFromDps: excluded });
    setDirty(true);
  };

  const submit = () => {
    setDirty(false);
    void save(draft).then(() => onSaved?.());
  };

  return (
    <Dialog open onClose={onClose} width={440} eyebrow="Raider Status" title="DPS check settings">
      {!available ? (
        <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 'var(--text-body-s)' }}>Settings require the desktop app -- nothing to configure in a browser preview.</div>
      ) : loading ? (
        <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 'var(--text-body-s)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Minimum DPS"
            type="number"
            value={String(draft.minDps)}
            onChange={(e) => setMinDps(e.target.value)}
            hint="Damage/time-alive a DPS raider needs to clear 100% on the DPS check."
          />

          <div>
            <div className="crd-eyebrow" style={{ marginBottom: 6 }}>
              Boss exclusions
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-muted)' }}>
              Uncheck a boss to drop its kills from the DPS check tier-wide. Deaths, gear, and healer/tank percentile are unaffected.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
              {TIER_BOSS_NAMES.map((boss) => {
                const included = !draft.excludedBossesFromDps.includes(boss);
                return (
                  <span
                    key={boss}
                    className="crd-choice"
                    role="checkbox"
                    aria-checked={included}
                    tabIndex={0}
                    onClick={() => toggleBossExclusion(boss)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleBossExclusion(boss);
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                  >
                    <span className="crd-choice__box crd-choice__box--check" data-checked={included}>
                      {included && <Icon name="check" size={13} />}
                    </span>
                    <BossIcon boss={boss} size={20} />
                    {boss}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button onClick={submit} disabled={saving || !dirty} iconLeft="check">
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {!dirty && savedAt !== null && <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--status-success)' }}>Saved</span>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
