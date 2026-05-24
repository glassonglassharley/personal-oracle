import { TREE_SPECIES, POT_STYLES, BACKGROUNDS } from './companionData';

const GROWTH_SCALE = [0, 0.28, 0.48, 0.68, 0.85, 1.0];

function Background({ bgId }) {
  const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
  const isNight = bgId === 'night_stars' || bgId === 'space' || bgId === 'mystical_forest';
  const isSnowy = bgId === 'snowy';

  const stars = isNight ? Array.from({ length: 22 }, (_, i) => ({
    cx: (i * 37 + 11) % 196 + 2,
    cy: (i * 23 + 7) % 120 + 5,
    r: i % 4 === 0 ? 1.5 : 1,
    op: 0.5 + (i % 5) * 0.1,
  })) : [];

  return (
    <g>
      <defs>
        <linearGradient id="tree-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.sky1} />
          <stop offset="100%" stopColor={bg.sky2} />
        </linearGradient>
      </defs>
      <rect width="200" height="215" fill="url(#tree-sky)" />
      <rect x="0" y="215" width="200" height="65" fill={bg.ground} />

      {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />)}

      {bgId === 'day' && <>
        <ellipse cx="38" cy="48" rx="24" ry="14" fill="white" opacity="0.75" />
        <ellipse cx="56" cy="43" rx="18" ry="12" fill="white" opacity="0.75" />
        <ellipse cx="158" cy="58" rx="20" ry="12" fill="white" opacity="0.65" />
        <circle cx="168" cy="36" r="16" fill="#FDD835" opacity="0.9" />
      </>}

      {bgId === 'sunset' && <>
        <circle cx="100" cy="190" r="38" fill="#FF7043" opacity="0.6" />
        <rect x="0" y="180" width="200" height="35" fill="rgba(255,112,13,0.18)" />
      </>}

      {bgId === 'rainy' && Array.from({ length: 18 }, (_, i) => (
        <line key={i} x1={(i * 11 + 3) % 200} y1={(i * 17) % 200}
          x2={((i * 11 + 3) % 200) - 3} y2={((i * 17) % 200) + 14}
          stroke="#90A4AE" strokeWidth="1" opacity="0.5" />
      ))}

      {isSnowy && <>
        <ellipse cx="100" cy="220" rx="85" ry="12" fill="white" opacity="0.5" />
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} cx={(i * 15 + 4) % 200} cy={(i * 13 + 8) % 180}
            r={i % 3 === 0 ? 2.5 : 1.5} fill="white" opacity="0.85" />
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
        <polygon points="90,155 100,145 110,155" fill="white" opacity="0.8" />
      </>}

      {bgId === 'space' && <>
        <circle cx="50" cy="50" r="18" fill="#5c6bc0" opacity="0.55" />
        <ellipse cx="50" cy="50" rx="28" ry="7" fill="none" stroke="#90caf9" strokeWidth="2" opacity="0.4" />
        <circle cx="168" cy="28" r="7" fill="#ef5350" opacity="0.5" />
        <circle cx="140" cy="80" r="4" fill="#ffd740" opacity="0.6" />
      </>}
    </g>
  );
}

function Pot({ style = 'terracotta', x = 100, y = 225 }) {
  const p = POT_STYLES.find(ps => ps.id === style) || POT_STYLES[0];

  if (style === 'floating') {
    return <ellipse cx={x} cy={y + 6} rx="26" ry="10" fill="#4a3728" />;
  }

  if (style === 'wooden_barrel') {
    return <g>
      <rect x={x - 22} y={y} width="44" height="36" rx="4" fill={p.color} />
      {[5, 16, 27].map(dy => (
        <rect key={dy} x={x - 22} y={y + dy} width="44" height="3" rx="1" fill={p.dark} />
      ))}
      <rect x={x - 24} y={y - 3} width="48" height="7" rx="3" fill={p.rim} />
      <ellipse cx={x} cy={y} rx="22" ry="5" fill="#5d4037" />
    </g>;
  }

  return <g>
    <path d={`M${x - 19} ${y + 37} L${x - 23} ${y + 2} L${x + 23} ${y + 2} L${x + 19} ${y + 37}Z`} fill={p.color} />
    <rect x={x - 25} y={y - 3} width="50" height="8" rx="3" fill={p.rim} />
    <ellipse cx={x} cy={y} rx="21" ry="5" fill="#4a3728" />
  </g>;
}

