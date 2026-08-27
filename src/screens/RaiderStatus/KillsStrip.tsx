import { config } from '../../config';

interface KillsStripProps {
  progressionFraction: string;
}

export function KillsStrip({ progressionFraction }: KillsStripProps) {
  return (
    <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border-hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <span className="crd-eyebrow" style={{ color: 'var(--text-gold)' }}>
          This Tier's Kills
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--rule-gold)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
          {progressionFraction} {config.tier.progressionDifficulty}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {config.kills.map((kill) => (
          <figure key={kill.image} style={{ margin: 0 }}>
            <img
              src={kill.image}
              alt={kill.alt}
              style={{ display: 'block', width: '100%', height: 104, objectFit: 'cover', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-2)' }}
            />
            <figcaption style={{ marginTop: 6, fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{kill.caption}</figcaption>
          </figure>
        ))}
      </div>

      <img
        src="./assets/site/footer-banner.png"
        alt=""
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 560,
          margin: '28px auto 0',
          opacity: 0.4,
          maskImage: 'linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)',
          WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)',
        }}
      />

      <p style={{ margin: '20px 0 0', maxWidth: 720, fontSize: 'var(--text-micro)', lineHeight: 1.5, color: 'var(--text-faint)' }}>
        Gates first, then the weighted score, then the death cap. Attendance and anything about the person behind the toon stays off this board -- that is a
        conversation, not a number.
      </p>
    </div>
  );
}
