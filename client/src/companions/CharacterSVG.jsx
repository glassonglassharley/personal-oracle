import { useId } from 'react';
import { CHARACTER_ARCHETYPES, SKIN_TONES, HAIR_COLORS, BODY_TYPES, EYE_COLORS, BACKGROUNDS, getLevelTier } from './companionData';

function CharBackground({ bgId }) {
  const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
  const isNight = bgId === 'night_stars' || bgId === 'space' || bgId === 'mystical_forest';

  return (
    <g>
      <defs>
        <linearGradient id="char-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.sky1} />
          <stop offset="100%" stopColor={bg.sky2} />
        </linearGradient>
      </defs>
      <rect width="200" height="220" fill="url(#char-sky)" />
      <rect x="0" y="220" width="200" height="60" fill={bg.ground} />

      {isNight && Array.from({ length: 20 }, (_, i) => (
        <circle key={i} cx={(i * 37 + 11) % 196 + 2} cy={(i * 23 + 7) % 110}
          r={i % 4 === 0 ? 1.5 : 1} fill="white" opacity={0.4 + (i % 5) * 0.1} />
      ))}

      {bgId === 'day' && <>
        <ellipse cx="38" cy="45" rx="22" ry="13" fill="white" opacity="0.72" />
        <ellipse cx="55" cy="40" rx="17" ry="11" fill="white" opacity="0.72" />
        <circle cx="168" cy="35" r="15" fill="#FDD835" opacity="0.88" />
      </>}

      {bgId === 'sunset' && <circle cx="100" cy="190" r="36" fill="#FF7043" opacity="0.55" />}

      {bgId === 'rainy' && Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={(i * 11 + 3) % 200} y1={(i * 17) % 200}
          x2={((i * 11 + 3) % 200) - 3} y2={((i * 17) % 200) + 14}
          stroke="#90A4AE" strokeWidth="1" opacity="0.5" />
      ))}

      {bgId === 'mystical_forest' && <>
        <circle cx="162" cy="30" r="13" fill="#FFF9C4" opacity="0.72" />
        <circle cx="170" cy="25" r="10" fill={bg.sky1} opacity="0.9" />
      </>}

      {bgId === 'space' && <>
        <circle cx="50" cy="48" r="17" fill="#5c6bc0" opacity="0.5" />
        <ellipse cx="50" cy="48" rx="26" ry="7" fill="none" stroke="#90caf9" strokeWidth="1.5" opacity="0.4" />
      </>}
    </g>
  );
}

function getHairColor(hcId) {
  const found = HAIR_COLORS.find(h => h.id === hcId);
  return found?.color || '#1a1a1a';
}