function Snow({ x, y, r }) {
  return <ellipse cx={x} cy={y - r * 0.65} rx={r * 0.55} ry={r * 0.14} fill="white" opacity="0.82" />;
}

function Flowers({ positions }) {
  return <g>{positions.map(([fx, fy], i) => (
    <circle key={i} cx={fx} cy={fy} r={4.5} fill="#FFB7C5" opacity="0.95" />
  ))}</g>;
}

function Decoration({ type, x, y, trunkH, canopyR }) {
  if (!type || type === 'none') return null;
  const branchX = x + canopyR * 0.45;
  const branchY = y - trunkH * 0.65;

  if (type === 'fairy_lights') {
    const lights = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BFF', '#FF9F43', '#48DBFB', '#FF9FF3'];
    return <g>{Array.from({ length: 10 }, (_, i) => {
      const ang = (i / 10) * Math.PI * 2;
      const r = canopyR * 0.78;
      return <circle key={i} cx={x + Math.cos(ang) * r * 0.85} cy={(y - trunkH * 0.55) + Math.sin(ang) * r * 0.45}
        r={3} fill={lights[i % lights.length]} opacity="0.95" />;
    })}</g>;
  }

  if (type === 'tire_swing') return <g>
    <line x1={branchX} y1={branchY} x2={branchX} y2={branchY + 32} stroke="#5d4037" strokeWidth="2" />
    <ellipse cx={branchX} cy={branchY + 38} rx="11" ry="7" fill="none" stroke="#212121" strokeWidth="5.5" />
  </g>;

  if (type === 'treehouse') return <g>
    <rect x={x + canopyR * 0.22 - 16} y={branchY - 22} width="32" height="20" fill="#8d6e63" rx="2" />
    <polygon points={`${x + canopyR * 0.22 - 18},${branchY - 22} ${x + canopyR * 0.22},${branchY - 36} ${x + canopyR * 0.22 + 18},${branchY - 22}`} fill="#795548" />
    <rect x={x + canopyR * 0.22 - 5} y={branchY - 12} width="10" height="10" fill="#FFE082" />
  </g>;

  if (type === 'birds_nest') return <g>
    <path d={`M${x - 18} ${y - trunkH * 0.88} Q${x} ${y - trunkH * 0.93} ${x + 18} ${y - trunkH * 0.88}`}
      fill="none" stroke="#8d6e63" strokeWidth="4.5" strokeLinecap="round" />
    {[-6, 4].map((dx, i) => <circle key={i} cx={x + dx} cy={y - trunkH * 0.87} r={4} fill="#b0bec5" />)}
  </g>;

  if (type === 'hammock') return <g>
    <line x1={x - 38} y1={y - trunkH * 0.62} x2={x - 38} y2={y - trunkH * 0.75} stroke="#5d4037" strokeWidth="2" />
    <line x1={x + 38} y1={y - trunkH * 0.62} x2={x + 38} y2={y - trunkH * 0.75} stroke="#5d4037" strokeWidth="2" />
    <path d={`M${x - 38} ${y - trunkH * 0.62} Q${x} ${y - trunkH * 0.48} ${x + 38} ${y - trunkH * 0.62}`}
      fill="none" stroke="#F57F17" strokeWidth="6" strokeLinecap="round" />
  </g>;

  return null;
}

// ── Shape renderers ──

function RoundTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 78 * s, tW = Math.max(4, 11 * s), cR = 55 * s;
  const cY = y - tH - cR * 0.65;
  const isRainbow = sp.id === 'rainbow_eucalyptus';

  return <g>
    {isRainbow && <defs>
      <linearGradient id="rainbow-trunk" x1="0" y1="0" x2="1" y2="0">
        {['#e53935', '#f9a825', '#43a047', '#1e88e5', '#8e24aa'].map((c, i) => (
          <stop key={i} offset={`${i * 25}%`} stopColor={c} />
        ))}
      </linearGradient>
    </defs>}
    <rect x={x - tW / 2} y={y - tH} width={tW} height={tH} rx={tW / 2.5}
      fill={isRainbow ? 'url(#rainbow-trunk)' : sp.trunkColor} />
    {s > 0.45 && <>
      <circle cx={x - cR * 0.52} cy={cY + cR * 0.22} r={cR * 0.72} fill={sp.leafDark} opacity="0.88" />
      <circle cx={x + cR * 0.52} cy={cY + cR * 0.22} r={cR * 0.72} fill={sp.leafDark} opacity="0.88" />
    </>}
    <circle cx={x} cy={cY} r={cR} fill={sp.leafColor} />
    <circle cx={x - cR * 0.28} cy={cY - cR * 0.28} r={cR * 0.38} fill={sp.leafColor} opacity="0.45" />
    {/* Fruit for apple/lemon/mango/olive/avocado */}
    {s > 0.65 && ['apple','lemon','mango','olive','avocado'].includes(sp.id) && [
      [-0.5, 0.3], [0.4, 0.2], [0, 0.5], [-0.3, -0.2], [0.5, -0.1]
    ].map(([dx, dy], i) => (
      <circle key={i} cx={x + dx * cR * 0.75} cy={cY + dy * cR * 0.75} r={4}
        fill={sp.id === 'lemon' ? '#FDD835' : sp.id === 'olive' ? '#558b2f' : '#e53935'} opacity="0.9" />
    ))}
    {hasFlowers && s > 0.27 && <Flowers positions={[
      [x - cR * 0.7, cY], [x + cR * 0.7, cY], [x, cY - cR * 0.72],
      [x + cR * 0.48, cY - cR * 0.52], [x - cR * 0.48, cY - cR * 0.52]
    ]} />}
    {isDecember && <Snow x={x} y={cY} r={cR} />}
  </g>;
}

function UprightTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 65 * s, tW = Math.max(4, 8 * s);
  const H = 115 * s, W = 68 * s;
  const baseY = y - tH;
  const layers = Math.min(5, Math.max(2, Math.round(s * 5)));

  return <g>
    <rect x={x - tW / 2} y={y - tH} width={tW} height={tH} rx={tW / 2.5} fill={sp.trunkColor} />
    {Array.from({ length: layers }, (_, i) => {
      const f = (layers - i) / layers;
      const lw = W * f * 0.9;
      const lh = H / (layers * 0.7);
      const by = baseY - i * lh * 0.68;
      const tip = by - lh;
      return <g key={i}>
        <polygon points={`${x},${tip} ${x - lw / 2},${by} ${x + lw / 2},${by}`} fill={sp.leafColor} />
        {isDecember && i === layers - 1 && (
          <polygon points={`${x},${tip - 3} ${x - lw * 0.18},${tip + 8} ${x + lw * 0.18},${tip + 8}`}
            fill="white" opacity="0.65" />
        )}
      </g>;
    })}
    {isDecember && <text x={x} y={baseY - H - 5} textAnchor="middle" fontSize="10" fill="#FDD835">★</text>}
    {hasFlowers && <circle cx={x} cy={baseY - H + 10} r={5} fill="#FFB7C5" />}
  </g>;
}

function DroopingTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 80 * s, tW = Math.max(4, 8 * s);
  const bLen = 52 * s;
  const tipY = y - tH;
  const num = s > 0.65 ? 5 : s > 0.45 ? 4 : 3;
  const angles = [-68, -38, -8, 22, 52].slice(0, num);

  return <g>
    <path d={`M${x} ${y} Q${x + 6 * s} ${y - tH * 0.5} ${x} ${y - tH}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={tW} strokeLinecap="round" />
    {angles.map((ang, i) => {
      const rad = ang * Math.PI / 180;
      const bx = x + Math.cos(rad) * bLen * 0.6;
      const by = (y - tH * (0.4 + i * 0.08)) + Math.sin(rad) * bLen * 0.2;
      const ex = bx + Math.cos(rad) * bLen * 0.5;
      const ey = by + bLen * 0.48;
      return <g key={i}>
        <path d={`M${x} ${by} Q${bx} ${by - 8 * s} ${ex} ${ey}`}
          fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(1.5, tW * 0.42)} strokeLinecap="round" />
        {[0.3, 0.65, 1.0].map((t, j) => {
          const lx = x + (ex - x) * t, ly = by + (ey - by) * t * t;
          return <ellipse key={j} cx={lx} cy={ly} rx={6 * s} ry={3 * s}
            fill={sp.leafColor} opacity="0.92" transform={`rotate(-30,${lx},${ly})`} />;
        })}
        {hasFlowers && <circle cx={ex} cy={ey} r={3.5} fill="#FFB7C5" />}
      </g>;
    })}
    {isDecember && <ellipse cx={x} cy={tipY} rx={10 * s} ry={4 * s} fill="white" opacity="0.7" />}
  </g>;
}

function PalmTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 98 * s, lLen = 50 * s;
  const tipX = x + 6 * s, tipY = y - tH;
  const num = s > 0.65 ? 7 : s > 0.45 ? 6 : 5;

  return <g>
    <path d={`M${x} ${y} Q${x + 14 * s} ${y - tH * 0.5} ${tipX} ${tipY}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(6, 14 * s)} strokeLinecap="round" />
    {/* Trunk segments */}
    {Array.from({ length: Math.floor(tH / 18) }, (_, i) => (
      <ellipse key={i} cx={tipX + (x - tipX) * (i / (tH / 18))}
        cy={tipY + (y - tipY) * (i / (tH / 18))} rx={1} ry={Math.max(5, 10 * s) / 2}
        fill="rgba(0,0,0,0.12)" />
    ))}
    {Array.from({ length: num }, (_, i) => {
      const ang = (i / num) * 360;
      const rad = (ang - 90) * Math.PI / 180;
      const ex = tipX + Math.cos(rad) * lLen;
      const ey = tipY + Math.sin(rad) * lLen * 0.55 + lLen * 0.28;
      return <path key={i}
        d={`M${tipX} ${tipY} Q${(tipX + ex) / 2} ${tipY - 14 * s} ${ex} ${ey}`}
        fill="none" stroke={sp.leafColor} strokeWidth={Math.max(2.5, 5 * s)} strokeLinecap="round" />;
    })}
    {sp.id === 'banana' && s > 0.55 && <ellipse cx={tipX} cy={tipY + 10} rx={12} ry={6} fill="#F9A825" />}
    {sp.id === 'palm' && s > 0.55 && <>
      <circle cx={tipX - 8} cy={tipY + 10} r={5} fill="#795548" />
      <circle cx={tipX + 5} cy={tipY + 12} r={5} fill="#795548" />
    </>}
    {isDecember && <circle cx={tipX} cy={tipY} r={9 * s} fill="white" opacity="0.4" />}
  </g>;
}

function BonsaiTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 50 * s, tW = Math.max(7, 15 * s);
  const tipY = y - tH;

  return <g>
    <path d={`M${x - 2} ${y} Q${x - 10 * s} ${y - tH * 0.4} ${x - 5 * s} ${tipY}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={tW} strokeLinecap="round" />
    <path d={`M${x - 5 * s} ${tipY} Q${x + 22 * s} ${tipY - 8 * s} ${x + 36 * s} ${tipY + 4 * s}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(3, tW * 0.5)} strokeLinecap="round" />
    {s > 0.45 && <path d={`M${x - 5 * s} ${tipY + 10 * s} Q${x - 22 * s} ${tipY + 2 * s} ${x - 30 * s} ${tipY + 10 * s}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(2.5, tW * 0.42)} strokeLinecap="round" />}
    {[
      [x + 32 * s, tipY - 4 * s, 17 * s],
      [x + 12 * s, tipY - 16 * s, 15 * s],
      [x - 5 * s, tipY - 21 * s, 14 * s],
      s > 0.45 ? [x - 28 * s, tipY - 4 * s, 15 * s] : null,
      s > 0.65 ? [x + 22 * s, tipY + 4 * s, 11 * s] : null,
    ].filter(Boolean).map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill={sp.leafColor} opacity="0.92" />
    ))}
    {hasFlowers && <circle cx={x - 5 * s} cy={tipY - 27 * s} r={4.5} fill="#FFB7C5" />}
    {isDecember && [
      [x + 32 * s, tipY - 18 * s, 11 * s],
      [x - 5 * s, tipY - 34 * s, 10 * s],
    ].map(([cx, cy, r], i) => <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.3} fill="white" opacity="0.65" />)}
  </g>;
}

function CactusTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 80 * s, tW = Math.max(8, 18 * s);
  const aH = 40 * s, aW = Math.max(5, 12 * s);

  return <g>
    <rect x={x - tW / 2} y={y - tH} width={tW} height={tH} rx={tW / 2} fill={sp.leafColor} />
    {/* Ridges */}
    {[-1, 0, 1].map(d => (
      <line key={d} x1={x + d * tW * 0.25} y1={y} x2={x + d * tW * 0.25} y2={y - tH}
        stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
    ))}
    {s > 0.45 && <>
      {/* Left arm */}
      <path d={`M${x - tW / 2} ${y - tH * 0.6} Q${x - tW / 2 - aW * 1.2} ${y - tH * 0.62} ${x - tW / 2 - aW} ${y - tH * 0.62 - aH * 0.55}`}
        fill="none" stroke={sp.leafColor} strokeWidth={aW} strokeLinecap="round" />
      {/* Right arm */}
      <path d={`M${x + tW / 2} ${y - tH * 0.5} Q${x + tW / 2 + aW * 1.2} ${y - tH * 0.52} ${x + tW / 2 + aW} ${y - tH * 0.52 - aH * 0.5}`}
        fill="none" stroke={sp.leafColor} strokeWidth={aW} strokeLinecap="round" />
      {/* Spines */}
      {[-1, 0, 1].map(d => (
        <line key={d} x1={x + d * tW * 0.2} y1={y - tH * 0.35}
          x2={x + d * tW * 0.45} y2={y - tH * 0.35 - 7}
          stroke="#F5F5F5" strokeWidth="1.2" />
      ))}
    </>}
    {(hasFlowers || s > 0.65) && <circle cx={x} cy={y - tH - 5} r={8} fill="#FF5252" />}
    {isDecember && <ellipse cx={x} cy={y - tH - 6} rx={tW * 0.58} ry={4} fill="white" opacity="0.75" />}
  </g>;
}

function BambooTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const num = s > 0.65 ? 3 : 2;
  const H = 98 * s, tW = Math.max(4, 8 * s);
  const xs = num === 3 ? [-14 * s, 0, 14 * s] : [-9 * s, 9 * s];
  const hs = num === 3 ? [H, H * 0.83, H * 0.68] : [H, H * 0.83];

  return <g>
    {xs.map((dx, i) => {
      const h = hs[i];
      const segs = Math.max(2, Math.floor(h / 15));
      return <g key={i}>
        <rect x={x + dx - tW / 2} y={y - h} width={tW} height={h} rx={tW / 2} fill={sp.leafColor} />
        {Array.from({ length: segs }, (_, j) => (
          <rect key={j} x={x + dx - tW / 2} y={y - h + j * (h / segs)} width={tW} height={2.5}
            rx="1" fill="rgba(0,0,0,0.18)" />
        ))}
        <ellipse cx={x + dx - 14 * s} cy={y - h + 6 * s} rx={11 * s} ry={4 * s}
          fill={sp.leafColor} transform={`rotate(-28,${x + dx - 14 * s},${y - h + 6 * s})`} />
        <ellipse cx={x + dx + 12 * s} cy={y - h + 2 * s} rx={11 * s} ry={4 * s}
          fill={sp.leafColor} transform={`rotate(22,${x + dx + 12 * s},${y - h + 2 * s})`} />
        {isDecember && <ellipse cx={x + dx} cy={y - h - 2} rx={tW * 0.9} ry={2.5} fill="white" opacity="0.75" />}
      </g>;
    })}
  </g>;
}

function BaobabTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 68 * s, tW = Math.max(14, 30 * s);
  const cY = y - tH;

  return <g>
    <path d={`M${x - tW / 2} ${y} Q${x - tW * 0.58} ${y - tH * 0.5} ${x - tW * 0.28} ${y - tH} L${x + tW * 0.28} ${y - tH} Q${x + tW * 0.58} ${y - tH * 0.5} ${x + tW / 2} ${y}Z`}
      fill={sp.trunkColor} />
    {/* Texture */}
    {s > 0.45 && <>
      <path d={`M${x - 5} ${y} Q${x - 3} ${y - tH * 0.5} ${x - 2} ${y - tH}`}
        fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
      <path d={`M${x + 8} ${y} Q${x + 5} ${y - tH * 0.5} ${x + 4} ${y - tH}`}
        fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" />
    </>}
    {/* Branches */}
    {s > 0.45 && [
      [x - 30 * s, cY - 14 * s, Math.max(3, 6 * s)],
      [x + 28 * s, cY - 12 * s, Math.max(2.5, 5 * s)],
      [x + 5 * s, cY - 20 * s, Math.max(2, 4 * s)],
    ].map(([ex, ey, sw], i) => (
      <path key={i} d={`M${x} ${cY} L${ex} ${ey}`}
        fill="none" stroke={sp.trunkColor} strokeWidth={sw} strokeLinecap="round" />
    ))}
    {[
      [x - 30 * s, cY - 26 * s, 20 * s],
      [x + 28 * s, cY - 23 * s, 20 * s],
      [x + 5 * s, cY - 31 * s, 20 * s],
      s > 0.65 ? [x - 10 * s, cY - 40 * s, 15 * s] : null,
    ].filter(Boolean).map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill={sp.leafColor} opacity="0.92" />
    ))}
    {hasFlowers && <circle cx={x} cy={cY - 42 * s} r={5} fill="#FFB7C5" />}
    {isDecember && <ellipse cx={x} cy={cY - 44 * s} rx={16 * s} ry={5 * s} fill="white" opacity="0.65" />}
  </g>;
}

function FanTree({ sp, s, x, y, hasFlowers, isDecember }) {
  const tH = 58 * s, tW = Math.max(4, 8 * s);
  const fW = 116 * s, fH = 58 * s;
  const tipY = y - tH;
  const isDragon = sp.id === 'dragon_blood';
  const isCherry = sp.id === 'cherry_blossom';
  const num = s > 0.65 ? 7 : s > 0.45 ? 5 : 3;

  return <g>
    <rect x={x - tW / 2} y={y - tH} width={tW} height={tH} rx={tW / 3} fill={sp.trunkColor} />
    {Array.from({ length: num }, (_, i) => {
      const t = num > 1 ? i / (num - 1) : 0.5;
      const ang = (-58 + t * 116) * Math.PI / 180;
      const bx = x + Math.cos(ang - Math.PI / 2) * fW * 0.52;
      const by = tipY + Math.sin(ang - Math.PI / 2) * fH * 0.48;
      return <path key={i} d={`M${x} ${tipY} Q${(x + bx) / 2} ${tipY - 18 * s} ${bx} ${by}`}
        fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(2, tW * 0.48)} strokeLinecap="round" />;
    })}
    <ellipse cx={x} cy={tipY - fH * 0.32} rx={fW * 0.52} ry={fH * 0.42} fill={sp.leafColor} opacity="0.92" />
    {s > 0.65 && <ellipse cx={x} cy={tipY - fH * 0.18} rx={fW * 0.42} ry={fH * 0.3} fill={sp.leafColor} opacity="0.72" />}
    {(isCherry || hasFlowers) && [
      [-0.42, -0.8], [0.42, -0.8], [0, -0.5], [-0.62, -0.38], [0.62, -0.38]
    ].map(([dx, dy], i) => (
      <circle key={i} cx={x + dx * fW * 0.42} cy={tipY + dy * fH * 0.42} r={5} fill="#FFB7C5" opacity="0.97" />
    ))}
    {isDragon && <ellipse cx={x} cy={tipY - fH * 0.1} rx={fW * 0.55} ry={fH * 0.25} fill={sp.leafColor} opacity="0.45" />}
    {isDragon && [[-0.3, 0], [0.3, 0], [0, -0.25]].map(([dx, dy], i) => (
      <circle key={i} cx={x + dx * fW * 0.42} cy={tipY - fH * 0.12 + dy * fH * 0.42} r={4} fill="#c62828" opacity="0.72" />
    ))}
    {isDecember && <ellipse cx={x} cy={tipY - fH * 0.65} rx={fW * 0.3} ry={fH * 0.12} fill="white" opacity="0.75" />}
  </g>;
}

const SHAPE_MAP = {
  round: RoundTree, upright: UprightTree, drooping: DroopingTree,
  palm: PalmTree, bonsai: BonsaiTree, cactus: CactusTree,
  bamboo: BambooTree, baobab: BaobabTree, fan: FanTree,
};

export default function TreeSVG({
  species = 'oak', growthState = 3, decoration = 'none',
  potStyle = 'terracotta', background = 'day',
  hasFlowers = false, isDecember = false,
  width = 200, height = 280,
}) {
  const sp = TREE_SPECIES.find(t => t.id === species) || TREE_SPECIES[0];
  const ShapeRenderer = SHAPE_MAP[sp.shape] || RoundTree;
  const s = GROWTH_SCALE[Math.max(1, Math.min(5, growthState))];
  const x = 100, potY = 225;
  const trunkH = 78 * s;
  const canopyR = 55 * s;

  return (
    <svg viewBox="0 0 200 280" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <Background bgId={background} />
      <Pot style={potStyle} x={x} y={potY} />
      <ShapeRenderer sp={sp} s={s} x={x} y={potY} hasFlowers={hasFlowers} isDecember={isDecember} />
      {decoration !== 'none' && s > 0.45 && (
        <Decoration type={decoration} x={x} y={potY} trunkH={trunkH} canopyR={canopyR} />
      )}
    </svg>
  );
}
