import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Input } from '../../design-system/Input';
import { Button } from '../../design-system/Button';
import { Toast } from '../../design-system/Toast';
import { useSettings } from './useSettings';

export function Settings() {
  const { settings, loading, saving, savedAt, save, available } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [dirty, setDirty] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(settings);
  }, [settings, dirty]);

  useEffect(() => {
    if (window.electronAPI) void window.electronAPI.getDiscordInviteUrl().then(setInviteUrl);
  }, []);

  const copyInvite = () => {
    if (!inviteUrl || !window.electronAPI) return;
    void window.electronAPI.copyToClipboard(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const field = (key: keyof typeof draft, value: string) => {
    setDraft({ ...draft, [key]: value });
    setDirty(true);
  };

  const submit = () => {
    save(draft);
    setDirty(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)', fontFamily: 'var(--font-ui)', color: 'var(--text-body)', paddingBottom: 80 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 6, backgroundColor: 'rgba(18,16,12,.92)', backdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', borderBottom: 'none' }} title="Back to Guild Tools">
            <Crest size={42} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title-l)', fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-strong)', lineHeight: 1.1 }}>
                Settings
              </div>
            </div>
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: 32 }}>
        {!available ? (
          <div style={{ padding: 48, textAlign: 'center', border: '1px dashed var(--border-hairline)', borderRadius: 5, color: 'var(--text-muted)' }}>
            Settings require the desktop app -- nothing to configure in a browser preview.
          </div>
        ) : loading ? null : (
          <div className="crd-card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 4 }}>
                Discord channel IDs
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                Right-click a channel in Discord (Developer Mode on) and "Copy Channel ID." Everything else the bot
                needs lives server-side.
              </p>
            </div>

            <Input
              label="Raid signups channel"
              placeholder="Channel ID"
              value={draft.raidSignupsChannelId}
              onChange={(e) => field('raidSignupsChannelId', e.target.value)}
            />
            <Input
              label="Loot log channel"
              placeholder="Channel ID"
              value={draft.lootLogChannelId}
              onChange={(e) => field('lootLogChannelId', e.target.value)}
            />

            <Button onClick={submit} disabled={saving || !dirty} iconLeft="check">
              {saving ? 'Saving…' : 'Save'}
            </Button>

            {!dirty && savedAt !== null && <Toast tone="success" title="Saved" />}
          </div>
        )}

        {available && !loading && inviteUrl && (
          <div className="crd-card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <div className="crd-eyebrow" style={{ color: 'var(--text-gold)', marginBottom: 4 }}>
                Discord bot
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-body-s)', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                Adding the bot to the server needs "Manage Server" permission -- usually the GM. Send them this link.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={copyInvite} iconLeft={copied ? 'check' : 'copy'}>
                {copied ? 'Copied' : 'Copy invite link'}
              </Button>
              <Button variant="secondary" onClick={() => window.electronAPI?.openDiscordInvite()} iconLeft="external-link">
                Open
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
