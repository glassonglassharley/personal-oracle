import { useId } from 'react';
import { CHARACTER_ARCHETYPES, SKIN_TONES, HAIR_COLORS, BODY_TYPES, EYE_COLORS, BACKGROUNDS, getLevelTier } from './companionData';

function adj(hex, amt) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amt));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amt));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

function CharBackground({ bgId, artId }) {
  const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
  const isNight = ['night_stars', 'space', 'mystical_forest'].includes(bgId);
  const skyId = `char-sky-${artId}`, gndId = `char-gnd-${artId}`;

  return (
    <g>
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.sky1} />
          <stop offset="100%" stopColor={bg.sky2} />
        </linearGradient>
        <linearGradient id={gndId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={adj(bg.ground, 18)} />
          <stop offset="100%" stopColor={adj(bg.ground, -18)} />
        </linearGradient>
      </defs>
      <rect width="200" height="220" fill={`url(#${skyId})`} />
      <rect x="0" y="220" width="200" height="60" fill={`url(#${gndId})`} />
      <line x1="0" y1="220" x2="200" y2="220" stroke={adj(bg.ground, -28)} strokeWidth="1.5" opacity="0.45" />

      {isNight && Array.from({ length: 22 }, (_, i) => (
        <g key={i}>
          <circle cx={(i * 37 + 11) % 196 + 2} cy={(i * 23 + 7) % 110}
            r={i % 4 === 0 ? 1.6 : 1} fill="white" opacity={0.38 + (i % 5) * 0.12} />
          {i % 5 === 0 && <circle cx={(i * 37 + 11) % 196 + 2} cy={(i * 23 + 7) % 110}
            r={3} fill="white" opacity="0.12" />}
        </g>
      ))}

      {bgId === 'day' && <>
        <g opacity="0.88">
          <ellipse cx="36" cy="44" rx="24" ry="13" fill="white" />
          <ellipse cx="53" cy="38" rx="19" ry="12" fill="white" />
          <ellipse cx="28" cy="50" rx="14" ry="9" fill="white" />
        </g>
        <circle cx="168" cy="34" r="15" fill="#FDD835" opacity="0.9" />
        <circle cx="168" cy="34" r="22" fill="#FDD835" opacity="0.14" />
        <circle cx="162" cy="28" r="6" fill="#fff9c4" opacity="0.4" />
      </>}
      {bgId === 'sunset' && <>
        <circle cx="100" cy="192" r="38" fill="#FF7043" opacity="0.52" />
        <circle cx="100" cy="192" r="56" fill="#FF7043" opacity="0.14" />
      </>}
      {bgId === 'rainy' && Array.from({ length: 20 }, (_, i) => (
        <line key={i} x1={(i * 10 + 3) % 210} y1={(i * 15) % 200}
          x2={((i * 10 + 3) % 210) - 5} y2={((i * 15) % 200) + 18}
          stroke="#90A4AE" strokeWidth="1.2" opacity="0.5" />
      ))}
      {bgId === 'mystical_forest' && <>
        <circle cx="162" cy="28" r="14" fill="#FFF9C4" opacity="0.75" />
        <circle cx="170" cy="24" r="11" fill={bg.sky1} opacity="0.92" />
        <ellipse cx="28" cy="192" rx="20" ry="42" fill="rgba(45,90,45,0.4)" />
        <ellipse cx="178" cy="196" rx="16" ry="38" fill="rgba(45,90,45,0.38)" />
      </>}
      {bgId === 'space' && <>
        <circle cx="50" cy="46" r="18" fill="#5c6bc0" opacity="0.52" />
        <ellipse cx="50" cy="46" rx="28" ry="7" fill="none" stroke="#90caf9" strokeWidth="1.8" opacity="0.45" />
        <circle cx="168" cy="26" r="8" fill="#ef5350" opacity="0.5" />
      </>}
    </g>
  );
}

function getHairColor(hcId) {
  const found = HAIR_COLORS.find(h => h.id === hcId);
  return found?.color || '#1a1a1a';
}

function Eyebrows({ cx, headR, hairColor, gender }) {
  const ey = cx.y + headR * 0.02;
  const browY = ey - headR * 0.46;
  const er = headR * 0.17;
  const exL = cx.x - headR * 0.31;
  const exR = cx.x + headR * 0.31;
  const arch = gender === 'feminine' ? 0.19 : 0.12;
  const thick = gender === 'masculine' ? 3.8 : 3.0;
  const hc = hairColor === 'rainbow' ? '#3b1f0d' : hairColor;

  return <g>
    <path d={`M${exL - er * 1.28} ${browY + headR * arch} Q${exL} ${browY} ${exL + er * 1.28} ${browY + headR * 0.07}`}
      fill="none" stroke={hc} strokeWidth={thick + 0.8} strokeLinecap="round" opacity="0.35" />
    <path d={`M${exL - er * 1.28} ${browY + headR * arch} Q${exL} ${browY} ${exL + er * 1.28} ${browY + headR * 0.07}`}
      fill="none" stroke={hc} strokeWidth={thick} strokeLinecap="round" opacity="0.90" />
    <path d={`M${exR - er * 1.28} ${browY + headR * 0.07} Q${exR} ${browY} ${exR + er * 1.28} ${browY + headR * arch}`}
      fill="none" stroke={hc} strokeWidth={thick + 0.8} strokeLinecap="round" opacity="0.35" />
    <path d={`M${exR - er * 1.28} ${browY + headR * 0.07} Q${exR} ${browY} ${exR + er * 1.28} ${browY + headR * arch}`}
      fill="none" stroke={hc} strokeWidth={thick} strokeLinecap="round" opacity="0.90" />
  </g>;
}

