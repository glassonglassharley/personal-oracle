import { BACKGROUNDS, POT_STYLES } from '../companions/companionData';

function adj(hex, amt) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const c = i => Math.min(255, Math.max(0, parseInt(hex.slice(i, i + 2), 16) + amt));
  return `rgb(${c(1)},${c(3)},${c(5)})`;
}

export function Background({ bgId, artId }) {
  if (bgId === 'theme') {
    // Transparent: the card's own themed surface shows through.
    return (
      <g>
        <ellipse cx="100" cy="236" rx="80" ry="14" fill="currentColor" opacity="0.07" />
      </g>
    );
  }
  const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
  const isNight = bgId === 'night_stars' || bgId === 'space' || bgId === 'mystical_forest';
  const sky = `sky-${artId}`;
  const gnd = `gnd-${artId}`;
  const stars = isNight ? Array.from({ length: 26 }, (_, i) => ({
    cx: (i * 37 + 11) % 196 + 2,
    cy: (i * 23 + 7) % 120 + 5,
    r: i % 4 === 0 ? 1.5 : 1,
    op: 0.5 + (i % 5) * 0.1,
  })) : [];

  return (
    <g>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.sky1} />
          <stop offset="100%" stopColor={bg.sky2} />
        </linearGradient>
        <linearGradient id={gnd} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={adj(bg.ground, 20)} />
          <stop offset="100%" stopColor={adj(bg.ground, -20)} />
        </linearGradient>
      </defs>
      <rect width="200" height="215" fill={`url(#${sky})`} />
      <rect x="0" y="215" width="200" height="65" fill={`url(#${gnd})`} />
      <line x1="0" y1="215" x2="200" y2="215" stroke={adj(bg.ground, -30)} strokeWidth="1.5" opacity="0.45" />
      {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />)}

      {bgId === 'day' && <>
        <g opacity="0.85">
          <ellipse cx="38" cy="47" rx="26" ry="14" fill="white" />
          <ellipse cx="54" cy="40" rx="20" ry="13" fill="white" />
          <ellipse cx="28" cy="52" rx="14" ry="9" fill="white" />
        </g>
        <g opacity="0.65">
          <ellipse cx="158" cy="56" rx="21" ry="12" fill="white" />
          <ellipse cx="170" cy="50" rx="15" ry="9" fill="white" />
        </g>
        <circle cx="168" cy="34" r="16" fill="#FDD835" opacity="0.9" />
        <circle cx="168" cy="34" r="23" fill="#FDD835" opacity="0.15" />
      </>}
      {bgId === 'sunset' && <>
        <circle cx="100" cy="190" r="38" fill="#FF7043" opacity="0.6" />
        <rect x="0" y="175" width="200" height="15" fill="rgba(255,140,0,0.22)" />
        <rect x="0" y="190" width="200" height="25" fill="rgba(255,80,0,0.16)" />
      </>}
      {bgId === 'rainy' && Array.from({ length: 22 }, (_, i) => (
        <line key={i} x1={(i * 9 + 3) % 200} y1={(i * 17) % 200} x2={((i * 9 + 3) % 200) - 4} y2={((i * 17) % 200) + 16}
          stroke="#90A4AE" strokeWidth="1" opacity="0.48" />
      ))}
      {bgId === 'snowy' && <>
        <ellipse cx="100" cy="220" rx="85" ry="12" fill="white" opacity="0.5" />
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} cx={(i * 13 + 4) % 200} cy={(i * 11 + 8) % 180} r={i % 3 === 0 ? 2.5 : 1.5} fill="white" opacity="0.85" />
        ))}
      </>}
      {bgId === 'mystical_forest' && <>
        <circle cx="162" cy="32" r="14" fill="#FFF9C4" opacity="0.75" />
        <circle cx="170" cy="27" r="11" fill={bg.sky1} opacity="0.9" />
        <ellipse cx="30" cy="190" rx="18" ry="40" fill="rgba(45,90,45,0.4)" />
        <ellipse cx="175" cy="195" rx="14" ry="35" fill="rgba(45,90,45,0.4)" />
      </>}
      {bgId === 'tropical_beach' && <>
        <ellipse cx="100" cy="222" rx="100" ry="15" fill="#f9c74f" opacity="0.35" />
        <rect x="0" y="210" width="200" height="25" fill="rgba(0,180,216,0.15)" />
      </>}
      {bgId === 'mountaintop' && <>
        <polygon points="60,215 90,155 120,215" fill="#9e9e9e" />
        <polygon points="120,215 155,160 190,215" fill="#bdbdbd" />
        <polygon points="0,215 35,175 70,215" fill="#8e8e8e" />
        <polygon points="90,155 100,145 110,155" fill="white" opacity="0.85" />
        <polygon points="155,160 162,152 169,160" fill="white" opacity="0.75" />
      </>}
      {bgId === 'space' && <>
        <circle cx="50" cy="50" r="18" fill="#5c6bc0" opacity="0.55" />
        <ellipse cx="50" cy="50" rx="28" ry="7" fill="none" stroke="#90caf9" strokeWidth="2" opacity="0.4" />
        <circle cx="168" cy="28" r="7" fill="#ef5350" opacity="0.5" />
      </>}
    </g>
  );
}

