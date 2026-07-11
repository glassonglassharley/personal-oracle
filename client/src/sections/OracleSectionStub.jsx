const s = {
  wrap: {
    maxWidth: 560,
    margin: '48px auto',
    padding: '40px 32px',
    borderRadius: 16,
    border: '1px solid rgba(212,175,55,0.18)',
    background: 'rgba(4,12,6,0.6)',
    textAlign: 'center',
  },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: 700, color: '#d4af37', margin: '0 0 8px' },
  copy: { fontSize: 14, lineHeight: 1.6, color: 'rgba(240,247,236,0.6)', margin: '0 0 20px' },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(90,138,106,0.9)',
    border: '1px solid rgba(90,138,106,0.4)',
    marginBottom: 20,
  },
  link: { display: 'block', fontSize: 13, color: 'rgba(240,247,236,0.45)' },
  anchor: { color: '#d4af37', textDecoration: 'none' },
};

export default function OracleSectionStub({ icon, title, description, liveUrl }) {
  return (
    <main className="main">
      <div style={s.wrap}>
        <div style={s.icon}>{icon}</div>
        <h1 style={s.title}>{title}</h1>
        <div style={s.badge}>Migration in progress</div>
        <p style={s.copy}>{description}</p>
        {liveUrl && (
          <span style={s.link}>
            Until it moves in, it lives at{' '}
            <a style={s.anchor} href={liveUrl} target="_blank" rel="noreferrer">
              {liveUrl.replace('https://', '')}
            </a>
          </span>
        )}
      </div>
    </main>
  );
}