function Hair({ style, color, cx, headR, gender, artId }) {
  const raw = color === 'rainbow' ? `url(#hair-rainbow-${artId})` : color;
  const topY = cx.y - headR;
  const isRainbow = color === 'rainbow';
  const shine = typeof color === 'string' && color[0] === '#' ? adj(color, 38) : 'rgba(255,255,255,0.3)';

  const rainbowDef = isRainbow ? (
    <defs>
      <linearGradient id={`hair-rainbow-${artId}`} x1="0" y1="0" x2="1" y2="0">
        {['#e53935', '#f9a825', '#43a047', '#1e88e5', '#8e24aa'].map((col, i) => (
          <stop key={i} offset={`${i * 25}%`} stopColor={col} />
        ))}
      </linearGradient>
    </defs>
  ) : null;

  const ShineStreak = ({ x1, y1, x2, y2 }) => (
    <path d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - 4} ${x2} ${y2}`}
      fill="none" stroke={shine} strokeWidth="2.5" strokeLinecap="round" opacity="0.38" />
  );

  if (style === 'bald') return rainbowDef;

  if (style === 'buzz') return <g>
    {rainbowDef}
    <circle cx={cx.x} cy={cx.y} r={headR + 1.8} fill={raw} clipPath={`url(#head-clip-${artId})`} opacity="0.88" />
    <ShineStreak x1={cx.x - headR * 0.4} y1={cx.y - headR * 0.8} x2={cx.x - headR * 0.1} y2={cx.y - headR * 0.2} />
  </g>;

  if (style === 'afro') return <g>
    {rainbowDef}
    <circle cx={cx.x} cy={cx.y - headR * 0.25} r={headR * 1.35} fill={raw} />
    <circle cx={cx.x - headR * 0.82} cy={cx.y - headR * 0.2} r={headR * 0.62} fill={raw} />
    <circle cx={cx.x + headR * 0.82} cy={cx.y - headR * 0.2} r={headR * 0.62} fill={raw} />
    <ellipse cx={cx.x - headR * 0.3} cy={cx.y - headR * 1.25} rx={headR * 0.55} ry={headR * 0.38}
      fill={shine} opacity="0.25" />
  </g>;

  if (style === 'mohawk') return <g>
    {rainbowDef}
    <rect x={cx.x - 6.5} y={topY - 24} width={13} height={24} rx={4.5} fill={raw} />
    <ellipse cx={cx.x} cy={topY - 24} rx={7.5} ry={5.5} fill={raw} />
    <ShineStreak x1={cx.x - 3} y1={topY - 22} x2={cx.x - 1} y2={topY - 4} />
  </g>;

  if (style === 'long') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.5} rx={headR * 1.12} ry={headR * 1.18} fill={raw} />
    <rect x={cx.x - headR * 1.08} y={cx.y} width={headR * 0.6} height={headR * 2.25} rx={7} fill={raw} />
    <rect x={cx.x + headR * 0.5} y={cx.y} width={headR * 0.6} height={headR * 2.25} rx={7} fill={raw} />
    <ShineStreak x1={cx.x - headR * 0.5} y1={cx.y - headR * 0.85} x2={cx.x - headR * 0.2} y2={cx.y + headR * 0.2} />
    <ShineStreak x1={cx.x - headR * 0.26} y1={cx.y - headR * 0.72} x2={cx.x + headR * 0.02} y2={cx.y + headR * 0.35} />
    <path d={`M${cx.x - headR * 0.98} ${cx.y + headR * 0.4} Q${cx.x - headR * 1.04} ${cx.y + headR * 1.0} ${cx.x - headR * 0.96} ${cx.y + headR * 1.8}`}
      fill="none" stroke={shine} strokeWidth="2" strokeLinecap="round" opacity="0.28" />
  </g>;

  if (style === 'braids') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.55} rx={headR * 1.1} ry={headR * 1.12} fill={raw} />
    {[-1, 1].map(dir => (
      <g key={dir}>
        <rect x={cx.x + dir * headR * 0.55 - 5.5} y={cx.y + headR * 0.5} width={11} height={headR * 2.1} rx={5.5} fill={raw} />
        {Array.from({ length: 6 }, (_, j) => (
          <rect key={j} x={cx.x + dir * headR * 0.55 - 5.5} y={cx.y + headR * 0.5 + j * (headR * 2.1 / 6)}
            width={11} height={2.8} rx={1.4} fill="rgba(0,0,0,0.18)" />
        ))}
      </g>
    ))}
  </g>;

  if (style === 'dreadlocks') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.5} rx={headR * 1.12} ry={headR * 1.1} fill={raw} />
    {[-headR * 0.72, -headR * 0.26, headR * 0.26, headR * 0.72].map((dx, i) => (
      <rect key={i} x={cx.x + dx - 4.5} y={cx.y + headR * 0.28} width={9}
        height={headR * (1.2 + i * 0.2)} rx={4.5} fill={raw} opacity="0.92" />
    ))}
  </g>;

  if (style === 'bun') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.55} rx={headR * 1.06} ry={headR * 0.87} fill={raw} />
    <circle cx={cx.x} cy={topY - 9} r={headR * 0.47} fill={raw} />
    <circle cx={cx.x - headR * 0.12} cy={topY - 13} r={headR * 0.18} fill={shine} opacity="0.35" />
  </g>;

  if (style === 'ponytail') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.55} rx={headR * 1.06} ry={headR * 0.9} fill={raw} />
    <path d={`M${cx.x - 9} ${cx.y} Q${cx.x + headR * 1.55} ${cx.y + headR} ${cx.x + headR * 0.52} ${cx.y + headR * 2.05}`}
      fill="none" stroke={raw} strokeWidth={13} strokeLinecap="round" />
    <ShineStreak x1={cx.x - 5} y1={cx.y - headR * 0.7} x2={cx.x} y2={cx.y - headR * 0.1} />
  </g>;

  if (style === 'pigtails') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.52} rx={headR * 1.06} ry={headR * 0.9} fill={raw} />
    {[-1, 1].map(dir => (
      <path key={dir}
        d={`M${cx.x + dir * headR * 0.92} ${cx.y - headR * 0.3} Q${cx.x + dir * headR * 1.65} ${cx.y + headR * 0.52} ${cx.x + dir * headR * 1.12} ${cx.y + headR * 1.22}`}
        fill="none" stroke={raw} strokeWidth={11} strokeLinecap="round" />
    ))}
  </g>;

  if (style === 'undercut') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.6} rx={headR * 1.1} ry={headR * 0.82} fill={raw} />
    <rect x={cx.x - headR * 0.72} y={topY - 4} width={headR * 1.44} height={headR * 0.72} rx={4.5} fill={raw} />
    <ShineStreak x1={cx.x - headR * 0.4} y1={topY + 2} x2={cx.x} y2={topY + headR * 0.5} />
  </g>;

  if (style === 'quiff') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.52} rx={headR * 1.06} ry={headR * 0.9} fill={raw} />
    <path d={`M${cx.x - headR * 0.52} ${topY + 4} Q${cx.x} ${topY - 22} ${cx.x + headR * 0.42} ${topY + 6}`}
      fill={raw} stroke={raw} strokeWidth="2" />
    <ShineStreak x1={cx.x - headR * 0.3} y1={topY - 12} x2={cx.x + headR * 0.1} y2={topY + 2} />
  </g>;

  if (style === 'shaved_sides') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.6} rx={headR * 0.72} ry={headR * 0.72} fill={raw} />
    <rect x={cx.x - headR * 0.72} y={topY + 2} width={headR * 1.44} height={headR * 0.52} rx={3} fill={raw} />
  </g>;

  return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.58} rx={headR * 1.1}
      ry={style === 'medium' ? headR * 1.02 : headR * 0.84} fill={raw} />
    {style === 'medium' && <>
      <ellipse cx={cx.x - headR * 1.02} cy={cx.y - headR * 0.1} rx={headR * 0.21} ry={headR * 0.47} fill={raw} />
      <ellipse cx={cx.x + headR * 1.02} cy={cx.y - headR * 0.1} rx={headR * 0.21} ry={headR * 0.47} fill={raw} />
    </>}
    <ShineStreak x1={cx.x - headR * 0.4} y1={cx.y - headR * 0.75} x2={cx.x - headR * 0.1} y2={cx.y - headR * 0.05} />
    <ShineStreak x1={cx.x - headR * 0.18} y1={cx.y - headR * 0.62} x2={cx.x + headR * 0.1} y2={cx.y - headR * 0.08} />
    <ellipse cx={cx.x - headR * 0.24} cy={cx.y - headR * 0.80} rx={headR * 0.18} ry={headR * 0.10}
      fill={shine} opacity="0.20" />
  </g>;
}

