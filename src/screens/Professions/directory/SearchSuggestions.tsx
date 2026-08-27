import type { SuggestionGroup } from '../../../professions/directoryLogic';

interface SearchSuggestionsProps {
  groups: SuggestionGroup[];
  visible: boolean;
  onPickCharacter: (name: string) => void;
  onPickProfession: (name: string) => void;
  onPickRecipe: (name: string) => void;
}

export function SearchSuggestions({ groups, visible, onPickCharacter, onPickProfession, onPickRecipe }: SearchSuggestionsProps) {
  if (!visible) return null;

  const pick = (kind: 'character' | 'profession' | 'recipe', value: string) => {
    if (kind === 'character') onPickCharacter(value);
    else if (kind === 'profession') onPickProfession(value);
    else onPickRecipe(value);
  };

  return (
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
        maxHeight: 420,
        overflow: 'auto',
      }}
    >
      {groups.map((g) => (
        <div key={g.label}>
          <div
            style={{
              padding: '8px 14px 5px',
              fontSize: 'var(--text-micro)',
              letterSpacing: 'var(--tracking-eyebrow)',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              background: 'var(--surface-raised)',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            {g.label}
          </div>
          {g.items.map((it) => (
            <div
              key={`${it.kind}-${it.value}`}
              onMouseDown={(e) => e.preventDefault()} // suppress the search field's blur so this click reaches onClick, not a vanished dropdown
              onClick={() => pick(it.kind, it.value)}
              className="crd-suggest-row"
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: '1px solid rgba(212,179,88,.07)' }}
            >
              <span style={{ flex: 1, color: 'var(--text-body)', fontSize: 'var(--text-body-s)' }}>{it.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>{it.meta}</span>
            </div>
          ))}
        </div>
      ))}
      {groups.length === 0 && <div style={{ padding: 14, color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>Nothing in the guild matches that.</div>}
    </div>
  );
}