function Hair({ style, color, cx, headR, gender }) {
  const c = color === 'rainbow' ? 'url(#hair-rainbow)' : color;
  const topY = cx.y - headR;
  const isRainbow = color === 'rainbow';

  const rainbowDef = isRainbow ? (
    <defs>
      <linearGradient id="hair-rainbow" x1="0" y1="0" x2="1" y2="0">
        {['#e53935', '#f9a825', '#43a047', '#1e88e5', '#8e24aa'].map((col, i) => (
          <stop key={i} offset={`${i * 25}%`} stopColor={col} />
        ))}
      </linearGradient>
    </defs>
  ) : null;

  if (style === 'bald') return rainbowDef;

  if (style === 'buzz') return <g>
    {rainbowDef}
    <circle cx={cx.x} cy={cx.y} r={headR + 1.5} fill={c} clipPath="url(#head-clip)" opacity="0.9" />
  </g>;

  if (style === 'afro') return <g>
    {rainbowDef}
    <circle cx={cx.x} cy={cx.y - headR * 0.25} r={headR * 1.32} fill={c} />
    <circle cx={cx.x - headR * 0.8} cy={cx.y - headR * 0.2} r={headR * 0.6} fill={c} />
    <circle cx={cx.x + headR * 0.8} cy={cx.y - headR * 0.2} r={headR * 0.6} fill={c} />
  </g>;

  if (style === 'mohawk') return <g>
    {rainbowDef}
    <rect x={cx.x - 6} y={topY - 22} width={12} height={22} rx={4} fill={c} />
    <ellipse cx={cx.x} cy={topY - 22} rx={7} ry={5} fill={c} />
  </g>;

  if (style === 'long') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.5} rx={headR * 1.1} ry={headR * 1.15} fill={c} />
    <rect x={cx.x - headR * 1.05} y={cx.y} width={headR * 0.58} height={headR * 2.2} rx={6} fill={c} />
    <rect x={cx.x + headR * 0.48} y={cx.y} width={headR * 0.58} height={headR * 2.2} rx={6} fill={c} />
  </g>;

  if (style === 'braids') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.55} rx={headR * 1.08} ry={headR * 1.1} fill={c} />
    {[-1, 1].map(dir => (
      <g key={dir}>
        <rect x={cx.x + dir * headR * 0.55 - 5} y={cx.y + headR * 0.5} width={10} height={headR * 2} rx={5} fill={c} />
        {Array.from({ length: 5 }, (_, j) => (
          <rect key={j} x={cx.x + dir * headR * 0.55 - 5} y={cx.y + headR * 0.5 + j * (headR * 2 / 5)}
            width={10} height={3} rx={1.5} fill="rgba(0,0,0,0.2)" />
        ))}
      </g>
    ))}
  </g>;

  if (style === 'dreadlocks') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.5} rx={headR * 1.1} ry={headR * 1.08} fill={c} />
    {[-headR * 0.7, -headR * 0.25, headR * 0.25, headR * 0.7].map((dx, i) => (
      <rect key={i} x={cx.x + dx - 4} y={cx.y + headR * 0.3} width={8}
        height={headR * (1.2 + i * 0.2)} rx={4} fill={c} opacity="0.92" />
    ))}
  </g>;

  if (style === 'bun') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.55} rx={headR * 1.05} ry={headR * 0.85} fill={c} />
    <circle cx={cx.x} cy={topY - 8} r={headR * 0.45} fill={c} />
  </g>;

  if (style === 'ponytail') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.55} rx={headR * 1.05} ry={headR * 0.88} fill={c} />
    <path d={`M${cx.x - 8} ${cx.y} Q${cx.x + headR * 1.5} ${cx.y + headR} ${cx.x + headR * 0.5} ${cx.y + headR * 2}`}
      fill="none" stroke={c} strokeWidth={12} strokeLinecap="round" />
  </g>;

  if (style === 'pigtails') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.52} rx={headR * 1.05} ry={headR * 0.88} fill={c} />
    {[-1, 1].map(dir => (
      <path key={dir}
        d={`M${cx.x + dir * headR * 0.9} ${cx.y - headR * 0.3} Q${cx.x + dir * headR * 1.6} ${cx.y + headR * 0.5} ${cx.x + dir * headR * 1.1} ${cx.y + headR * 1.2}`}
        fill="none" stroke={c} strokeWidth={10} strokeLinecap="round" />
    ))}
  </g>;

  if (style === 'undercut') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.6} rx={headR * 1.08} ry={headR * 0.8} fill={c} />
    <rect x={cx.x - headR * 0.7} y={topY - 4} width={headR * 1.4} height={headR * 0.7} rx={4} fill={c} />
  </g>;

  if (style === 'quiff') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.52} rx={headR * 1.05} ry={headR * 0.88} fill={c} />
    <path d={`M${cx.x - headR * 0.5} ${topY + 4} Q${cx.x} ${topY - 20} ${cx.x + headR * 0.4} ${topY + 6}`}
      fill={c} stroke={c} strokeWidth="2" />
  </g>;

  if (style === 'shaved_sides') return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.6} rx={headR * 0.7} ry={headR * 0.7} fill={c} />
    <rect x={cx.x - headR * 0.7} y={topY + 2} width={headR * 1.4} height={headR * 0.5} rx={3} fill={c} />
  </g>;

  // default: medium wave / short
  return <g>
    {rainbowDef}
    <ellipse cx={cx.x} cy={cx.y - headR * 0.58} rx={headR * 1.08}
      ry={style === 'medium' ? headR * 1.0 : headR * 0.82} fill={c} />
    {style === 'medium' && <>
      <ellipse cx={cx.x - headR * 1.0} cy={cx.y - headR * 0.1} rx={headR * 0.2} ry={headR * 0.45} fill={c} />
      <ellipse cx={cx.x + headR * 1.0} cy={cx.y - headR * 0.1} rx={headR * 0.2} ry={headR * 0.45} fill={c} />
    </>}
  </g>;
}