function Eyes({ cx, headR, eyeColorId, artId }) {
  const eyeData = EYE_COLORS.find(e => e.id === eyeColorId) || EYE_COLORS[0];
  const isHetero = eyeColorId === 'heterochromia';
  const lColor = eyeData.color;
  const rColor = isHetero ? (eyeData.rightColor || '#388e3c') : lColor;
  const ey = cx.y + headR * 0.02;
  const er = headR * 0.17;
  const exL = cx.x - headR * 0.31;
  const exR = cx.x + headR * 0.31;

  return <g>
    <defs>
      <radialGradient id={`iris-l-${artId}`} cx="38%" cy="32%" r="62%">
        <stop offset="0%" stopColor={adj(lColor, 45)} />
        <stop offset="55%" stopColor={lColor} />
        <stop offset="100%" stopColor={adj(lColor, -28)} />
      </radialGradient>
      <radialGradient id={`iris-r-${artId}`} cx="38%" cy="32%" r="62%">
        <stop offset="0%" stopColor={adj(rColor, 45)} />
        <stop offset="55%" stopColor={rColor} />
        <stop offset="100%" stopColor={adj(rColor, -28)} />
      </radialGradient>
    </defs>

    {/* Sclera (whites) */}
    <ellipse cx={exL} cy={ey} rx={er * 1.46} ry={er * 1.08} fill="white" />
    <ellipse cx={exR} cy={ey} rx={er * 1.46} ry={er * 1.08} fill="white" />
    {/* Sclera inner shading */}
    <ellipse cx={exL} cy={ey + er * 0.3} rx={er * 1.3} ry={er * 0.6} fill="rgba(200,180,160,0.14)" />
    <ellipse cx={exR} cy={ey + er * 0.3} rx={er * 1.3} ry={er * 0.6} fill="rgba(200,180,160,0.14)" />

    {/* Irises */}
    <circle cx={exL} cy={ey} r={er} fill={`url(#iris-l-${artId})`} />
    <circle cx={exR} cy={ey} r={er} fill={`url(#iris-r-${artId})`} />

    {/* Iris limbal ring */}
    <circle cx={exL} cy={ey} r={er} fill="none" stroke={adj(lColor, -40)} strokeWidth="0.9" opacity="0.55" />
    <circle cx={exR} cy={ey} r={er} fill="none" stroke={adj(rColor, -40)} strokeWidth="0.9" opacity="0.55" />

    {/* Pupils */}
    <circle cx={exL} cy={ey} r={er * 0.48} fill="#050505" />
    <circle cx={exR} cy={ey} r={er * 0.48} fill="#050505" />

    {/* Upper eyelid shadow */}
    <ellipse cx={exL} cy={ey - er * 0.38} rx={er * 1.46} ry={er * 0.66} fill="rgba(0,0,0,0.11)" />
    <ellipse cx={exR} cy={ey - er * 0.38} rx={er * 1.46} ry={er * 0.66} fill="rgba(0,0,0,0.11)" />

    {/* Upper eyelid crease */}
    <path d={`M${exL - er * 1.42} ${ey - er * 0.06} Q${exL} ${ey - er * 1.14} ${exL + er * 1.42} ${ey - er * 0.06}`}
      fill="none" stroke="rgba(0,0,0,0.68)" strokeWidth="1.9" strokeLinecap="round" />
    <path d={`M${exR - er * 1.42} ${ey - er * 0.06} Q${exR} ${ey - er * 1.14} ${exR + er * 1.42} ${ey - er * 0.06}`}
      fill="none" stroke="rgba(0,0,0,0.68)" strokeWidth="1.9" strokeLinecap="round" />

    {/* Lower eyelid */}
    <path d={`M${exL - er * 1.28} ${ey + er * 0.18} Q${exL} ${ey + er * 1.08} ${exL + er * 1.28} ${ey + er * 0.18}`}
      fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1" strokeLinecap="round" />
    <path d={`M${exR - er * 1.28} ${ey + er * 0.18} Q${exR} ${ey + er * 1.08} ${exR + er * 1.28} ${ey + er * 0.18}`}
      fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1" strokeLinecap="round" />

    {/* Iris radial texture */}
    {[exL, exR].map((ex, si) => {
      const irisColor = si === 0 ? lColor : rColor;
      return Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <line key={`${si}-${i}`}
          x1={ex + Math.cos(a) * er * 0.22} y1={ey + Math.sin(a) * er * 0.22}
          x2={ex + Math.cos(a) * er * 0.86} y2={ey + Math.sin(a) * er * 0.86}
          stroke={adj(irisColor, -32)} strokeWidth="0.55" opacity="0.30" />;
      });
    })}
    {/* Upper eyelashes */}
    {[exL, exR].map((ex, si) => Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      const lashX = ex - er * 1.32 + t * er * 2.64;
      const lashBaseY = ey - er * 0.50;
      const lashLen = (t > 0.18 && t < 0.82 ? 4.2 : 2.8) + (i % 2) * 0.6;
      const outwardX = (t - 0.5) * 1.8;
      return <line key={`lash-${si}-${i}`}
        x1={lashX} y1={lashBaseY}
        x2={lashX + outwardX} y2={lashBaseY - lashLen}
        stroke="#0a0505" strokeWidth="1.1" strokeLinecap="round" opacity="0.88" />;
    }))}
    {/* Lower lashes (subtle) */}
    {[exL, exR].map((ex, si) => Array.from({ length: 5 }, (_, i) => {
      const t = i / 4;
      const lashX = ex - er * 0.92 + t * er * 1.84;
      const lashBaseY = ey + er * 0.52;
      return <line key={`llash-${si}-${i}`}
        x1={lashX} y1={lashBaseY}
        x2={lashX} y2={lashBaseY + 1.8}
        stroke="#0a0505" strokeWidth="0.9" strokeLinecap="round" opacity="0.40" />;
    }))}
    {/* Catchlights */}
    <circle cx={exL - er * 0.22} cy={ey - er * 0.32} r={er * 0.26} fill="white" opacity="0.95" />
    <circle cx={exL + er * 0.38} cy={ey + er * 0.18} r={er * 0.12} fill="white" opacity="0.60" />
    <circle cx={exR - er * 0.22} cy={ey - er * 0.32} r={er * 0.26} fill="white" opacity="0.95" />
    <circle cx={exR + er * 0.38} cy={ey + er * 0.18} r={er * 0.12} fill="white" opacity="0.60" />
  </g>;
}

