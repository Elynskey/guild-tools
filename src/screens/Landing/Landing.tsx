import { Link } from 'react-router-dom';
import { Crest } from '../../design-system/Crest';
import { Icon } from '../../design-system/Icon';

interface NavCardDef {
  to: string;
  icon: string;
  title: string;
  description: string;
}

const CARDS: NavCardDef[] = [
  {
    to: '/raider-status',
    icon: 'swords',
    title: 'Raider Status',
    description: 'Per-raider performance, gear, and trend — Green/Yellow/Red/Ineligible at a glance for officer triage.',
  },
  {
    to: '/professions',
    icon: 'hammer',
    title: 'Professions',
    description: 'Who can craft what, skill and recipe knowledge across the guild, and open crafting requests.',
  },
  {
    to: '/pull-feedback',
    icon: 'scroll-text',
    title: 'Pull Feedback',
    description: 'Any past raid night, pull by pull — wipe or kill, deaths, and mechanics that need the most work.',
  },
];

export function Landing() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-page)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-body)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 40,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Crest size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div className="crd-eyebrow">Casual Raid Days · The Scryers · est. 2010</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-display-m)',
              fontWeight: 600,
              letterSpacing: '.06em',
              color: 'var(--text-strong)',
            }}
          >
            Guild Tools
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, width: '100%', maxWidth: 760 }}>
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="crd-card crd-card--interactive"
            style={{ display: 'block', padding: 24, textDecoration: 'none', border: '1px solid var(--border-hairline)' }}
          >
            <Icon name={card.icon} size={28} style={{ color: 'var(--gold-300)' }} />
            <div
              style={{
                marginTop: 14,
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-title-l)',
                fontWeight: 600,
                letterSpacing: '.04em',
                color: 'var(--text-strong)',
              }}
            >
              {card.title}
            </div>
            <div style={{ marginTop: 6, fontSize: 'var(--text-body-s)', lineHeight: 1.5, color: 'var(--text-muted)' }}>{card.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