function Eyes({ cx, headR, eyeColorId }) {
  const eyeData = EYE_COLORS.find(e => e.id === eyeColorId) || EYE_COLORS[0];
  const isHetero = eyeColorId === 'heterochromia';
  const lColor = eyeData.color;
  const rColor = isHetero ? (eyeData.rightColor || '#388e3c') : lColor;
  const ey = cx.y - headR * 0.05;
  const er = headR * 0.18;

  return <g>
    {/* Whites */}
    <ellipse cx={cx.x - headR * 0.3} cy={ey} rx={er * 1.4} ry={er * 1.1} fill="white" />
    <ellipse cx={cx.x + headR * 0.3} cy={ey} rx={er * 1.4} ry={er * 1.1} fill="white" />
    {/* Irises */}
    <circle cx={cx.x - headR * 0.3} cy={ey} r={er} fill={lColor} />
    <circle cx={cx.x + headR * 0.3} cy={ey} r={er} fill={rColor} />
    {/* Pupils */}
    <circle cx={cx.x - headR * 0.3} cy={ey} r={er * 0.5} fill="rgba(0,0,0,0.8)" />
    <circle cx={cx.x + headR * 0.3} cy={ey} r={er * 0.5} fill="rgba(0,0,0,0.8)" />
    {/* Highlights */}
    <circle cx={cx.x - headR * 0.24} cy={ey - er * 0.35} r={er * 0.22} fill="white" opacity="0.85" />
    <circle cx={cx.x + headR * 0.36} cy={ey - er * 0.35} r={er * 0.22} fill="white" opacity="0.85" />
  </g>;
}

function Freckles({ cx, headR, skinData }) {
  const spots = [
    [-headR * 0.45, -headR * 0.15], [-headR * 0.28, -headR * 0.08],
    [headR * 0.28, -headR * 0.08], [headR * 0.45, -headR * 0.15],
    [-headR * 0.52, headR * 0.1], [headR * 0.52, headR * 0.1],
  ];
  return <g>{spots.map(([dx, dy], i) => (
    <circle key={i} cx={cx.x + dx} cy={cx.y + dy} r={1.8}
      fill={skinData.shadow} opacity="0.55" />
  ))}</g>;
}

function Beard({ cx, headR, skinData, color }) {
  const by = cx.y + headR * 0.3;
  return <g>
    <ellipse cx={cx.x} cy={by + headR * 0.22} rx={headR * 0.58} ry={headR * 0.38}
      fill={color} opacity="0.85" />
    <ellipse cx={cx.x} cy={by} rx={headR * 0.48} ry={headR * 0.22}
      fill={color} opacity="0.75" />
  </g>;
}

function Glasses({ cx, headR }) {
  const gy = cx.y - headR * 0.06;
  return <g>
    <circle cx={cx.x - headR * 0.3} cy={gy} r={headR * 0.26}
      fill="none" stroke="#333" strokeWidth="2.5" />
    <circle cx={cx.x + headR * 0.3} cy={gy} r={headR * 0.26}
      fill="none" stroke="#333" strokeWidth="2.5" />
    <line x1={cx.x - headR * 0.04} y1={gy} x2={cx.x + headR * 0.04} y2={gy}
      stroke="#333" strokeWidth="2.5" />
    <line x1={cx.x - headR * 0.56} y1={gy} x2={cx.x - headR * 0.72} y2={gy - 2}
      stroke="#333" strokeWidth="2" />
    <line x1={cx.x + headR * 0.56} y1={gy} x2={cx.x + headR * 0.72} y2={gy - 2}
      stroke="#333" strokeWidth="2" />
  </g>;
}