function Nose({ cx, headR, skinData }) {
  const nY = cx.y + headR * 0.20;
  return <g>
    <path d={`M${cx.x - headR * 0.06} ${cx.y - headR * 0.12} C${cx.x - headR * 0.09} ${nY - headR * 0.06} ${cx.x - headR * 0.16} ${nY + headR * 0.04} ${cx.x - headR * 0.19} ${nY + headR * 0.12}`}
      fill="none" stroke={skinData.shadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.30" />
    <ellipse cx={cx.x - headR * 0.14} cy={nY + headR * 0.1} rx={headR * 0.09} ry={headR * 0.065}
      fill={skinData.shadow} opacity="0.38" />
    <ellipse cx={cx.x + headR * 0.14} cy={nY + headR * 0.1} rx={headR * 0.09} ry={headR * 0.065}
      fill={skinData.shadow} opacity="0.38" />
    <ellipse cx={cx.x} cy={nY - headR * 0.04} rx={headR * 0.065} ry={headR * 0.09}
      fill="white" opacity="0.16" />
  </g>;
}

function Mouth({ cx, headR, skinData }) {
  const mY = cx.y + headR * 0.48;
  const mW = headR * 0.27;
  return <g>
    {/* Upper lip */}
    <path d={`M${cx.x - mW} ${mY} Q${cx.x - mW * 0.5} ${mY - headR * 0.1} ${cx.x} ${mY - headR * 0.05} Q${cx.x + mW * 0.5} ${mY - headR * 0.1} ${cx.x + mW} ${mY} Q${cx.x + mW * 0.5} ${mY + headR * 0.06} ${cx.x} ${mY + headR * 0.04} Q${cx.x - mW * 0.5} ${mY + headR * 0.06} ${cx.x - mW} ${mY}Z`}
      fill={skinData.lip} opacity="0.82" />
    {/* Lower lip */}
    <path d={`M${cx.x - mW} ${mY} Q${cx.x} ${mY + headR * 0.26} ${cx.x + mW} ${mY} Q${cx.x + mW * 0.5} ${mY + headR * 0.22} ${cx.x} ${mY + headR * 0.24} Q${cx.x - mW * 0.5} ${mY + headR * 0.22} ${cx.x - mW} ${mY}Z`}
      fill={skinData.lip} opacity="0.68" />
    {/* Lip line */}
    <path d={`M${cx.x - mW} ${mY} Q${cx.x} ${mY + headR * 0.08} ${cx.x + mW} ${mY}`}
      fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1.2" strokeLinecap="round" />
    {/* Lower lip highlight */}
    <ellipse cx={cx.x} cy={mY + headR * 0.14} rx={mW * 0.42} ry={headR * 0.048}
      fill="white" opacity="0.18" />
  </g>;
}

function Freckles({ cx, headR, skinData }) {
  const spots = [
    [-headR * 0.46, -headR * 0.15], [-headR * 0.28, -headR * 0.08],
    [headR * 0.28, -headR * 0.08], [headR * 0.46, -headR * 0.15],
    [-headR * 0.53, headR * 0.10], [headR * 0.53, headR * 0.10],
  ];
  return <g>{spots.map(([dx, dy], i) => (
    <circle key={i} cx={cx.x + dx} cy={cx.y + dy} r={1.9}
      fill={skinData.shadow} opacity="0.52" />
  ))}</g>;
}

function Beard({ cx, headR, skinData, color }) {
  const by2 = cx.y + headR * 0.30;
  const bc = color === 'rainbow' ? '#3b1f0d' : color;
  return <g>
    <ellipse cx={cx.x} cy={by2 + headR * 0.24} rx={headR * 0.60} ry={headR * 0.40}
      fill={bc} opacity="0.82" />
    <ellipse cx={cx.x} cy={by2} rx={headR * 0.50} ry={headR * 0.24}
      fill={bc} opacity="0.72" />
    <ellipse cx={cx.x - headR * 0.18} cy={by2 - headR * 0.05} rx={headR * 0.12} ry={headR * 0.08}
      fill="rgba(255,255,255,0.12)" />
  </g>;
}

function Glasses({ cx, headR }) {
  const gy = cx.y - headR * 0.04;
  const er = headR * 0.27;
  return <g>
    <circle cx={cx.x - headR * 0.31} cy={gy} r={er}
      fill="rgba(100,180,255,0.08)" stroke="#2a2a2a" strokeWidth="2.6" />
    <circle cx={cx.x + headR * 0.31} cy={gy} r={er}
      fill="rgba(100,180,255,0.08)" stroke="#2a2a2a" strokeWidth="2.6" />
    {/* Highlight on lens */}
    <ellipse cx={cx.x - headR * 0.38} cy={gy - er * 0.35} rx={er * 0.28} ry={er * 0.18}
      fill="white" opacity="0.32" />
    <ellipse cx={cx.x + headR * 0.24} cy={gy - er * 0.35} rx={er * 0.28} ry={er * 0.18}
      fill="white" opacity="0.32" />
    <line x1={cx.x - headR * 0.04} y1={gy} x2={cx.x + headR * 0.04} y2={gy}
      stroke="#2a2a2a" strokeWidth="2.4" />
    <line x1={cx.x - headR * 0.58} y1={gy} x2={cx.x - headR * 0.74} y2={gy - 2.5}
      stroke="#2a2a2a" strokeWidth="2" />
    <line x1={cx.x + headR * 0.58} y1={gy} x2={cx.x + headR * 0.74} y2={gy - 2.5}
      stroke="#2a2a2a" strokeWidth="2" />
  </g>;
}

function Costume({ archetype, level, outfitColor, cx, bt, headR, skinData, artId }) {
  const tier = getLevelTier(level);
  const at = CHARACTER_ARCHETYPES.find(a => a.id === archetype);
  const group = at?.group || 'fighter';
  const oc = outfitColor || at?.primaryColor || '#c62828';
  const ocDark = adj(oc, -35);
  const ocLight = adj(oc, 28);
  const bodyShadeId = `bshade-${artId}`;

  const bx = cx.x;
  const by = cx.y + headR * 1.68;
  const sw = 32 * bt.sw;
  const hw = 24 * bt.hw;
  const th = 72;
  const armW = 11 * bt.lw, armH = 52;
  const legW = 14 * bt.lw, legH = 48;
  const legY = by + th;

  function Body() {
    return <g>
      <defs>
        <linearGradient id={bodyShadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0.28)" />
          <stop offset="26%" stopColor="rgba(0,0,0,0)" />
          <stop offset="74%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </linearGradient>
      </defs>
      {/* Torso */}
      <path d={`M${bx - sw} ${by} Q${bx - sw * 1.06} ${by + th * 0.5} ${bx - hw} ${by + th} L${bx + hw} ${by + th} Q${bx + sw * 1.06} ${by + th * 0.5} ${bx + sw} ${by}Z`}
        fill={oc} />
      {/* Shoulder caps */}
      <ellipse cx={bx - sw} cy={by} rx={armW * 0.78} ry={armW * 0.52} fill={ocLight} opacity="0.8" />
      <ellipse cx={bx + sw} cy={by} rx={armW * 0.78} ry={armW * 0.52} fill={ocLight} opacity="0.8" />
      {/* Arms — tapered via path */}
      <path d={`M${bx - sw} ${by + 2} L${bx - sw - armW * 0.6} ${by + armH}`}
        stroke={oc} strokeWidth={armW + 3} strokeLinecap="round" fill="none" />
      <path d={`M${bx + sw} ${by + 2} L${bx + sw + armW * 0.6} ${by + armH}`}
        stroke={oc} strokeWidth={armW + 3} strokeLinecap="round" fill="none" />
      {/* Arm shadow side */}
      <path d={`M${bx - sw - 2} ${by + 2} L${bx - sw - armW * 0.55} ${by + armH}`}
        stroke={ocDark} strokeWidth={armW * 0.55} strokeLinecap="round" fill="none" opacity="0.45" />
      <path d={`M${bx + sw + 2} ${by + 2} L${bx + sw + armW * 0.55} ${by + armH}`}
        stroke={ocDark} strokeWidth={armW * 0.55} strokeLinecap="round" fill="none" opacity="0.45" />
      {/* Hands */}
      <circle cx={bx - sw - armW * 0.42} cy={by + armH + armW * 0.68} r={armW * 0.72} fill={skinData.color} />
      <circle cx={bx + sw + armW * 0.42} cy={by + armH + armW * 0.68} r={armW * 0.72} fill={skinData.color} />
      {/* Knuckle lines */}
      {[-3.5, 0, 3.5].map(dx => (
        <line key={dx}
          x1={bx - sw - armW * 0.42 + dx} y1={by + armH + armW * 0.68 + armW * 0.42}
          x2={bx - sw - armW * 0.42 + dx} y2={by + armH + armW * 0.68 + armW * 1.12}
          stroke={skinData.shadow} strokeWidth="1.8" strokeLinecap="round" />
      ))}
      {/* Legs — tapered */}
      <path d={`M${bx - hw + 2} ${legY} L${bx - hw + legW * 0.35 + 2} ${legY + legH}`}
        stroke={oc} strokeWidth={legW + 4} strokeLinecap="round" fill="none" />
      <path d={`M${bx + hw - 2} ${legY} L${bx + hw - legW * 0.35 - 2} ${legY + legH}`}
        stroke={oc} strokeWidth={legW + 4} strokeLinecap="round" fill="none" />
      {/* Leg shadow side */}
      <path d={`M${bx - hw + 1} ${legY} L${bx - hw + legW * 0.3 + 1} ${legY + legH}`}
        stroke={ocDark} strokeWidth={legW * 0.5} strokeLinecap="round" fill="none" opacity="0.38" />
      <path d={`M${bx + hw - 1} ${legY} L${bx + hw - legW * 0.3 - 1} ${legY + legH}`}
        stroke={ocDark} strokeWidth={legW * 0.5} strokeLinecap="round" fill="none" opacity="0.38" />
      {/* Knee hint */}
      <ellipse cx={bx - hw + legW * 0.22 + 2} cy={legY + legH * 0.52} rx={legW * 0.55} ry={legW * 0.38}
        fill={ocDark} opacity="0.30" />
      <ellipse cx={bx + hw - legW * 0.22 - 2} cy={legY + legH * 0.52} rx={legW * 0.55} ry={legW * 0.38}
        fill={ocDark} opacity="0.30" />
      {/* Shoes */}
      <path d={`M${bx - hw + 2} ${legY + legH} L${bx - hw - 10} ${legY + legH + 11} L${bx - hw + legW + 8} ${legY + legH + 11} L${bx - hw + legW + 4} ${legY + legH}Z`}
        fill={ocDark} rx="2" />
      <path d={`M${bx + hw - 2} ${legY + legH} L${bx + hw - legW - 4} ${legY + legH} L${bx + hw - legW - 8} ${legY + legH + 11} L${bx + hw + 10} ${legY + legH + 11}Z`}
        fill={ocDark} />
      {/* Boot sole */}
      <rect x={bx - hw - 12} y={legY + legH + 12} width={legW + 22} height={3.5} rx="1.8" fill="rgba(0,0,0,0.45)" />
      <rect x={bx + hw - legW - 8} y={legY + legH + 12} width={legW + 22} height={3.5} rx="1.8" fill="rgba(0,0,0,0.45)" />
      {/* Boot highlight */}
      <ellipse cx={bx - hw - 4} cy={legY + legH + 5} rx={6} ry={2.2} fill="rgba(255,255,255,0.20)" />
      <ellipse cx={bx + hw + 4} cy={legY + legH + 5} rx={6} ry={2.2} fill="rgba(255,255,255,0.20)" />
      {/* Belt */}
      <rect x={bx - hw + 2} y={by + th * 0.56} width={hw * 2 - 4} height={7} rx="3.2" fill={ocDark} />
      <rect x={bx - 5.5} y={by + th * 0.56 - 1.5} width={11} height={10} rx="2.2" fill={adj(oc, -8)} />
      <rect x={bx - 3.5} y={by + th * 0.56 - 0.5} width={7} height={8} rx="1.5" fill="rgba(255,255,255,0.22)" />
      {/* Body depth shading */}
      <path d={`M${bx - sw} ${by} Q${bx - sw * 1.06} ${by + th * 0.5} ${bx - hw} ${by + th} L${bx + hw} ${by + th} Q${bx + sw * 1.06} ${by + th * 0.5} ${bx + sw} ${by}Z`}
        fill={`url(#${bodyShadeId})`} />
      {/* Chest center highlight */}
      <ellipse cx={bx} cy={by + th * 0.28} rx={sw * 0.32} ry={th * 0.20}
        fill="rgba(255,255,255,0.10)" />
    </g>;
  }

  function Glow() {
    if (level < 20) return null;
    return <g>
      <circle cx={bx} cy={by + th / 2} r={sw * 1.62} fill="none"
        stroke={oc} strokeWidth="4.5" opacity="0.28" />
      <circle cx={bx} cy={by + th / 2} r={sw * 1.95} fill="none"
        stroke={oc} strokeWidth="2" opacity="0.14" />
    </g>;
  }

  if (group === 'fighter') {
    return <g>
      <Glow />
      <Body />
      <path d={`M${bx - sw * 0.84} ${by + 5} Q${bx} ${by + 9} ${bx + sw * 0.84} ${by + 5} L${bx + sw * 0.72} ${by + th * 0.62} Q${bx} ${by + th * 0.66} ${bx - sw * 0.72} ${by + th * 0.62}Z`}
        fill={tier === 'legendary' ? '#B8860B' : tier === 'advanced' ? '#607d8b' : ocDark} opacity="0.86" />
      <ellipse cx={bx - sw} cy={by + 5} rx={armW * 0.88} ry={armW * 0.58}
        fill={tier === 'legendary' ? '#B8860B' : ocDark} />
      <ellipse cx={bx + sw} cy={by + 5} rx={armW * 0.88} ry={armW * 0.58}
        fill={tier === 'legendary' ? '#B8860B' : ocDark} />
      {archetype === 'viking' ? <>
        <rect x={bx + sw + armW + 3} y={by - 22} width={8.5} height={52} rx={2} fill="#8d6e63" />
        <path d={`M${bx + sw + armW + 1} ${by - 24} L${bx + sw + armW + 20} ${by - 7} L${bx + sw + armW + 9} ${by - 20}`}
          fill="#9e9e9e" />
      </> : <>
        <rect x={bx + sw + armW + 4} y={by - 32} width={4.5} height={68} rx={2.2}
          fill={tier === 'legendary' ? '#B8860B' : '#c8c8c8'} />
        <line x1={bx + sw + armW + 6.2} y1={by - 28} x2={bx + sw + armW + 6.2} y2={by + 30}
          stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" strokeLinecap="round" />
        <rect x={bx + sw + armW} y={by + 7} width={13} height={5} rx={2.5} fill={tier === 'legendary' ? '#B8860B' : '#78909c'} />
        {tier === 'legendary' && <ellipse cx={bx + sw + armW + 6} cy={by - 34} rx={4.5} ry={6.5} fill="#FFD700" opacity="0.88" />}
      </>}
      {(archetype === 'knight' || archetype === 'warrior') && (
        <path d={`M${bx - sw - armW - 2} ${by + 5} L${bx - sw - armW - 18} ${by + 9} L${bx - sw - armW - 20} ${by + 30} L${bx - sw - armW - 9} ${by + 43} L${bx - sw - armW - 2} ${by + 38}Z`}
          fill={tier === 'legendary' ? '#B8860B' : '#1565c0'} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      )}
      {tier === 'legendary' && <text x={bx} y={by - 40} textAnchor="middle" fontSize="17">👑</text>}
    </g>;
  }

  if (group === 'mage') {
    return <g>
      <Glow />
      <Body />
      <path d={`M${bx - sw * 0.84} ${by + 5} L${bx - hw * 1.22} ${by + th + 22} L${bx + hw * 1.22} ${by + th + 22} L${bx + sw * 0.84} ${by + 5}Z`}
        fill={ocDark} opacity="0.68" />
      <rect x={bx - hw} y={by + th * 0.60} width={hw * 2} height={7.5} rx={3.5} fill={ocDark} />
      <path d={`M${bx - hw * 0.94} ${by + th * 0.56} Q${bx} ${by + th * 0.58} ${bx + hw * 0.94} ${by + th * 0.56}`}
        fill="none" stroke={adj(oc, 18)} strokeWidth="3.5" strokeLinecap="round" opacity="0.62" />
      <rect x={bx + sw + armW + 3} y={by - 52} width={4.5} height={93} rx={2} fill="#8d6e63" />
      <circle cx={bx + sw + armW + 5} cy={by - 56} r={10}
        fill={tier === 'legendary' ? '#FDD835' : archetype === 'alchemist' ? '#66bb6a' : '#ce93d8'} />
      <circle cx={bx + sw + armW + 5} cy={by - 56} r={6} fill="white" opacity="0.48" />
      <circle cx={bx + sw + armW + 2} cy={by - 60} r={3} fill="white" opacity="0.32" />
      {archetype === 'wizard' && <>
        <path d={`M${bx - headR * 0.90} ${cx.y - headR * 0.5} L${bx} ${cx.y - headR * 2.25} L${bx + headR * 0.90} ${cx.y - headR * 0.5}Z`}
          fill={oc} />
        <ellipse cx={bx} cy={cx.y - headR * 0.5} rx={headR * 1.22} ry={headR * 0.36} fill={oc} />
        <circle cx={bx} cy={cx.y - headR * 2.20} r={4.5} fill="#FDD835" />
      </>}
      {tier === 'legendary' && <text x={bx} y={by - 58} textAnchor="middle" fontSize="14">✨</text>}
    </g>;
  }

  if (group === 'ranger') {
    return <g>
      <Glow />
      <Body />
      <path d={`M${bx - sw * 0.66} ${by + 5} L${bx - sw * 0.62} ${by + th * 0.72} L${bx - hw * 0.52} ${by + th * 0.72} L${bx - hw * 0.52} ${by + 5}Z`}
        fill={ocDark} opacity="0.78" />
      <path d={`M${bx + sw * 0.66} ${by + 5} L${bx + sw * 0.62} ${by + th * 0.72} L${bx + hw * 0.52} ${by + th * 0.72} L${bx + hw * 0.52} ${by + 5}Z`}
        fill={ocDark} opacity="0.78" />
      {archetype === 'archer' && <>
        <path d={`M${bx + sw + armW + 3} ${by - 30} Q${bx + sw + armW + 24} ${by + 12} ${bx + sw + armW + 3} ${by + 40}`}
          fill="none" stroke="#8d6e63" strokeWidth="4.5" />
        <line x1={bx + sw + armW + 3} y1={by - 30} x2={bx + sw + armW + 3} y2={by + 40}
          stroke="#c0c0c0" strokeWidth="1.2" />
        <rect x={bx - sw - armW - 11} y={by - 12} width={9} height={32} rx={4.5} fill="#8d6e63" />
        {[-5.5, 0, 5.5].map(dx => (
          <line key={dx} x1={bx - sw - armW - 7 + dx} y1={by - 12}
            x2={bx - sw - armW - 7 + dx} y2={by - 20}
            stroke="#9e9e9e" strokeWidth="1.6" />
        ))}
      </>}
      {archetype === 'explorer' && <>
        <ellipse cx={bx} cy={cx.y - headR * 0.62} rx={headR * 1.28} ry={headR * 0.34} fill="#8d6e63" />
        <circle cx={bx + sw + armW + 7} cy={by + 22} r={8.5} fill="#9e9e9e" />
        <circle cx={bx + sw + armW + 7} cy={by + 22} r={6} fill="#bdbdbd" />
        <line x1={bx + sw + armW + 7} y1={by + 14} x2={bx + sw + armW + 7} y2={by + 30} stroke="#e53935" strokeWidth="1.8" />
        <line x1={bx + sw + armW - 1} y1={by + 22} x2={bx + sw + armW + 15} y2={by + 22} stroke="#e53935" strokeWidth="1.8" />
      </>}
    </g>;
  }

  if (group === 'monk_type') {
    return <g>
      <Glow />
      <Body />
      {archetype === 'bodybuilder' && <>
        <rect x={bx - sw * 0.3} y={by} width={sw * 0.26} height={th} rx={4} fill={ocDark} />
        <rect x={bx + sw * 0.04} y={by} width={sw * 0.26} height={th} rx={4} fill={ocDark} />
        <path d={`M${bx - sw * 0.52} ${by + 4} L${bx} ${by + th * 0.36} L${bx + sw * 0.52} ${by + 4}`}
          fill="none" stroke={adj(oc, -18)} strokeWidth="2.5" strokeLinecap="round" opacity="0.72" />
        <ellipse cx={bx - sw * 0.62} cy={by + th * 0.28} rx={sw * 0.22} ry={th * 0.14}
          fill="rgba(255,255,255,0.10)" />
        <ellipse cx={bx + sw * 0.62} cy={by + th * 0.28} rx={sw * 0.22} ry={th * 0.14}
          fill="rgba(255,255,255,0.10)" />
        <text x={bx + sw + armW + 7} y={by + 22} fontSize="22">🏆</text>
      </>}
      {archetype === 'monk' && <>
        <path d={`M${bx - sw * 0.76} ${by + 5} L${bx - hw * 1.12} ${by + th + 17} L${bx + hw * 1.12} ${by + th + 17} L${bx + sw * 0.76} ${by + 5}Z`}
          fill={ocDark} opacity="0.62" />
        <path d={`M${bx - 13} ${by + 13} Q${bx} ${by + 37} ${bx + 13} ${by + 13}`}
          fill="none" stroke="#fdd835" strokeWidth="3.5" strokeDasharray="4.5 3" />
        {Array.from({ length: 12 }, (_, mi) => {
          const t = mi / 11;
          const mx = bx - 13 + t * 26;
          const my = by + th * 0.72 + Math.sin(t * Math.PI) * 7;
          return <circle key={mi} cx={mx} cy={my} r={2.2} fill="#795548" opacity="0.86" />;
        })}
      </>}
      {tier === 'legendary' && archetype === 'bodybuilder' &&
        <text x={bx} y={by - 44} textAnchor="middle" fontSize="15">💎</text>}
    </g>;
  }

  if (group === 'stealth') {
    return <g>
      <Glow />
      <Body />
      <path d={`M${bx - sw * 0.86} ${by + 4} Q${bx} ${by + 7} ${bx + sw * 0.86} ${by + 4} L${bx + hw} ${by + th} L${bx - hw} ${by + th}Z`}
        fill="rgba(0,0,0,0.32)" />
      {archetype === 'ninja' && <>
        <rect x={bx - headR * 0.92} y={cx.y - headR * 0.24} width={headR * 1.84} height={headR * 0.42}
          rx={headR * 0.21} fill={oc} />
        <rect x={bx + sw + armW + 3} y={by - 38} width={3.5} height={74} rx={1.8} fill="#c0c0c0" />
        <rect x={bx + sw + armW - 2} y={by + 14} width={12} height={5.5} rx={2} fill="#8d6e63" />
      </>}
      {archetype === 'pirate' && <>
        <path d={`M${bx - headR * 1.02} ${cx.y - headR * 0.64} L${bx} ${cx.y - headR * 2.05} L${bx + headR * 1.02} ${cx.y - headR * 0.64}Z`}
          fill="#1a1a1a" />
        <ellipse cx={bx} cy={cx.y - headR * 0.64} rx={headR * 1.18} ry={headR * 0.30} fill="#1a1a1a" />
        <text x={bx} y={cx.y - headR * 1.14} textAnchor="middle" fontSize="10" fill="white">☠</text>
        <rect x={bx + sw + armW + 3} y={by - 28} width={4.5} height={62} rx={2} fill="#c0c0c0" />
      </>}
    </g>;
  }

  if (group === 'creative') {
    return <g>
      <Glow />
      <Body />
      {archetype === 'chef' && <>
        <rect x={bx - headR * 0.62} y={cx.y - headR * 1.02} width={headR * 1.24} height={headR * 0.52} rx={4.5} fill="white" />
        <ellipse cx={bx} cy={cx.y - headR * 1.0} rx={headR * 0.74} ry={headR * 0.40} fill="white" />
        <rect x={bx - sw * 0.56} y={by + 9} width={sw * 1.12} height={th * 0.76} rx={4} fill="white" opacity="0.84" />
        <line x1={bx + sw + armW + 5} y1={by - 12} x2={bx + sw + armW + 5} y2={by + 42} stroke="#b0b0b0" strokeWidth="3.5" />
        <circle cx={bx + sw + armW + 5} cy={by - 18} r={8} fill="none" stroke="#b0b0b0" strokeWidth="3.5" />
      </>}
      {archetype === 'scientist' && <>
        <path d={`M${bx - sw * 0.84} ${by + 5} L${bx - hw * 1.12} ${by + th + 20} L${bx + hw * 1.12} ${by + th + 20} L${bx + sw * 0.84} ${by + 5}Z`}
          fill="white" opacity="0.80" />
        <circle cx={bx - headR * 0.31} cy={cx.y - headR * 0.04} r={headR * 0.25}
          fill="rgba(21,101,192,0.12)" stroke="#1565c0" strokeWidth="3" />
        <circle cx={bx + headR * 0.31} cy={cx.y - headR * 0.04} r={headR * 0.25}
          fill="rgba(21,101,192,0.12)" stroke="#1565c0" strokeWidth="3" />
        <rect x={bx - sw - armW - 15} y={by + 6} width={15} height={20} rx={2} fill="white" stroke="#b0b0b0" strokeWidth="1.2" />
      </>}
      {archetype === 'artist' && <>
        <path d={`M${bx - sw * 0.84} ${by + 5} L${bx - hw * 1.12} ${by + th + 17} L${bx + hw * 1.12} ${by + th + 17} L${bx + sw * 0.84} ${by + 5}Z`}
          fill={oc} opacity="0.62" />
        {['#e53935', '#FDD835', '#43a047', '#1e88e5'].map((col, i) => (
          <circle key={i} cx={bx - sw * 0.28 + i * 11} cy={by + th * 0.38} r={3.8} fill={col} opacity="0.82" />
        ))}
        <ellipse cx={bx + sw + armW + 8} cy={by + 24} rx={12} ry={9} fill="#efebe9" />
        {['#e53935', '#1e88e5', '#FDD835'].map((col, i) => (
          <circle key={i} cx={bx + sw + armW + 5 + i * 4} cy={by + 22 + i * 3} r={2.8} fill={col} />
        ))}
      </>}
      {archetype === 'rockstar' && <>
        <path d={`M${bx - sw * 0.86} ${by + 4} Q${bx} ${by + 7} ${bx + sw * 0.86} ${by + 4} L${bx + hw} ${by + th} L${bx - hw} ${by + th}Z`}
          fill={ocDark} opacity="0.78" />
        <ellipse cx={bx + sw + armW + 9} cy={by + 30} rx={11} ry={14} fill="#8d6e63" />
        <rect x={bx + sw + armW + 6} y={by - 24} width={6.5} height={54} rx={3} fill="#6d4c41" />
        {[-3.5, 0, 3.5].map(dy => (
          <line key={dy} x1={bx + sw + armW + 5} y1={by + dy} x2={bx + sw + armW + 18} y2={by + dy}
            stroke="#9e9e9e" strokeWidth="0.9" />
        ))}
      </>}
    </g>;
  }

  if (group === 'athlete') {
    return <g>
      <Glow />
      <Body />
      <rect x={bx - sw * 0.12} y={by + 3} width={sw * 0.24} height={th} rx={3.5} fill={ocDark} opacity="0.72" />
      <rect x={bx - sw * 0.88} y={by + 8} width={sw * 0.18} height={th * 0.72} rx={2.5} fill={ocDark} opacity="0.38" />
      <rect x={bx + sw * 0.70} y={by + 8} width={sw * 0.18} height={th * 0.72} rx={2.5} fill={ocDark} opacity="0.38" />
      {archetype === 'dancer' && <>
        <path d={`M${bx + sw + 3} ${by + 6} Q${bx + sw + 24} ${by + 22} ${bx + sw + 20} ${by + 44} Q${bx + sw + 10} ${by + 56} ${bx + sw + 26} ${by + 64}`}
          fill="none" stroke={oc} strokeWidth="3.2" strokeLinecap="round" />
        <path d={`M${bx - hw * 1.35} ${by + th * 0.70} Q${bx} ${by + th * 0.74} ${bx + hw * 1.35} ${by + th * 0.70}`}
          fill="none" stroke={adj(oc, 28)} strokeWidth="9" strokeLinecap="round" opacity="0.50" />
        <path d={`M${bx - hw * 1.35} ${by + th * 0.70} Q${bx} ${by + th * 0.74} ${bx + hw * 1.35} ${by + th * 0.70}`}
          fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" strokeLinecap="round" />
      </>}
      {tier === 'legendary' && <text x={bx} y={by - 44} textAnchor="middle" fontSize="15">⚡</text>}
    </g>;
  }

  if (group === 'hero') {
    return <g>
      <Glow />
      <Body />
      {archetype === 'astronaut' && <>
        <path d={`M${bx - sw * 0.90} ${by + 3} Q${bx} ${by + 9} ${bx + sw * 0.90} ${by + 3} L${bx + hw * 1.12} ${by + th + 12} L${bx - hw * 1.12} ${by + th + 12}Z`}
          fill="white" opacity="0.86" />
        <circle cx={bx} cy={cx.y - headR * 0.1} r={headR * 1.24}
          fill="none" stroke="white" strokeWidth="5.5" opacity="0.78" />
        <path d={`M${bx - headR * 0.76} ${cx.y - headR * 0.42} Q${bx} ${cx.y - headR * 0.72} ${bx + headR * 0.76} ${cx.y - headR * 0.42} Q${bx + headR * 0.72} ${cx.y + headR * 0.22} ${bx} ${cx.y + headR * 0.32} Q${bx - headR * 0.72} ${cx.y + headR * 0.22} ${bx - headR * 0.76} ${cx.y - headR * 0.42}Z`}
          fill="#1e88e5" opacity="0.52" />
        <ellipse cx={bx - headR * 0.22} cy={cx.y - headR * 0.18} rx={headR * 0.32} ry={headR * 0.22}
          fill="rgba(255,255,255,0.22)" />
      </>}
      {archetype === 'superhero' && <>
        <path d={`M${bx - sw * 0.90} ${by + 3} Q${bx - sw * 1.34} ${by + th * 0.5} ${bx - sw * 0.82} ${by + th + legH + 12}`}
          fill={oc} opacity="0.72" />
        <path d={`M${bx - sw * 0.86} ${by + 5} Q${bx - sw * 1.28} ${by + th * 0.5} ${bx - sw * 0.78} ${by + th + legH + 10}`}
          fill="none" stroke={adj(oc, 30)} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        <circle cx={bx} cy={by + th * 0.38} r={9.5}
          fill={tier === 'legendary' ? '#FDD835' : 'white'} opacity="0.86" />
        <circle cx={bx} cy={by + th * 0.38} r={5}
          fill={tier === 'legendary' ? '#f57f17' : oc} opacity="0.72" />
        <text x={bx} y={by - 44} textAnchor="middle" fontSize="17">⚡</text>
      </>}
      {tier === 'legendary' && <text x={bx} y={cx.y - headR * 2.15} textAnchor="middle" fontSize="15">✨</text>}
    </g>;
  }

  return <g><Glow /><Body /></g>;
}

export default function CharacterSVG({
  archetype = 'warrior',
  gender = 'masculine',
  skinTone = 'tone2',
  hairColor = 'black',
  hairStyle = 'short',
  eyeColor = 'brown',
  beard = false,
  freckles = false,
  glasses = false,
  bodyType = 'average',
  outfitColor = '#c62828',
  level = 1,
  background = 'day',
  width = 200,
  height = 280,
}) {
  const rawId = useId();
  const artId = rawId.replace(/:/g, 'x');

  const skinData = SKIN_TONES.find(s => s.id === skinTone) || SKIN_TONES[1];
  const bt = BODY_TYPES.find(b => b.id === bodyType) || BODY_TYPES[1];
  const headR = 22 * bt.hs;
  const charCX = { x: 100, y: 68, skin: skinData.color };
  const hc = getHairColor(hairColor);
  const isLowHealth = level === 1;

  const highlight = adj(skinData.color, 38);
  const faceGradId = `face-${artId}`;

  return (
    <svg viewBox="0 0 200 280" width={width} height={height} xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
      <defs>
        <radialGradient id={faceGradId} cx="42%" cy="24%" r="74%">
          <stop offset="0%" stopColor={adj(highlight, 18)} />
          <stop offset="18%" stopColor={highlight} />
          <stop offset="48%" stopColor={skinData.color} />
          <stop offset="78%" stopColor={adj(skinData.color, -14)} />
          <stop offset="100%" stopColor={skinData.shadow} />
        </radialGradient>
        <clipPath id={`head-clip-${artId}`}>
          <ellipse cx="100" cy={charCX.y} rx={headR} ry={headR * 1.06} />
        </clipPath>
      </defs>

      <CharBackground bgId={background} artId={artId} />

      <g transform={isLowHealth ? `rotate(-4, 100, 160)` : ''}>
        {/* Ground shadow */}
        <ellipse cx="100" cy="228" rx="34" ry="8.5" fill="rgba(0,0,0,0.20)" />

        {/* Costume (body, arms, legs) */}
        <Costume
          archetype={archetype} level={level} outfitColor={outfitColor}
          cx={charCX} bt={bt} headR={headR} skinData={skinData} artId={artId}
        />

        {/* Neck */}
        <rect
          x={charCX.x - 6 * bt.sw}
          y={charCX.y + headR * 0.80}
          width={12 * bt.sw}
          height={16}
          rx={5.5}
          fill={skinData.color}
        />
        {/* Neck shadow */}
        <rect
          x={charCX.x - 6 * bt.sw}
          y={charCX.y + headR * 0.80}
          width={12 * bt.sw}
          height={16}
          rx={5.5}
          fill={skinData.shadow}
          opacity="0.20"
        />

        {/* Head shape — bezier jaw instead of plain ellipse */}
        <path d={`
          M ${charCX.x},${charCX.y - headR * 1.02}
          C ${charCX.x + headR * 0.96},${charCX.y - headR * 0.93}
            ${charCX.x + headR * 1.02},${charCX.y + headR * 0.10}
            ${charCX.x + headR * 0.82},${charCX.y + headR * 0.60}
          C ${charCX.x + headR * 0.62},${charCX.y + headR * 0.96}
            ${charCX.x + headR * 0.30},${charCX.y + headR * 1.13}
            ${charCX.x},${charCX.y + headR * 1.15}
          C ${charCX.x - headR * 0.30},${charCX.y + headR * 1.13}
            ${charCX.x - headR * 0.62},${charCX.y + headR * 0.96}
            ${charCX.x - headR * 0.82},${charCX.y + headR * 0.60}
          C ${charCX.x - headR * 1.02},${charCX.y + headR * 0.10}
            ${charCX.x - headR * 0.96},${charCX.y - headR * 0.93}
            ${charCX.x},${charCX.y - headR * 1.02}
          Z
        `} fill={`url(#${faceGradId})`} />

        {/* Ears */}
        <path d={`M${charCX.x - headR * 0.96} ${charCX.y - headR * 0.16} Q${charCX.x - headR * 1.16} ${charCX.y} ${charCX.x - headR * 0.96} ${charCX.y + headR * 0.20}`}
          fill="none" stroke={skinData.color} strokeWidth={headR * 0.23} strokeLinecap="round" />
        <path d={`M${charCX.x + headR * 0.96} ${charCX.y - headR * 0.16} Q${charCX.x + headR * 1.16} ${charCX.y} ${charCX.x + headR * 0.96} ${charCX.y + headR * 0.20}`}
          fill="none" stroke={skinData.color} strokeWidth={headR * 0.23} strokeLinecap="round" />
        {/* Ear shadow */}
        <ellipse cx={charCX.x - headR * 0.99} cy={charCX.y} rx={headR * 0.11} ry={headR * 0.19}
          fill={skinData.shadow} opacity="0.28" />
        <ellipse cx={charCX.x + headR * 0.99} cy={charCX.y} rx={headR * 0.11} ry={headR * 0.19}
          fill={skinData.shadow} opacity="0.28" />

        {/* Cheekbone highlights */}
        <ellipse cx={charCX.x - headR * 0.52} cy={charCX.y + headR * 0.20} rx={headR * 0.22} ry={headR * 0.14}
          fill="white" opacity="0.10" />
        <ellipse cx={charCX.x + headR * 0.52} cy={charCX.y + headR * 0.20} rx={headR * 0.22} ry={headR * 0.14}
          fill="white" opacity="0.10" />
        {/* Temple shadow */}
        <ellipse cx={charCX.x - headR * 0.82} cy={charCX.y - headR * 0.35} rx={headR * 0.17} ry={headR * 0.28}
          fill={skinData.shadow} opacity="0.12" />
        <ellipse cx={charCX.x + headR * 0.82} cy={charCX.y - headR * 0.35} rx={headR * 0.17} ry={headR * 0.28}
          fill={skinData.shadow} opacity="0.12" />
        {/* Jaw shadow */}
        <ellipse cx={charCX.x} cy={charCX.y + headR * 0.88} rx={headR * 0.55} ry={headR * 0.18}
          fill={skinData.shadow} opacity="0.22" />
        {/* Cheek blush */}
        <ellipse cx={charCX.x - headR * 0.54} cy={charCX.y + headR * 0.26} rx={headR * 0.26} ry={headR * 0.16}
          fill={skinData.lip || '#e88080'} opacity="0.13" />
        <ellipse cx={charCX.x + headR * 0.54} cy={charCX.y + headR * 0.26} rx={headR * 0.26} ry={headR * 0.16}
          fill={skinData.lip || '#e88080'} opacity="0.13" />
        {/* Philtrum */}
        <path d={`M${charCX.x - headR * 0.08} ${charCX.y + headR * 0.30} Q${charCX.x} ${charCX.y + headR * 0.37} ${charCX.x + headR * 0.08} ${charCX.y + headR * 0.30}`}
          fill="none" stroke={skinData.shadow} strokeWidth="0.9" strokeLinecap="round" opacity="0.22" />

        {/* Beard (behind hair) */}
        {beard && <Beard cx={charCX} headR={headR} skinData={skinData} color={hc} />}

        {/* Eyebrows */}
        <Eyebrows cx={charCX} headR={headR} hairColor={hc} gender={gender} />

        {/* Hair */}
        <Hair style={hairStyle} color={hc} cx={charCX} headR={headR} gender={gender} artId={artId} />

        {/* Face features */}
        <Eyes cx={charCX} headR={headR} eyeColorId={eyeColor} artId={artId} />
        <Nose cx={charCX} headR={headR} skinData={skinData} />
        <Mouth cx={charCX} headR={headR} skinData={skinData} />

        {freckles && <Freckles cx={charCX} headR={headR} skinData={skinData} />}
        {glasses && <Glasses cx={charCX} headR={headR} />}
      </g>

      {/* Level badge */}
      <g>
        <circle cx="174" cy="26" r="17" fill="rgba(0,0,0,0.58)" />
        <circle cx="174" cy="26" r="15" fill="rgba(0,0,0,0.35)" />
        <text x="174" y="22" textAnchor="middle" fontSize="8" fill="#b0b0b0" fontWeight="500">LVL</text>
        <text x="174" y="33" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">{level}</text>
      </g>
    </svg>
  );
}
