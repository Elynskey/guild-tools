import { useEffect, useState } from 'react';
import { Input } from '../../../design-system/Input';
import { Select } from '../../../design-system/Select';
import { Checkbox } from '../../../design-system/Checkbox';
import { Switch } from '../../../design-system/Switch';
import { Button } from '../../../design-system/Button';
import { Badge } from '../../../design-system/Badge';
import { Dialog } from '../../../design-system/Dialog';
import { professionIconUrl, CRAFTING_PROFESSIONS } from '../../../professions/professionCatalog';
import { useCraftRequests } from '../../../professions/useCraftRequests';
import { buildCraftLeaderboard } from '../../../professions/craftLeaderboard';
import { ItemSearchInput } from './ItemSearchInput';
import { GRAD_CREST } from '../theme';
import type { RecipeCatalogue, CraftRequest } from '../../../professions/types';

function ageLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

interface RequestsTabProps {
  catalogue: RecipeCatalogue;
  onRequestsChange: (requests: CraftRequest[]) => void;
}

export function RequestsTab({ catalogue, onRequestsChange }: RequestsTabProps) {
  const { requests, addRequest, fulfillRequest } = useCraftRequests();
  const [requester, setRequester] = useState('');
  const [profession, setProfession] = useState<string>(CRAFTING_PROFESSIONS[0]);
  const [need, setNeed] = useState('');
  const [hideFulfilled, setHideFulfilled] = useState(false);
  const [fulfillTarget, setFulfillTarget] = useState<CraftRequest | null>(null);
  const [fulfillerName, setFulfillerName] = useState('');

  useEffect(() => onRequestsChange(requests), [requests, onRequestsChange]);

  const submit = () => {
    const trimmedNeed = need.trim();
    if (!trimmedNeed) return;
    addRequest(requester.trim() || 'Anonymous guildie', profession, trimmedNeed);
    setNeed('');
  };

  const confirmFulfill = () => {
    if (!fulfillTarget) return;
    fulfillRequest(fulfillTarget.id, fulfillerName.trim());
    setFulfillTarget(null);
    setFulfillerName('');
  };

  const open = requests.filter((r) => !r.fulfilled).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const fulfilled = requests.filter((r) => r.fulfilled).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const visible = hideFulfilled ? open : [...open, ...fulfilled];
  const leaderboard = buildCraftLeaderboard(requests);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
      <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden', position: 'sticky', top: 150 }}>
        <div style={{ height: 2, background: GRAD_CREST }} />
        <div
          style={{
            padding: '11px 18px',
            background: 'var(--grad-header)',
            borderBottom: '1px solid var(--border-soft)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            letterSpacing: '.05em',
            fontSize: 'var(--text-title-m)',
            color: 'var(--text-gold)',
          }}
        >
          Post a request
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Your character" placeholder="Who is asking?" value={requester} onChange={(e) => setRequester(e.target.value)} />
          <Select label="Profession" options={[...CRAFTING_PROFESSIONS]} value={profession} onChange={(e) => setProfession(e.target.value)} />
          <ItemSearchInput value={need} onChange={setNeed} profession={profession} catalogue={catalogue} />
          <Button variant="primary" size="md" block iconLeft="plus" onClick={submit} disabled={!need.trim()}>
            Post to the board
          </Button>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', lineHeight: 1.5 }}>Posted to every officer's board, and to Discord if a craft-orders channel is set in Settings.</div>
        </div>
      </div>

      {leaderboard.length > 0 && (
        <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
          <div style={{ padding: '11px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-soft)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.05em', fontSize: 'var(--text-title-m)', color: 'var(--text-gold)' }}>
            Top contributors
          </div>
          <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaderboard.slice(0, 5).map((entry) => (
              <div key={entry.crafter} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-body-s)' }}>
                <span style={{ color: 'var(--text-body)' }}>{entry.crafter}</span>
                <Badge tone="gold">{entry.count} fulfilled</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 5, background: 'var(--surface-card)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', background: 'var(--grad-header)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.05em', fontSize: 'var(--text-title-m)', color: 'var(--text-gold)', flex: 1 }}>Crafting requests</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
            {open.length} open · {requests.length} total
          </span>
          <Switch label="Hide fulfilled" checked={hideFulfilled} onChange={setHideFulfilled} />
        </div>

        {visible.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 150px 110px 120px', gap: 14, padding: '12px 18px', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center', opacity: r.fulfilled ? 0.55 : 1 }}>
            <Checkbox checked={r.fulfilled} onChange={() => (r.fulfilled ? fulfillRequest(r.id, '') : setFulfillTarget(r))} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--text-body-m)', color: 'var(--text-strong)', textDecoration: r.fulfilled ? 'line-through' : 'none' }}>{r.description}</span>
              <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-faint)', letterSpacing: '.04em' }}>
                Posted {ageLabel(r.createdAt)}
                {r.fulfilled && r.fulfilledBy ? ` · fulfilled by ${r.fulfilledBy}` : ''}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.03em', fontSize: 'var(--text-title-s)', color: 'var(--text-body)' }}>{r.requester}</span>
            <span style={{ fontSize: 'var(--text-body-s)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={professionIconUrl(r.profession)} alt="" style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--border-iron)', flex: 'none', objectFit: 'cover' }} />
              {r.profession}
            </span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Badge tone={r.fulfilled ? 'success' : 'gold'}>{r.fulfilled ? 'Fulfilled' : 'Open'}</Badge>
            </span>
          </div>
        ))}

        {visible.length === 0 && <div style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 'var(--text-body-s)' }}>The board is clear.</div>}
      </div>

      {fulfillTarget && (
        <Dialog
          title="Mark fulfilled"
          eyebrow={fulfillTarget.description}
          onClose={() => setFulfillTarget(null)}
          footer={
            <Button variant="primary" onClick={confirmFulfill} disabled={!fulfillerName.trim()}>
              Mark fulfilled
            </Button>
          }
        >
          <Input
            label="Who crafted this?"
            placeholder="Character name"
            value={fulfillerName}
            onChange={(e) => setFulfillerName(e.target.value)}
            autoFocus
          />
        </Dialog>
      )}
    </div>
  );
}
