import { useMemo, useState } from 'react';
import { Input } from '../../../design-system/Input';
import type { RecipeCatalogue } from '../../../professions/types';

const SUGGEST_CAP = 8;

interface ItemSearchInputProps {
  value: string;
  onChange: (v: string) => void;
  profession: string;
  catalogue: RecipeCatalogue;
}

/**
 * The "what you need" field for a crafting request — a typeahead against the recipe
 * catalogue (same data built for the Coverage tab), scoped to the selected profession, per
 * the user's explicit request that this search real items rather than being plain free text.
 * Not a strict picker: suggestions help, but whatever is typed still posts as-is if nothing
 * matches (a specific ilvl, a non-recipe ask) — see the design handoff's own hint copy.
 */
export function ItemSearchInput({ value, onChange, profession, catalogue }: ItemSearchInputProps) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const known = new Set<string>();
    for (const recipes of Object.values(catalogue[profession] ?? {})) for (const name of recipes) known.add(name);
    return [...known].filter((name) => name.toLowerCase().includes(q)).slice(0, SUGGEST_CAP);
  }, [value, profession, catalogue]);

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <Input
        label="What you need"
        multiline
        rows={3}
        placeholder="Item, recipe or enchant — mats provided?"
        hint="Anyone can post. Officers tick it off when it is done."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 30,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-soft)',
            borderRadius: 5,
            boxShadow: 'var(--shadow-4)',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {suggestions.map((name) => (
            <div
              key={name}
              onMouseDown={(e) => e.preventDefault()} // suppress the textarea's blur so this click reaches onClick below, not a vanished dropdown
              onClick={() => {
                onChange(name);
                setFocused(false);
              }}
              className="crd-suggest-row"
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--text-body-s)', color: 'var(--text-body)', borderBottom: '1px solid rgba(212,179,88,.07)' }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
