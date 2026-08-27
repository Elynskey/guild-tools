import { useState } from 'react';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Select } from '../../design-system/Select';
import { Checkbox } from '../../design-system/Checkbox';
import { IconButton } from '../../design-system/IconButton';
import { useCraftRequests } from '../../professions/useCraftRequests';

interface RequestBoardProps {
  professionNames: string[];
}

export function RequestBoard({ professionNames }: RequestBoardProps) {
  const { requests, addRequest, toggleFulfilled, removeRequest } = useCraftRequests();
  const [requester, setRequester] = useState('');
  const [profession, setProfession] = useState(professionNames[0] ?? '');
  const [description, setDescription] = useState('');

  const submit = () => {
    if (!requester.trim() || !description.trim()) return;
    addRequest(requester.trim(), profession || 'Any', description.trim());
    setDescription('');
  };

  const open = requests.filter((r) => !r.fulfilled);
  const fulfilled = requests.filter((r) => r.fulfilled);

  return (
    <div className="crd-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-strong)' }}>
          Crafting Requests
        </div>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
        Local to this device for now — not yet shared with other officers. Posting to Discord is planned.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
        <div style={{ width: 160 }}>
          <Input label="Your name" placeholder="Requester" value={requester} onChange={(e) => setRequester(e.target.value)} />
        </div>
        <div style={{ width: 180 }}>
          <Select label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} options={professionNames.length ? professionNames : ['Any']} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Input label="What do you need?" placeholder="e.g. Chest enchant, ilvl 300+" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button size="md" onClick={submit} disabled={!requester.trim() || !description.trim()}>
          Post
        </Button>
      </div>

      {requests.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
          No requests yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...open, ...fulfilled].map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: r.fulfilled ? 'transparent' : 'var(--surface-raised)',
                opacity: r.fulfilled ? 0.55 : 1,
              }}
            >
              <Checkbox checked={r.fulfilled} onChange={() => toggleFulfilled(r.id)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-strong)', textDecoration: r.fulfilled ? 'line-through' : 'none' }}>{r.description}</div>
                <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)' }}>
                  {r.profession} · requested by {r.requester}
                </div>
              </div>
              <IconButton icon="x" label="Remove request" size="sm" onClick={() => removeRequest(r.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