function Costume({ archetype, level, outfitColor, cx, bt, headR }) {
  const tier = getLevelTier(level);
  const at = CHARACTER_ARCHETYPES.find(a => a.id === archetype);
  const group = at?.group || 'fighter';
  const oc = outfitColor || at?.primaryColor || '#c62828';
  const ocDark = oc + 'cc';

  // Body center/dims
  const bx = cx.x, by = cx.y + headR * 0.65;
  const sw = 30 * bt.sw; // half shoulder width
  const hw = 24 * bt.hw; // half hip width
  const th = 55; // torso height
  const armW = 10 * bt.lw, armH = 42;
  const legW = 14 * bt.lw, legH = 36;
  const legY = by + th;

  function Body() {
    return <g>
      {/* Torso */}
      <path d={`M${bx - sw} ${by} Q${bx - sw * 1.05} ${by + th * 0.5} ${bx - hw} ${by + th} L${bx + hw} ${by + th} Q${bx + sw * 1.05} ${by + th * 0.5} ${bx + sw} ${by}Z`}
        fill={oc} />
      {/* Shoulders */}
      <ellipse cx={bx - sw} cy={by} rx={armW * 0.7} ry={armW * 0.45} fill={oc} />
      <ellipse cx={bx + sw} cy={by} rx={armW * 0.7} ry={armW * 0.45} fill={oc} />
      {/* Arms */}
      <rect x={bx - sw - armW + 2} y={by + 2} width={armW} height={armH} rx={armW / 2} fill={oc} />
      <rect x={bx + sw - 2} y={by + 2} width={armW} height={armH} rx={armW / 2} fill={oc} />
      {/* Hands */}
      <circle cx={bx - sw - armW / 2 + 2} cy={by + armH + armW * 0.6} r={armW * 0.65} fill={cx.skin} />
      <circle cx={bx + sw + armW / 2 - 2} cy={by + armH + armW * 0.6} r={armW * 0.65} fill={cx.skin} />
      {/* Legs */}
      <rect x={bx - hw + 2} y={legY} width={legW} height={legH} rx={legW / 2} fill={oc} />
      <rect x={bx + hw - legW - 2} y={legY} width={legW} height={legH} rx={legW / 2} fill={oc} />
      {/* Feet */}
      <ellipse cx={bx - hw + 2 + legW / 2} cy={legY + legH + 5} rx={legW * 0.85} ry={6} fill={oc} />
      <ellipse cx={bx + hw - legW / 2 - 2} cy={legY + legH + 5} rx={legW * 0.85} ry={6} fill={oc} />
    </g>;
  }

  // Legend glow ring
  function Glow() {
    if (level < 20) return null;
    return <g>
      <circle cx={bx} cy={by + th / 2} r={sw * 1.6} fill="none"
        stroke={oc} strokeWidth="4" opacity="0.3" />
      <circle cx={bx} cy={by + th / 2} r={sw * 1.9} fill="none"
        stroke={oc} strokeWidth="2" opacity="0.15" />
    </g>;
  }

  if (group === 'fighter') {
    // Plate armor with weapon
    return <g>
      <Glow />
      <Body />
      {/* Chest plate */}
      <path d={`M${bx - sw * 0.82} ${by + 5} Q${bx} ${by + 8} ${bx + sw * 0.82} ${by + 5} L${bx + sw * 0.7} ${by + th * 0.6} Q${bx} ${by + th * 0.65} ${bx - sw * 0.7} ${by + th * 0.6}Z`}
        fill={tier === 'legendary' ? '#B8860B' : tier === 'advanced' ? '#607d8b' : ocDark} opacity="0.88" />
      {/* Pauldrons */}
      <ellipse cx={bx - sw} cy={by + 4} rx={armW * 0.85} ry={armW * 0.55} fill={tier === 'legendary' ? '#B8860B' : ocDark} />
      <ellipse cx={bx + sw} cy={by + 4} rx={armW * 0.85} ry={armW * 0.55} fill={tier === 'legendary' ? '#B8860B' : ocDark} />
      {/* Weapon (sword/axe/katana) */}
      {archetype === 'viking' ? <>
        <rect x={bx + sw + armW + 2} y={by - 20} width={8} height={50} rx={2} fill="#8d6e63" />
        <path d={`M${bx + sw + armW} ${by - 22} L${bx + sw + armW + 18} ${by - 5} L${bx + sw + armW + 8} ${by - 18}`}
          fill="#9e9e9e" />
      </> : <>
        <rect x={bx + sw + armW + 3} y={by - 30} width={4} height={65} rx={2} fill={tier === 'legendary' ? '#B8860B' : '#9e9e9e'} />
        <rect x={bx + sw + armW} y={by + 5} width={10} height={4} rx={2} fill="#78909c" />
      </>}
      {/* Shield (knight/warrior) */}
      {(archetype === 'knight' || archetype === 'warrior') && (
        <path d={`M${bx - sw - armW - 2} ${by + 5} L${bx - sw - armW - 16} ${by + 8} L${bx - sw - armW - 18} ${by + 28} L${bx - sw - armW - 8} ${by + 40} L${bx - sw - armW - 2} ${by + 36}Z`}
          fill={tier === 'legendary' ? '#B8860B' : '#1565c0'} stroke="white" strokeWidth="1" />
      )}
      {tier === 'legendary' && <text x={bx} y={by - 38} textAnchor="middle" fontSize="16">👑</text>}
    </g>;
  }

  if (group === 'mage') {
    return <g>
      <Glow />
      <Body />
      {/* Robe overlay */}
      <path d={`M${bx - sw * 0.82} ${by + 4} L${bx - hw * 1.2} ${by + th + 20} L${bx + hw * 1.2} ${by + th + 20} L${bx + sw * 0.82} ${by + 4}Z`}
        fill={ocDark} opacity="0.7" />
      {/* Belt */}
      <rect x={bx - hw} y={by + th * 0.58} width={hw * 2} height={7} rx={3} fill={ocDark} />
      {/* Staff */}
      <rect x={bx + sw + armW + 2} y={by - 50} width={4} height={90} rx={2} fill="#8d6e63" />
      <circle cx={bx + sw + armW + 4} cy={by - 54} r={9}
        fill={tier === 'legendary' ? '#FDD835' : archetype === 'alchemist' ? '#66bb6a' : '#ce93d8'} />
      <circle cx={bx + sw + armW + 4} cy={by - 54} r={5} fill="white" opacity="0.5" />
      {/* Hat */}
      {archetype === 'wizard' && <>
        <path d={`M${bx - headR * 0.88} ${cx.y - headR * 0.5} L${bx} ${cx.y - headR * 2.2} L${bx + headR * 0.88} ${cx.y - headR * 0.5}Z`}
          fill={oc} />
        <ellipse cx={bx} cy={cx.y - headR * 0.5} rx={headR * 1.2} ry={headR * 0.35} fill={oc} />
        <circle cx={bx} cy={cx.y - headR * 2.15} r={4} fill="#FDD835" />
      </>}
      {tier === 'legendary' && <text x={bx} y={by - 55} textAnchor="middle" fontSize="14">✨</text>}
    </g>;
  }

  if (group === 'ranger') {
    return <g>
      <Glow />
      <Body />
      {/* Vest */}
      <path d={`M${bx - sw * 0.65} ${by + 4} L${bx - sw * 0.6} ${by + th * 0.7} L${bx - hw * 0.5} ${by + th * 0.7} L${bx - hw * 0.5} ${by + 4}Z`}
        fill={ocDark} opacity="0.8" />
      <path d={`M${bx + sw * 0.65} ${by + 4} L${bx + sw * 0.6} ${by + th * 0.7} L${bx + hw * 0.5} ${by + th * 0.7} L${bx + hw * 0.5} ${by + 4}Z`}
        fill={ocDark} opacity="0.8" />
      {/* Bow (archer) */}
      {archetype === 'archer' && <>
        <path d={`M${bx + sw + armW + 2} ${by - 28} Q${bx + sw + armW + 22} ${by + 10} ${bx + sw + armW + 2} ${by + 38}`}
          fill="none" stroke="#8d6e63" strokeWidth="4" />
        <line x1={bx + sw + armW + 2} y1={by - 28} x2={bx + sw + armW + 2} y2={by + 38}
          stroke="#9e9e9e" strokeWidth="1" />
        {/* Quiver */}
        <rect x={bx - sw - armW - 10} y={by - 10} width={8} height={30} rx={4} fill="#8d6e63" />
        {[-5, 0, 5].map(dx => (
          <line key={dx} x1={bx - sw - armW - 6 + dx} y1={by - 10}
            x2={bx - sw - armW - 6 + dx} y2={by - 18}
            stroke="#9e9e9e" strokeWidth="1.5" />
        ))}
      </>}
      {/* Compass / hat (explorer) */}
      {archetype === 'explorer' && <>
        <ellipse cx={bx} cy={cx.y - headR * 0.6} rx={headR * 1.25} ry={headR * 0.32} fill="#8d6e63" />
        <circle cx={bx + sw + armW + 6} cy={by + 20} r={8} fill="#9e9e9e" />
        <line x1={bx + sw + armW + 6} y1={by + 12} x2={bx + sw + armW + 6} y2={by + 28} stroke="#e53935" strokeWidth="1.5" />
        <line x1={bx + sw + armW - 2} y1={by + 20} x2={bx + sw + armW + 14} y2={by + 20} stroke="#e53935" strokeWidth="1.5" />
      </>}
    </g>;
  }

  if (group === 'monk_type') {
    return <g>
      <Glow />
      <Body />
      {archetype === 'bodybuilder' && <>
        {/* Tank top straps */}
        <rect x={bx - sw * 0.3} y={by} width={sw * 0.25} height={th} rx={4} fill={ocDark} />
        <rect x={bx + sw * 0.05} y={by} width={sw * 0.25} height={th} rx={4} fill={ocDark} />
        {/* Trophy */}
        <text x={bx + sw + armW + 6} y={by + 20} fontSize="20">🏆</text>
      </>}
      {archetype === 'monk' && <>
        {/* Simple robe */}
        <path d={`M${bx - sw * 0.75} ${by + 4} L${bx - hw * 1.1} ${by + th + 15} L${bx + hw * 1.1} ${by + th + 15} L${bx + sw * 0.75} ${by + 4}Z`}
          fill={ocDark} opacity="0.65" />
        {/* Beads */}
        <path d={`M${bx - 12} ${by + 12} Q${bx} ${by + 35} ${bx + 12} ${by + 12}`}
          fill="none" stroke="#fdd835" strokeWidth="3" strokeDasharray="4 3" />
      </>}
      {tier === 'legendary' && archetype === 'bodybuilder' &&
        <text x={bx} y={by - 42} textAnchor="middle" fontSize="14">💎</text>}
    </g>;
  }

  if (group === 'stealth') {
    return <g>
      <Glow />
      <Body />
      {/* Dark bodysuit */}
      <path d={`M${bx - sw * 0.85} ${by + 3} Q${bx} ${by + 6} ${bx + sw * 0.85} ${by + 3} L${bx + hw} ${by + th} L${bx - hw} ${by + th}Z`}
        fill="rgba(0,0,0,0.35)" />
      {/* Ninja mask / Pirate accessories */}
      {archetype === 'ninja' && <>
        <rect x={bx - headR * 0.9} y={cx.y - headR * 0.22} width={headR * 1.8} height={headR * 0.4}
          rx={headR * 0.2} fill={oc} />
        {/* Katana */}
        <rect x={bx + sw + armW + 2} y={by - 35} width={3} height={70} rx={1.5} fill="#9e9e9e" />
        <rect x={bx + sw + armW - 2} y={by + 12} width={11} height={5} rx={2} fill="#8d6e63" />
      </>}
      {archetype === 'pirate' && <>
        {/* Hat */}
        <path d={`M${bx - headR * 1.0} ${cx.y - headR * 0.62} L${bx} ${cx.y - headR * 2.0} L${bx + headR * 1.0} ${cx.y - headR * 0.62}Z`}
          fill="#212121" />
        <ellipse cx={bx} cy={cx.y - headR * 0.62} rx={headR * 1.15} ry={headR * 0.28} fill="#212121" />
        <text x={bx} y={cx.y - headR * 1.1} textAnchor="middle" fontSize="9" fill="white">☠</text>
        {/* Sword */}
        <rect x={bx + sw + armW + 2} y={by - 25} width={4} height={58} rx={2} fill="#9e9e9e" />
      </>}
    </g>;
  }

  if (group === 'creative') {
    return <g>
      <Glow />
      <Body />
      {archetype === 'chef' && <>
        {/* Chef hat */}
        <rect x={bx - headR * 0.6} y={cx.y - headR * 1.0} width={headR * 1.2} height={headR * 0.5} rx={4} fill="white" />
        <ellipse cx={bx} cy={cx.y - headR * 0.98} rx={headR * 0.72} ry={headR * 0.38} fill="white" />
        {/* Apron */}
        <rect x={bx - sw * 0.55} y={by + 8} width={sw * 1.1} height={th * 0.75} rx={4} fill="white" opacity="0.85" />
        {/* Ladle */}
        <line x1={bx + sw + armW + 4} y1={by - 10} x2={bx + sw + armW + 4} y2={by + 40} stroke="#9e9e9e" strokeWidth="3" />
        <circle cx={bx + sw + armW + 4} cy={by - 16} r={7} fill="none" stroke="#9e9e9e" strokeWidth="3" />
      </>}
      {archetype === 'scientist' && <>
        {/* Lab coat */}
        <path d={`M${bx - sw * 0.82} ${by + 4} L${bx - hw * 1.1} ${by + th + 18} L${bx + hw * 1.1} ${by + th + 18} L${bx + sw * 0.82} ${by + 4}Z`}
          fill="white" opacity="0.82" />
        {/* Goggles */}
        <circle cx={bx - headR * 0.3} cy={cx.y - headR * 0.06} r={headR * 0.24}
          fill="none" stroke="#1565c0" strokeWidth="3" />
        <circle cx={bx + headR * 0.3} cy={cx.y - headR * 0.06} r={headR * 0.24}
          fill="none" stroke="#1565c0" strokeWidth="3" />
        {/* Clipboard */}
        <rect x={bx - sw - armW - 14} y={by + 5} width={14} height={18} rx={2} fill="white" stroke="#9e9e9e" strokeWidth="1" />
      </>}
      {archetype === 'artist' && <>
        {/* Smock */}
        <path d={`M${bx - sw * 0.82} ${by + 4} L${bx - hw * 1.1} ${by + th + 15} L${bx + hw * 1.1} ${by + th + 15} L${bx + sw * 0.82} ${by + 4}Z`}
          fill={oc} opacity="0.65" />
        {/* Paint splatters */}
        {['#e53935', '#FDD835', '#43a047', '#1e88e5'].map((col, i) => (
          <circle key={i} cx={bx - sw * 0.3 + i * 10} cy={by + th * 0.4} r={3.5} fill={col} opacity="0.8" />
        ))}
        {/* Palette */}
        <ellipse cx={bx + sw + armW + 7} cy={by + 22} rx={11} ry={8} fill="#efebe9" />
      </>}
      {archetype === 'rockstar' && <>
        {/* Jacket */}
        <path d={`M${bx - sw * 0.85} ${by + 3} Q${bx} ${by + 6} ${bx + sw * 0.85} ${by + 3} L${bx + hw} ${by + th} L${bx - hw} ${by + th}Z`}
          fill={ocDark} opacity="0.8" />
        {/* Guitar */}
        <ellipse cx={bx + sw + armW + 8} cy={by + 28} rx={10} ry={13} fill="#8d6e63" />
        <rect x={bx + sw + armW + 5} y={by - 22} width={6} height={50} rx={3} fill="#6d4c41" />
        {[-3, 0, 3].map(dy => (
          <line key={dy} x1={bx + sw + armW + 4} y1={by + dy} x2={bx + sw + armW + 16} y2={by + dy}
            stroke="#9e9e9e" strokeWidth="0.8" />
        ))}
      </>}
    </g>;
  }

  if (group === 'athlete') {
    return <g>
      <Glow />
      <Body />
      {/* Athletic wear stripes */}
      <rect x={bx - sw * 0.12} y={by + 2} width={sw * 0.24} height={th} rx={3} fill={ocDark} opacity="0.75" />
      {archetype === 'dancer' && <>
        {/* Ribbon */}
        <path d={`M${bx + sw + 2} ${by + 5} Q${bx + sw + 22} ${by + 20} ${bx + sw + 18} ${by + 40} Q${bx + sw + 8} ${by + 52} ${bx + sw + 24} ${by + 60}`}
          fill="none" stroke={oc} strokeWidth="3" strokeLinecap="round" />
      </>}
      {archetype === 'rockstar' && (
        <text x={bx} y={by - 40} textAnchor="middle" fontSize="18">🎸</text>
      )}
      {tier === 'legendary' && <text x={bx} y={by - 42} textAnchor="middle" fontSize="14">⚡</text>}
    </g>;
  }

  if (group === 'hero') {
    return <g>
      <Glow />
      <Body />
      {archetype === 'astronaut' && <>
        {/* Space suit */}
        <path d={`M${bx - sw * 0.88} ${by + 2} Q${bx} ${by + 8} ${bx + sw * 0.88} ${by + 2} L${bx + hw * 1.1} ${by + th + 10} L${bx - hw * 1.1} ${by + th + 10}Z`}
          fill="white" opacity="0.88" />
        {/* Helmet */}
        <circle cx={bx} cy={cx.y - headR * 0.1} r={headR * 1.22} fill="none"
          stroke="white" strokeWidth="5" opacity="0.8" />
        {/* Visor */}
        <path d={`M${bx - headR * 0.75} ${cx.y - headR * 0.4} Q${bx} ${cx.y - headR * 0.7} ${bx + headR * 0.75} ${cx.y - headR * 0.4} Q${bx + headR * 0.7} ${cx.y + headR * 0.2} ${bx} ${cx.y + headR * 0.3} Q${bx - headR * 0.7} ${cx.y + headR * 0.2} ${bx - headR * 0.75} ${cx.y - headR * 0.4}Z`}
          fill="#1e88e5" opacity="0.55" />
      </>}
      {archetype === 'superhero' && <>
        {/* Cape */}
        <path d={`M${bx - sw * 0.88} ${by + 2} Q${bx - sw * 1.3} ${by + th * 0.5} ${bx - sw * 0.8} ${by + th + legH + 10}`}
          fill={oc} opacity="0.75" />
        {/* Chest logo */}
        <circle cx={bx} cy={by + th * 0.38} r={8}
          fill={tier === 'legendary' ? '#FDD835' : 'white'} opacity="0.85" />
        <text x={bx} y={by - 42} textAnchor="middle" fontSize="16">⚡</text>
      </>}
      {tier === 'legendary' && <text x={bx} y={cx.y - headR * 2.1} textAnchor="middle" fontSize="14">✨</text>}
    </g>;
  }

  // Fallback: plain colored body
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
  const artId = useId().replace(/:/g, '');
  const ids = {
    softShadow: `character-soft-shadow-${artId}`,
    skinGrad: `skin-face-grad-${artId}`,
    outfitSheen: `outfit-sheen-${artId}`,
  };
  const skinData = SKIN_TONES.find(s => s.id === skinTone) || SKIN_TONES[1];
  const bt = BODY_TYPES.find(b => b.id === bodyType) || BODY_TYPES[1];
  const headR = 28 * bt.hs;
  const charCX = { x: 100, y: 105, skin: skinData.color };
  const hc = getHairColor(hairColor);
  const isLowHealth = level === 1;

  return (
    <svg className="companion-art companion-character-art" viewBox="0 0 200 280" width={width} height={height} xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
      <defs>
        <filter id={ids.softShadow} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="6" stdDeviation="4.5" floodColor="#000000" floodOpacity="0.28" />
        </filter>
        <radialGradient id={ids.skinGrad} cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="46%" stopColor={skinData.color} />
          <stop offset="100%" stopColor={skinData.shadow} />
        </radialGradient>
        <linearGradient id={ids.outfitSheen} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="45%" stopColor={outfitColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <CharBackground bgId={background} />

      <g filter={`url(#${ids.softShadow})`} transform={isLowHealth ? 'rotate(-4, 100, 160)' : ''}>
        {/* Shadow */}
        <ellipse cx="100" cy="222" rx="32" ry="8" fill="rgba(0,0,0,0.18)" />

        {/* Costume (draws body + arms + legs + outfit) */}
        <Costume
          archetype={archetype} level={level} outfitColor={outfitColor}
          cx={charCX} bt={bt} headR={headR}
        />

        {/* Neck */}
        <rect x={charCX.x - 7 * bt.sw * 0.5} y={charCX.y + headR * 0.75}
          width={14 * bt.sw * 0.5} height={14} rx={5} fill={skinData.color} />

        {/* Head */}
        <ellipse cx={charCX.x} cy={charCX.y} rx={headR} ry={headR * 1.05} fill={`url(#${ids.skinGrad})`} />
        <ellipse cx={charCX.x - headR * 0.26} cy={charCX.y - headR * 0.34} rx={headR * 0.42} ry={headR * 0.25}
          fill="white" opacity="0.18" />
        {/* Ear left */}
        <ellipse cx={charCX.x - headR * 0.95} cy={charCX.y} rx={headR * 0.15} ry={headR * 0.22} fill={skinData.color} />
        {/* Ear right */}
        <ellipse cx={charCX.x + headR * 0.95} cy={charCX.y} rx={headR * 0.15} ry={headR * 0.22} fill={skinData.color} />
        {/* Jaw shadow */}
        <ellipse cx={charCX.x} cy={charCX.y + headR * 0.6} rx={headR * 0.7} ry={headR * 0.22}
          fill={skinData.shadow} opacity="0.28" />

        {/* Beard (behind hair) */}
        {beard && <Beard cx={charCX} headR={headR} skinData={skinData} color={hc} />}

        {/* Hair */}
        <Hair style={hairStyle} color={hc} cx={charCX} headR={headR} gender={gender} />

        {/* Face features */}
        <Eyes cx={charCX} headR={headR} eyeColorId={eyeColor} />
        <path d={`M${charCX.x - headR * 0.58} ${charCX.y - headR * 0.27} Q${charCX.x - headR * 0.36} ${charCX.y - headR * 0.36} ${charCX.x - headR * 0.16} ${charCX.y - headR * 0.28}`}
          stroke="rgba(0,0,0,0.32)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d={`M${charCX.x + headR * 0.16} ${charCX.y - headR * 0.28} Q${charCX.x + headR * 0.36} ${charCX.y - headR * 0.36} ${charCX.x + headR * 0.58} ${charCX.y - headR * 0.27}`}
          stroke="rgba(0,0,0,0.32)" strokeWidth="1.6" strokeLinecap="round" fill="none" />

        {/* Mouth */}
        <path d={`M${charCX.x - headR * 0.25} ${charCX.y + headR * 0.38} Q${charCX.x} ${charCX.y + headR * 0.52} ${charCX.x + headR * 0.25} ${charCX.y + headR * 0.38}`}
          fill="none" stroke={skinData.lip} strokeWidth="2.2" strokeLinecap="round" />

        {/* Nose */}
        <path d={`M${charCX.x + headR * 0.04} ${charCX.y - headR * 0.02} Q${charCX.x + headR * 0.13} ${charCX.y + headR * 0.13} ${charCX.x + headR * 0.02} ${charCX.y + headR * 0.24}`}
          fill="none" stroke={skinData.shadow} strokeWidth="1.7" strokeLinecap="round" opacity="0.48" />
        <ellipse cx={charCX.x - headR * 0.04} cy={charCX.y + headR * 0.2} rx={headR * 0.09} ry={headR * 0.045}
          fill={skinData.shadow} opacity="0.36" />

        {/* Freckles */}
        {freckles && <Freckles cx={charCX} headR={headR} skinData={skinData} />}

        {/* Glasses */}
        {glasses && <Glasses cx={charCX} headR={headR} />}
      </g>

      {/* Level badge */}
      <g filter={`url(#${ids.softShadow})`}>
        <circle cx="174" cy="26" r="16" fill="rgba(0,0,0,0.55)" />
        <text x="174" y="22" textAnchor="middle" fontSize="8" fill="#b0b0b0">LVL</text>
        <text x="174" y="33" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">{level}</text>
      </g>
    </svg>
  );
}