export function PotBack({ style = 'terracotta', artId }) {
  const p = POT_STYLES.find(ps => ps.id === style) || POT_STYLES[0];
  const x = 100;
  const y = 225;
  const g = `pot-${artId}`;
  if (style === 'floating') {
    return (
      <g>
        <ellipse cx={x} cy={y + 7} rx="28" ry="11" fill="#4a3728" />
        <ellipse cx={x} cy={y + 2} rx="25" ry="8" fill="#5a4738" />
        <ellipse cx={x} cy={y + 18} rx="22" ry="5" fill="rgba(100,200,255,0.18)" />
      </g>
    );
  }
  const body = style === 'wooden_barrel'
    ? <>
        <rect x={x - 22} y={y} width="44" height="36" rx="4" fill={`url(#${g})`} />
        {[5, 15, 26].map(dy => <rect key={dy} x={x - 22} y={y + dy} width="44" height="3.5" rx="1" fill={p.dark} opacity="0.7" />)}
      </>
    : <path d={`M${x - 21} ${y + 37} L${x - 25} ${y + 2} L${x + 25} ${y + 2} L${x + 21} ${y + 37}Z`} fill={`url(#${g})`} />;
  return (
    <g>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={adj(p.color, -28)} />
          <stop offset="32%" stopColor={adj(p.color, 22)} />
          <stop offset="100%" stopColor={adj(p.color, -22)} />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="263" rx="46" ry="7" fill="rgba(0,0,0,0.22)" />
      {body}
      <rect x={x - 27} y={y - 4} width="54" height="9" rx="3.5" fill={p.rim} />
      <ellipse cx={x} cy={y - 0.5} rx="24" ry="5" fill="#3e2b1f" />
      <ellipse cx={x} cy={y - 0.5} rx="18" ry="3.4" fill="#5a3a28" opacity="0.6" />
      {style !== 'wooden_barrel' && (
        <path d={`M${x - 15} ${y + 7} L${x - 17} ${y + 33}`} stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" strokeLinecap="round" />
      )}
    </g>
  );
}

// The front lip of the rim, drawn over the trunk so the tree sits *in* the
// pot instead of floating on top of it.
export function PotLip({ style = 'terracotta' }) {
  if (style === 'floating') return null;
  const p = POT_STYLES.find(ps => ps.id === style) || POT_STYLES[0];
  return <path d="M76 225.5 Q100 231.5 124 225.5 L127 227 Q127 230 123.5 230 L76.5 230 Q73 230 73 227Z" fill={p.rim} />;
}
