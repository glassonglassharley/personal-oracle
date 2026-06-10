import { useId } from 'react';
import { TREE_SPECIES, POT_STYLES, BACKGROUNDS } from './companionData';

const GROWTH_SCALE = [0, 0.28, 0.48, 0.68, 0.85, 1.0];

function adj(hex, amt) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + amt));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + amt));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

function Background({ bgId, artId }) {
  const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
  const isNight = bgId === 'night_stars' || bgId === 'space' || bgId === 'mystical_forest';
  const isSnowy = bgId === 'snowy';
  const skyGradId = `sky-${artId}`;
  const gndGradId = `gnd-${artId}`;

  const stars = isNight ? Array.from({ length: 26 }, (_, i) => ({
    cx: (i * 37 + 11) % 196 + 2,
    cy: (i * 23 + 7) % 120 + 5,
    r: i % 4 === 0 ? 1.5 : 1,
    op: 0.5 + (i % 5) * 0.1,
  })) : [];

  return (
    <g>
      <defs>
        <linearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.sky1} />
          <stop offset="100%" stopColor={bg.sky2} />
        </linearGradient>
        <linearGradient id={gndGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={adj(bg.ground, 20)} />
          <stop offset="100%" stopColor={adj(bg.ground, -20)} />
        </linearGradient>
      </defs>
      <rect width="200" height="215" fill={`url(#${skyGradId})`} />
      <rect x="0" y="215" width="200" height="65" fill={`url(#${gndGradId})`} />
      <line x1="0" y1="215" x2="200" y2="215" stroke={adj(bg.ground, -30)} strokeWidth="1.5" opacity="0.45" />

      {stars.map((s, i) => (
        <g key={i}>
          <circle cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />
          {i % 4 === 0 && <circle cx={s.cx} cy={s.cy} r={s.r * 2.8} fill="white" opacity={s.op * 0.22} />}
        </g>
      ))}

      {bgId === 'day' && <>
        <g opacity="0.88">
          <ellipse cx="38" cy="47" rx="26" ry="14" fill="white" />
          <ellipse cx="54" cy="40" rx="20" ry="13" fill="white" />
          <ellipse cx="28" cy="52" rx="14" ry="9" fill="white" />
          <ellipse cx="44" cy="58" rx="24" ry="5" fill="rgba(0,0,0,0.05)" />
        </g>
        <g opacity="0.7">
          <ellipse cx="158" cy="56" rx="21" ry="12" fill="white" />
          <ellipse cx="170" cy="50" rx="15" ry="9" fill="white" />
        </g>
        <circle cx="168" cy="34" r="16" fill="#FDD835" opacity="0.93" />
        <circle cx="168" cy="34" r="23" fill="#FDD835" opacity="0.15" />
        <circle cx="162" cy="28" r="7" fill="#fff9c4" opacity="0.42" />
      </>}

      {bgId === 'sunset' && <>
        <circle cx="100" cy="190" r="38" fill="#FF7043" opacity="0.6" />
        <rect x="0" y="175" width="200" height="15" fill="rgba(255,140,0,0.22)" />
        <rect x="0" y="190" width="200" height="25" fill="rgba(255,80,0,0.16)" />
      </>}

      {bgId === 'rainy' && Array.from({ length: 22 }, (_, i) => (
        <line key={i} x1={(i * 9 + 3) % 200} y1={(i * 17) % 200}
          x2={((i * 9 + 3) % 200) - 4} y2={((i * 17) % 200) + 16}
          stroke="#90A4AE" strokeWidth="1" opacity="0.48" />
      ))}

      {isSnowy && <>
        <ellipse cx="100" cy="220" rx="85" ry="12" fill="white" opacity="0.5" />
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} cx={(i * 13 + 4) % 200} cy={(i * 11 + 8) % 180}
            r={i % 3 === 0 ? 2.5 : 1.5} fill="white" opacity="0.85" />
        ))}
      </>}

      {bgId === 'mystical_forest' && <>
        <circle cx="162" cy="32" r="14" fill="#FFF9C4" opacity="0.75" />
        <circle cx="170" cy="27" r="11" fill={bg.sky1} opacity="0.9" />
        <ellipse cx="30" cy="190" rx="18" ry="40" fill="rgba(45,90,45,0.4)" />
        <ellipse cx="175" cy="195" rx="14" ry="35" fill="rgba(45,90,45,0.4)" />
        {Array.from({ length: 6 }, (_, i) => (
          <circle key={i} cx={(i * 31 + 18) % 180 + 10} cy={(i * 17 + 30) % 160 + 20}
            r={1.2} fill="#FFFDE7" opacity={0.5 + (i % 4) * 0.12} />
        ))}
      </>}

      {bgId === 'tropical_beach' && <>
        <ellipse cx="100" cy="222" rx="100" ry="15" fill="#f9c74f" opacity="0.35" />
        <rect x="0" y="210" width="200" height="25" fill="rgba(0,180,216,0.15)" />
        <ellipse cx="40" cy="218" rx="22" ry="5" fill="rgba(255,255,255,0.18)" />
      </>}

      {bgId === 'mountaintop' && <>
        <polygon points="60,215 90,155 120,215" fill="#9e9e9e" />
        <polygon points="120,215 155,160 190,215" fill="#bdbdbd" />
        <polygon points="0,215 35,175 70,215" fill="#8e8e8e" />
        <polygon points="90,155 100,145 110,155" fill="white" opacity="0.85" />
        <polygon points="155,160 162,152 169,160" fill="white" opacity="0.75" />
        <polygon points="35,175 41,168 47,175" fill="white" opacity="0.7" />
      </>}

      {bgId === 'space' && <>
        <circle cx="50" cy="50" r="18" fill="#5c6bc0" opacity="0.55" />
        <ellipse cx="50" cy="50" rx="28" ry="7" fill="none" stroke="#90caf9" strokeWidth="2" opacity="0.4" />
        <circle cx="168" cy="28" r="7" fill="#ef5350" opacity="0.5" />
        <circle cx="140" cy="80" r="4" fill="#ffd740" opacity="0.6" />
        <ellipse cx="110" cy="40" rx="22" ry="8" fill="rgba(138,43,226,0.22)" />
      </>}
      {/* Atmospheric horizon depth */}
      <rect x="0" y="200" width="200" height="20"
        fill={bg.sky2} opacity="0.14" />
      <rect x="0" y="212" width="200" height="6"
        fill={adj(bg.ground, 15)} opacity="0.22" />
    </g>
  );
}

function Pot({ style = 'terracotta', x = 100, y = 225, artId = '' }) {
  const p = POT_STYLES.find(ps => ps.id === style) || POT_STYLES[0];
  const potGId = `pot-g-${artId}`;

  if (style === 'floating') {
    return <g>
      <ellipse cx={x} cy={y + 7} rx="28" ry="11" fill="#4a3728" />
      <ellipse cx={x} cy={y + 5} rx="25" ry="9" fill="#5a4738" />
      <ellipse cx={x - 5} cy={y + 4} rx="8" ry="4" fill="rgba(255,255,255,0.1)" />
      <ellipse cx={x} cy={y + 14} rx="22" ry="5" fill="rgba(100,200,255,0.18)" />
    </g>;
  }

  if (style === 'wooden_barrel') {
    return <g>
      <defs>
        <linearGradient id={potGId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={adj(p.color, -22)} />
          <stop offset="38%" stopColor={adj(p.color, 18)} />
          <stop offset="100%" stopColor={adj(p.color, -18)} />
        </linearGradient>
      </defs>
      <rect x={x - 22} y={y} width="44" height="36" rx="4" fill={`url(#${potGId})`} />
      {[5, 15, 26].map(dy => (
        <rect key={dy} x={x - 22} y={y + dy} width="44" height="3.5" rx="1" fill={p.dark} opacity="0.7" />
      ))}
      <rect x={x - 25} y={y - 4} width="50" height="8" rx="3.5" fill={p.rim} />
      <ellipse cx={x} cy={y} rx="23" ry="5.5" fill="#5d4037" />
      <ellipse cx={x} cy={y} rx="17" ry="3.5" fill={adj(p.color, 22)} opacity="0.5" />
    </g>;
  }

  return <g>
    <defs>
      <linearGradient id={potGId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={adj(p.color, -28)} />
        <stop offset="32%" stopColor={adj(p.color, 22)} />
        <stop offset="100%" stopColor={adj(p.color, -22)} />
      </linearGradient>
    </defs>
    <path d={`M${x - 21} ${y + 37} L${x - 25} ${y + 2} L${x + 25} ${y + 2} L${x + 21} ${y + 37}Z`}
      fill={`url(#${potGId})`} />
    <rect x={x - 27} y={y - 4} width="54" height="9" rx="3.5" fill={p.rim} />
    <ellipse cx={x} cy={y - 0.5} rx="24" ry="5.5" fill="#3e2b1f" />
    <ellipse cx={x} cy={y - 0.5} rx="18" ry="3.8" fill="#5a3a28" opacity="0.6" />
    <path d={`M${x - 15} ${y + 5} L${x - 17} ${y + 33}`}
      stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" strokeLinecap="round" />
  </g>;
}

function Snow({ x, y, r }) {
  return <ellipse cx={x} cy={y - r * 0.65} rx={r * 0.55} ry={r * 0.14} fill="white" opacity="0.82" />;
}

function Flowers({ positions }) {
  return <g>{positions.map(([fx, fy], i) => (
    <g key={i}>
      {Array.from({ length: 5 }, (_, p) => {
        const pa = (p / 5) * Math.PI * 2;
        return <ellipse key={p}
          cx={fx + Math.cos(pa) * 3.2} cy={fy + Math.sin(pa) * 3.2}
          rx={2.8} ry={2.0} fill="#FFB7C5" opacity="0.94"
          transform={`rotate(${p * 72},${fx + Math.cos(pa) * 3.2},${fy + Math.sin(pa) * 3.2})`} />;
      })}
      <circle cx={fx} cy={fy} r={1.8} fill="#FFF9C4" opacity="0.92" />
    </g>
  ))}</g>;
}

function Decoration({ type, x, y, trunkH, canopyR }) {
  if (!type || type === 'none') return null;
  const branchX = x + canopyR * 0.45;
  const branchY = y - trunkH * 0.65;

  if (type === 'fairy_lights') {
    const lights = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BFF', '#FF9F43', '#48DBFB', '#FF9FF3'];
    return <g>{Array.from({ length: 12 }, (_, i) => {
      const ang = (i / 12) * Math.PI * 2;
      const r = canopyR * 0.78;
      return <g key={i}>
        <circle cx={x + Math.cos(ang) * r * 0.85} cy={(y - trunkH * 0.55) + Math.sin(ang) * r * 0.45}
          r={3.5} fill={lights[i % lights.length]} opacity="0.95" />
        <circle cx={x + Math.cos(ang) * r * 0.85} cy={(y - trunkH * 0.55) + Math.sin(ang) * r * 0.45}
          r={6} fill={lights[i % lights.length]} opacity="0.18" />
      </g>;
    })}</g>;
  }

  if (type === 'tire_swing') return <g>
    <line x1={branchX} y1={branchY} x2={branchX} y2={branchY + 32} stroke="#5d4037" strokeWidth="2.2" />
    <ellipse cx={branchX} cy={branchY + 38} rx="11" ry="7" fill="none" stroke="#212121" strokeWidth="5.5" />
    <ellipse cx={branchX} cy={branchY + 38} rx="7" ry="4" fill="none" stroke="#424242" strokeWidth="2" />
  </g>;

  if (type === 'treehouse') return <g>
    <rect x={x + canopyR * 0.22 - 16} y={branchY - 22} width="32" height="20" fill="#8d6e63" rx="2" />
    <polygon points={`${x + canopyR * 0.22 - 18},${branchY - 22} ${x + canopyR * 0.22},${branchY - 36} ${x + canopyR * 0.22 + 18},${branchY - 22}`} fill="#795548" />
    <rect x={x + canopyR * 0.22 - 5} y={branchY - 12} width="10" height="10" fill="#FFE082" />
    <line x1={x + canopyR * 0.22} y1={branchY - 2} x2={x + canopyR * 0.22} y2={branchY + 14} stroke="#5d4037" strokeWidth="2.5" />
  </g>;

  if (type === 'birds_nest') return <g>
    <path d={`M${x - 18} ${y - trunkH * 0.88} Q${x} ${y - trunkH * 0.93} ${x + 18} ${y - trunkH * 0.88}`}
      fill="none" stroke="#8d6e63" strokeWidth="4.5" strokeLinecap="round" />
    <path d={`M${x - 14} ${y - trunkH * 0.87} Q${x} ${y - trunkH * 0.91} ${x + 14} ${y - trunkH * 0.87}`}
      fill="none" stroke="#a1887f" strokeWidth="2.5" strokeLinecap="round" />
    {[-6, 1, 8].map((dx, i) => <circle key={i} cx={x + dx} cy={y - trunkH * 0.865} r={3.8} fill={i === 1 ? '#cfd8dc' : '#b0bec5'} />)}
  </g>;

  if (type === 'hammock') return <g>
    <line x1={x - 38} y1={y - trunkH * 0.62} x2={x - 38} y2={y - trunkH * 0.75} stroke="#5d4037" strokeWidth="2.2" />
    <line x1={x + 38} y1={y - trunkH * 0.62} x2={x + 38} y2={y - trunkH * 0.75} stroke="#5d4037" strokeWidth="2.2" />
    <path d={`M${x - 38} ${y - trunkH * 0.62} Q${x} ${y - trunkH * 0.46} ${x + 38} ${y - trunkH * 0.62}`}
      fill="none" stroke="#F57F17" strokeWidth="7" strokeLinecap="round" />
    <path d={`M${x - 38} ${y - trunkH * 0.62} Q${x} ${y - trunkH * 0.46} ${x + 38} ${y - trunkH * 0.62}`}
      fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" />
  </g>;

  return null;
}

// ── Shape renderers ──

function RoundTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 78 * s, tW = Math.max(4, 11 * s), cR = 55 * s;
  const cY = y - tH - cR * 0.65;
  const isRainbow = sp.id === 'rainbow_eucalyptus';
  const isMaple = sp.id === 'maple';

  return <g filter={`url(#${ids.softShadow})`}>
    {isRainbow && <defs>
      <linearGradient id={ids.rainbowTrunk} x1="0" y1="0" x2="1" y2="0">
        {['#e53935', '#f9a825', '#43a047', '#1e88e5', '#8e24aa'].map((c, i) => (
          <stop key={i} offset={`${i * 25}%`} stopColor={c} />
        ))}
      </linearGradient>
    </defs>}
    <path d={`M${x - tW * 0.56} ${y} Q${x - tW * 0.2} ${y - tH * 0.55} ${x - tW * 0.35} ${y - tH} L${x + tW * 0.35} ${y - tH} Q${x + tW * 0.18} ${y - tH * 0.48} ${x + tW * 0.56} ${y}Z`}
      fill={isRainbow ? `url(#${ids.rainbowTrunk})` : `url(#${ids.trunkGrad})`} />
    {s > 0.35 && [0.25, 0.52, 0.78].map((t, i) => (
      <path key={i} d={`M${x - tW * 0.18 + i * tW * 0.12} ${y - tH * 0.08} Q${x - tW * 0.34 + i * tW * 0.18} ${y - tH * t} ${x - tW * 0.05 + i * tW * 0.08} ${y - tH * 0.94}`}
        fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth={Math.max(0.9, tW * 0.14)} strokeLinecap="round" />
    ))}
    {s > 0.45 && <>
      <circle cx={x - cR * 0.52} cy={cY + cR * 0.22} r={cR * 0.72} fill={sp.leafDark} opacity="0.88" />
      <circle cx={x + cR * 0.52} cy={cY + cR * 0.22} r={cR * 0.72} fill={sp.leafDark} opacity="0.88" />
    </>}
    {s > 0.65 && <>
      <circle cx={x - cR * 0.32} cy={cY + cR * 0.44} r={cR * 0.52} fill={sp.leafDark} opacity="0.72" />
      <circle cx={x + cR * 0.32} cy={cY + cR * 0.44} r={cR * 0.52} fill={sp.leafDark} opacity="0.72" />
      <circle cx={x} cy={cY + cR * 0.52} r={cR * 0.58} fill={sp.leafDark} opacity="0.62" />
    </>}
    <circle cx={x} cy={cY} r={cR} fill={`url(#${ids.leafGrad})`} />
    {s > 0.35 && Array.from({ length: 36 }, (_, i) => {
      const ang = (i / 36) * Math.PI * 2;
      const rr = cR * (0.58 + ((i * 7) % 10) / 28);
      const lx = x + Math.cos(ang) * rr;
      const ly = cY + Math.sin(ang) * rr * 0.74;
      const leafSz = Math.max(4.2, cR * 0.096 + (i % 4) * 0.6);
      const leafAng = (ang * 180 / Math.PI) + 95 + ((i % 5) - 2) * 12;
      const leafCol = i % 6 === 0 ? adj(sp.leafColor, 44)
                    : i % 4 === 0 ? adj(sp.leafColor, 20)
                    : i % 3 === 0 ? sp.leafColor
                    : sp.leafDark;
      return <LeafBezier key={i} cx={lx} cy={ly} size={leafSz}
        angle={leafAng} color={leafCol} opacity={0.62 + (i % 4) * 0.06} />;
    })}
    {/* Canopy light overlay top-left */}
    {s > 0.4 && <ellipse cx={x - cR * 0.28} cy={cY - cR * 0.32} rx={cR * 0.52} ry={cR * 0.42} fill="white" opacity="0.09" />}
    {/* Canopy shadow overlay bottom-right */}
    {s > 0.4 && <ellipse cx={x + cR * 0.20} cy={cY + cR * 0.28} rx={cR * 0.46} ry={cR * 0.36} fill={sp.leafDark} opacity="0.20" />}
    {/* Rim light on back edge */}
    {s > 0.5 && <circle cx={x} cy={cY} r={cR} fill="none" stroke={adj(sp.leafColor, 55)} strokeWidth="2.5" opacity="0.18" />}
    {isMaple && s > 0.45 && Array.from({ length: 10 }, (_, i) => {
      const ang = (i / 10) * Math.PI * 2;
      const rr = cR * (0.3 + (i % 3) * 0.18);
      const lx = x + Math.cos(ang) * rr * 0.85;
      const ly = cY + Math.sin(ang) * rr * 0.68;
      return <path key={i}
        d={`M${lx},${ly - 4.5} L${lx - 2},${ly - 2} L${lx - 4.5},${ly - 1.5} L${lx - 2.5},${ly + 1.5} L${lx - 3.5},${ly + 4} L${lx},${ly + 2.5} L${lx + 3.5},${ly + 4} L${lx + 2.5},${ly + 1.5} L${lx + 4.5},${ly - 1.5} L${lx + 2},${ly - 2}Z`}
        fill={adj(sp.leafColor, -15)} opacity="0.82"
        transform={`rotate(${(i * 36)},${lx},${ly})`} />;
    })}
    <circle cx={x - cR * 0.28} cy={cY - cR * 0.28} r={cR * 0.38} fill="white" opacity="0.15" />
    {s > 0.65 && sp.id === 'apple' && [
      [-0.48, 0.28], [0.38, 0.2], [0.04, 0.48], [-0.28, -0.18], [0.46, -0.12]
    ].map(([dx, dy], i) => {
      const fx = x + dx * cR * 0.76, fy = cY + dy * cR * 0.76;
      return <g key={i}>
        <ellipse cx={fx} cy={fy + 1} rx={4.2} ry={4.8} fill="#d32f2f" opacity="0.94" />
        <ellipse cx={fx - 1.2} cy={fy - 1.5} rx={1.8} ry={1.5} fill="#ffcdd2" opacity="0.42" />
        <line x1={fx} y1={fy - 4.8} x2={fx + 1.2} y2={fy - 7.8} stroke="#5d4037" strokeWidth="1.3" strokeLinecap="round" />
      </g>;
    })}
    {s > 0.65 && sp.id === 'lemon' && [
      [-0.46, 0.3], [0.4, 0.2], [0.02, 0.5], [-0.26, -0.2], [0.48, -0.1]
    ].map(([dx, dy], i) => {
      const fx = x + dx * cR * 0.76, fy = cY + dy * cR * 0.76;
      return <g key={i}>
        <ellipse cx={fx} cy={fy} rx={5.5} ry={4.0} fill="#fdd835" opacity="0.95" />
        <ellipse cx={fx - 1.5} cy={fy - 1.2} rx={2} ry={1.4} fill="white" opacity="0.36" />
        <circle cx={fx + 5.0} cy={fy} r={1.3} fill="#f9a825" opacity="0.72" />
      </g>;
    })}
    {s > 0.65 && sp.id === 'mango' && [
      [-0.48, 0.28], [0.38, 0.2], [0.04, 0.5], [-0.28, -0.2], [0.46, -0.1]
    ].map(([dx, dy], i) => {
      const fx = x + dx * cR * 0.76, fy = cY + dy * cR * 0.76;
      return <g key={i}>
        <ellipse cx={fx} cy={fy + 1} rx={3.5} ry={5.5} fill="#e65100" opacity="0.9" />
        <ellipse cx={fx + 0.8} cy={fy - 1} rx={1.5} ry={2.5} fill="#ffcc02" opacity="0.48" />
      </g>;
    })}
    {s > 0.65 && sp.id === 'olive' && [
      [-0.46, 0.3], [0.4, 0.22], [0.04, 0.5], [-0.28, -0.2], [0.5, -0.1], [0.18, -0.42]
    ].map(([dx, dy], i) => {
      const fx = x + dx * cR * 0.74, fy = cY + dy * cR * 0.74;
      return <g key={i}>
        <ellipse cx={fx} cy={fy} rx={2.8} ry={4.5} fill={i % 3 === 0 ? '#558b2f' : '#1b5e20'} opacity="0.90" />
        <ellipse cx={fx - 0.8} cy={fy - 1.2} rx={0.9} ry={1.6} fill="rgba(255,255,255,0.22)" />
      </g>;
    })}
    {hasFlowers && s > 0.27 && <Flowers positions={[
      [x - cR * 0.7, cY], [x + cR * 0.7, cY], [x, cY - cR * 0.72],
      [x + cR * 0.48, cY - cR * 0.52], [x - cR * 0.48, cY - cR * 0.52]
    ]} />}
    {isDecember && <Snow x={x} y={cY} r={cR} />}
  </g>;
}

function AvocadoTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 85 * s, tW = Math.max(5, 13 * s);
  const cR = 60 * s;
  const cY = y - tH - cR * 0.58;

  return <g filter={`url(#${ids.softShadow})`}>
    <path d={`M${x - tW * 0.55} ${y} Q${x - tW * 0.18} ${y - tH * 0.52} ${x - tW * 0.32} ${y - tH} L${x + tW * 0.32} ${y - tH} Q${x + tW * 0.16} ${y - tH * 0.46} ${x + tW * 0.55} ${y}Z`}
      fill={`url(#${ids.trunkGrad})`} />
    {s > 0.35 && [0.28, 0.58, 0.82].map((t, i) => (
      <path key={i} d={`M${x - tW * 0.14 + i * tW * 0.1} ${y - tH * 0.07} Q${x - tW * 0.26 + i * tW * 0.14} ${y - tH * t} ${x - tW * 0.04 + i * tW * 0.06} ${y - tH * 0.96}`}
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={Math.max(0.8, tW * 0.12)} strokeLinecap="round" />
    ))}
    {s > 0.45 && <>
      <circle cx={x - cR * 0.52} cy={cY + cR * 0.28} r={cR * 0.7} fill={sp.leafDark} opacity="0.95" />
      <circle cx={x + cR * 0.52} cy={cY + cR * 0.28} r={cR * 0.7} fill={sp.leafDark} opacity="0.95" />
      <circle cx={x} cy={cY + cR * 0.38} r={cR * 0.74} fill={sp.leafDark} opacity="0.88" />
    </>}
    <circle cx={x} cy={cY} r={cR} fill={`url(#${ids.leafGrad})`} />
    {s > 0.3 && Array.from({ length: 38 }, (_, i) => {
      const ang = (i / 38) * Math.PI * 2;
      const rr = cR * (0.60 + ((i * 11) % 10) / 28);
      const lx = x + Math.cos(ang) * rr;
      const ly = cY + Math.sin(ang) * rr * 0.72;
      const leafSz = Math.max(5, cR * 0.11 + (i % 3) * 0.7);
      const leafAng = (ang * 180 / Math.PI) + 92 + ((i % 5) - 2) * 10;
      const leafCol = i % 5 === 0 ? adj(sp.leafColor, 50)
                    : i % 3 === 0 ? adj(sp.leafColor, 18)
                    : sp.leafDark;
      return <LeafBezier key={i} cx={lx} cy={ly} size={leafSz}
        angle={leafAng} color={leafCol} opacity={0.64 + (i % 4) * 0.05} />;
    })}
    {s > 0.4 && <ellipse cx={x - cR * 0.30} cy={cY - cR * 0.35} rx={cR * 0.54} ry={cR * 0.44} fill="white" opacity="0.09" />}
    {s > 0.4 && <ellipse cx={x + cR * 0.22} cy={cY + cR * 0.30} rx={cR * 0.48} ry={cR * 0.36} fill={sp.leafDark} opacity="0.20" />}
    {s > 0.5 && <circle cx={x} cy={cY} r={cR} fill="none" stroke={adj(sp.leafColor, 52)} strokeWidth="2.5" opacity="0.17" />}
    <circle cx={x - cR * 0.3} cy={cY - cR * 0.32} r={cR * 0.42} fill="white" opacity="0.13" />
    <circle cx={x - cR * 0.18} cy={cY - cR * 0.42} r={cR * 0.18} fill="white" opacity="0.12" />
    {s > 0.65 && [
      [-0.46, 0.3], [0.42, 0.22], [0.06, 0.52], [-0.26, -0.2], [0.5, -0.1], [0.18, -0.44]
    ].map(([dx, dy], i) => {
      const fx = x + dx * cR * 0.7;
      const fy = cY + dy * cR * 0.7;
      const fr = 5 + (i % 2) * 1.2;
      return <g key={i}>
        <ellipse cx={fx} cy={fy + fr * 0.18} rx={fr * 0.68} ry={fr} fill="#1c3d1a" opacity="0.93" />
        <ellipse cx={fx} cy={fy - fr * 0.7} rx={fr * 0.36} ry={fr * 0.4} fill="#1c3d1a" opacity="0.93" />
        <ellipse cx={fx - fr * 0.2} cy={fy - fr * 0.08} rx={fr * 0.22} ry={fr * 0.36} fill="rgba(255,255,255,0.15)" />
      </g>;
    })}
    {hasFlowers && s > 0.27 && <Flowers positions={[
      [x - cR * 0.72, cY + cR * 0.1], [x + cR * 0.72, cY + cR * 0.1], [x, cY - cR * 0.75],
      [x + cR * 0.5, cY - cR * 0.52], [x - cR * 0.5, cY - cR * 0.52]
    ]} />}
    {isDecember && <Snow x={x} y={cY} r={cR} />}
  </g>;
}

function UprightTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const isRedwood = sp.id === 'redwood';
  const tH = (isRedwood ? 78 : 65) * s, tW = Math.max(4, 8 * s);
  const H = (isRedwood ? 130 : 115) * s, W = (isRedwood ? 56 : 68) * s;
  const baseY = y - tH;
  const layers = Math.min(isRedwood ? 7 : 5, Math.max(2, Math.round(s * (isRedwood ? 7 : 5))));

  return <g filter={`url(#${ids.softShadow})`}>
    <rect x={x - tW / 2} y={y - tH} width={tW} height={tH} rx={tW / 2.5} fill={`url(#${ids.trunkGrad})`} />
    {isRedwood && s > 0.45 && [0.2, 0.5, 0.78].map((t, i) => (
      <path key={i} d={`M${x - tW * 0.28 + i * tW * 0.18} ${y - tH * 0.04} L${x - tW * 0.26 + i * tW * 0.16} ${y - tH * 0.96}`}
        fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="1.4" strokeLinecap="round" />
    ))}
    {Array.from({ length: layers }, (_, i) => {
      const f = (layers - i) / layers;
      const lw = W * f * 0.9;
      const lh = H / (layers * 0.7);
      const by = baseY - i * lh * 0.68;
      const tip = by - lh;
      return <g key={i}>
        <polygon points={`${x},${tip} ${x - lw / 2},${by} ${x - lw * 0.08},${by}`}
          fill={sp.leafDark} opacity="0.32" />
        <polygon points={`${x},${tip} ${x - lw / 2},${by} ${x + lw / 2},${by}`} fill={`url(#${ids.leafGrad})`} />
        <path d={`M${x},${tip + lh * 0.18} L${x},${by - 4}`}
          stroke="rgba(255,255,255,0.26)" strokeWidth="1.2" strokeLinecap="round" />
        {isDecember && i === layers - 1 && (
          <polygon points={`${x},${tip - 3} ${x - lw * 0.2},${tip + 10} ${x + lw * 0.2},${tip + 10}`}
            fill="white" opacity="0.72" />
        )}
      </g>;
    })}
    {isDecember && <text x={x} y={baseY - H - 5} textAnchor="middle" fontSize="11" fill="#FDD835">★</text>}
    {hasFlowers && <circle cx={x} cy={baseY - H + 10} r={5.5} fill="#FFB7C5" />}
  </g>;
}

function DroopingTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 82 * s, tW = Math.max(4, 9 * s);
  const bLen = 56 * s;
  const tipY = y - tH;
  const num = s > 0.65 ? 6 : s > 0.45 ? 5 : 3;
  const angles = [-72, -46, -18, 12, 38, 62].slice(0, num);

  return <g filter={`url(#${ids.softShadow})`}>
    <path d={`M${x} ${y} Q${x + 8 * s} ${y - tH * 0.38} ${x - 4 * s} ${y - tH * 0.65} Q${x - 8 * s} ${y - tH * 0.82} ${x} ${tipY}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={tW} strokeLinecap="round" />
    <path d={`M${x + tW * 0.28} ${y} Q${x + tW * 0.3 + 8 * s} ${y - tH * 0.38} ${x + tW * 0.26 - 4 * s} ${y - tH * 0.65}`}
      fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth={tW * 0.36} strokeLinecap="round" />
    {angles.map((ang, i) => {
      const rad = ang * Math.PI / 180;
      const bx = x + Math.cos(rad) * bLen * 0.62;
      const branchBaseY = y - tH * (0.38 + i * 0.085);
      const ex = bx + Math.cos(rad) * bLen * 0.52;
      const ey = branchBaseY + bLen * 0.58;
      const branchW = Math.max(1.5, tW * 0.38);
      return <g key={i}>
        <path d={`M${x} ${branchBaseY} Q${bx} ${branchBaseY - 10 * s} ${ex} ${ey}`}
          fill="none" stroke={sp.trunkColor} strokeWidth={branchW} strokeLinecap="round" />
        {[0.15, 0.32, 0.50, 0.66, 0.82, 1.0].map((t, j) => {
          const lx = x + (ex - x) * t;
          const ly = branchBaseY + (ey - branchBaseY) * t * t;
          const lr = Math.max(5.5, 7.5 * s);
          return <ellipse key={j} cx={lx} cy={ly} rx={lr} ry={lr * 0.44}
            fill={`url(#${ids.leafGrad})`} opacity={0.82 + j * 0.02}
            transform={`rotate(${ang * 0.55 - 22},${lx},${ly})`} />;
        })}
        {hasFlowers && <circle cx={ex} cy={ey} r={4} fill="#FFB7C5" />}
      </g>;
    })}
    {isDecember && <ellipse cx={x} cy={tipY} rx={12 * s} ry={5 * s} fill="white" opacity="0.7" />}
  </g>;
}

function PalmTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 100 * s, lLen = 52 * s;
  const tipX = x + 7 * s, tipY = y - tH;
  const num = s > 0.65 ? 7 : s > 0.45 ? 6 : 5;
  const isBanana = sp.id === 'banana';

  return <g filter={`url(#${ids.softShadow})`}>
    <path d={`M${x} ${y} Q${x + 16 * s} ${y - tH * 0.5} ${tipX} ${tipY}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(7, 15 * s)} strokeLinecap="round" />
    {Array.from({ length: Math.floor(tH / 16) }, (_, i) => {
      const t = i / Math.floor(tH / 16);
      const cx2 = tipX + (x - tipX) * t;
      const cy2 = tipY + (y - tipY) * t;
      return <ellipse key={i} cx={cx2} cy={cy2} rx={1.2} ry={Math.max(4, 8 * s) / 2}
        fill="rgba(0,0,0,0.13)" />;
    })}
    <path d={`M${x + Math.max(3, 6 * s)} ${y} Q${x + Math.max(3, 7 * s) + 16 * s} ${y - tH * 0.5} ${tipX + Math.max(3, 6 * s)} ${tipY}`}
      fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth={Math.max(3, 7 * s)} strokeLinecap="round" />
    {Array.from({ length: num }, (_, i) => {
      const ang = (i / num) * 360;
      const rad = (ang - 90) * Math.PI / 180;
      const ex = tipX + Math.cos(rad) * lLen;
      const ey = tipY + Math.sin(rad) * lLen * 0.55 + lLen * 0.28;
      const mx = (tipX + ex) / 2;
      const my = tipY - 16 * s;
      if (isBanana) {
        return <ellipse key={i} cx={(ex + tipX) / 2} cy={(ey + tipY) / 2 - 5}
          rx={lLen * 0.42} ry={lLen * 0.16}
          fill={`url(#${ids.leafGrad})`} opacity="0.92"
          transform={`rotate(${ang},${tipX},${tipY})`} />;
      }
      const perpX = Math.cos(rad + Math.PI / 2);
      const perpY = Math.sin(rad + Math.PI / 2);
      return <g key={i}>
        <path d={`M${tipX} ${tipY} Q${mx} ${my} ${ex} ${ey}`}
          fill="none" stroke={`url(#${ids.leafGrad})`} strokeWidth={Math.max(4.5, 8 * s)} strokeLinecap="round" />
        {s > 0.48 && [0.32, 0.56, 0.78].map((t, j) => {
          const fx = tipX + (ex - tipX) * t;
          const fy = tipY + (ey - tipY) * t;
          const fl = lLen * 0.22;
          return <g key={j}>
            <line x1={fx} y1={fy} x2={fx + perpX * fl} y2={fy + perpY * fl}
              stroke={sp.leafColor} strokeWidth={Math.max(2.2, 4 * s)} strokeLinecap="round" opacity="0.86" />
            <line x1={fx} y1={fy} x2={fx - perpX * fl} y2={fy - perpY * fl}
              stroke={sp.leafDark} strokeWidth={Math.max(2.2, 4 * s)} strokeLinecap="round" opacity="0.70" />
          </g>;
        })}
      </g>;
    })}
    {sp.id === 'palm' && s > 0.55 && <>
      <ellipse cx={tipX - 7} cy={tipY + 12} rx={5.5} ry={7} fill="#3e2723" />
      <ellipse cx={tipX + 6} cy={tipY + 14} rx={5.5} ry={7} fill="#4e342e" />
      <ellipse cx={tipX - 1} cy={tipY + 7} rx={4.5} ry={6} fill="#795548" />
    </>}
    {isBanana && s > 0.55 && <>
      <ellipse cx={tipX} cy={tipY + 12} rx={14} ry={7} fill="#F9A825" />
      <ellipse cx={tipX - 4} cy={tipY + 10} rx={5} ry={3} fill="#FFF176" opacity="0.55" />
    </>}
    {isDecember && <circle cx={tipX} cy={tipY} r={10 * s} fill="white" opacity="0.38" />}
  </g>;
}

function BonsaiTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 50 * s, tW = Math.max(7, 15 * s);
  const tipY = y - tH;

  const clusters = [
    [x + 32 * s, tipY - 4 * s, 17 * s],
    [x + 12 * s, tipY - 16 * s, 15 * s],
    [x - 5 * s, tipY - 21 * s, 14 * s],
    s > 0.45 ? [x - 28 * s, tipY - 4 * s, 15 * s] : null,
    s > 0.65 ? [x + 22 * s, tipY + 4 * s, 11 * s] : null,
    s > 0.65 ? [x - 16 * s, tipY - 14 * s, 11 * s] : null,
  ].filter(Boolean);

  return <g filter={`url(#${ids.softShadow})`}>
    {s > 0.28 && <ellipse cx={x} cy={y - 2} rx={22 * s} ry={4} fill={adj(sp.trunkColor, -12)} opacity="0.42" />}
    <path d={`M${x - 2} ${y} Q${x - 10 * s} ${y - tH * 0.4} ${x - 5 * s} ${tipY}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={tW} strokeLinecap="round" />
    <path d={`M${x - 5 * s} ${tipY} Q${x + 22 * s} ${tipY - 8 * s} ${x + 36 * s} ${tipY + 4 * s}`}
      fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(3, tW * 0.5)} strokeLinecap="round" />
    {s > 0.45 && <>
      <path d={`M${x - 5 * s} ${tipY + 10 * s} Q${x - 22 * s} ${tipY + 2 * s} ${x - 30 * s} ${tipY + 10 * s}`}
        fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(2.5, tW * 0.42)} strokeLinecap="round" />
      <path d={`M${x + 14 * s} ${tipY - 2 * s} Q${x + 16 * s} ${tipY - 14 * s} ${x + 22 * s} ${tipY - 12 * s}`}
        fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(1.8, tW * 0.32)} strokeLinecap="round" />
    </>}
    {clusters.map(([cx2, cy2, r], i) => (
      <g key={i}>
        <circle cx={cx2 + r * 0.18} cy={cy2 + r * 0.22} r={r * 0.82} fill={sp.leafDark} opacity="0.58" />
        <circle cx={cx2} cy={cy2} r={r} fill={`url(#${ids.leafGrad})`} opacity="0.96" />
        {Array.from({ length: 10 }, (_, li) => {
          const ang = (li / 10) * Math.PI * 2;
          const lx = cx2 + Math.cos(ang) * r * 0.82;
          const ly = cy2 + Math.sin(ang) * r * 0.80;
          const leafSz = Math.max(3.2, r * 0.20);
          return <LeafBezier key={li} cx={lx} cy={ly} size={leafSz}
            angle={(ang * 180 / Math.PI) + 90}
            color={li % 3 === 0 ? adj(sp.leafColor, 28) : sp.leafDark} opacity={0.62 + (li % 3) * 0.08} />;
        })}
        <circle cx={cx2 - r * 0.3} cy={cy2 - r * 0.32} r={r * 0.32} fill="white" opacity="0.14" />
      </g>
    ))}
    {hasFlowers && <circle cx={x - 5 * s} cy={tipY - 27 * s} r={5} fill="#FFB7C5" />}
    {isDecember && clusters.map(([cx2, cy2, r], i) => (
      <ellipse key={i} cx={cx2} cy={cy2 - r * 0.72} rx={r * 0.62} ry={r * 0.2} fill="white" opacity="0.62" />
    ))}
  </g>;
}

function CactusFlower({ x, y }) {
  return <g>
    {Array.from({ length: 8 }, (_, pi) => {
      const prad = (pi / 8) * Math.PI * 2;
      return <ellipse key={pi}
        cx={x + Math.cos(prad) * 6.5} cy={y + Math.sin(prad) * 6.5}
        rx={2.8} ry={5.5} fill="#FF80AB" opacity="0.92"
        transform={`rotate(${pi * 45},${x + Math.cos(prad) * 6.5},${y + Math.sin(prad) * 6.5})`} />;
    })}
    <circle cx={x} cy={y} r={5.5} fill="#FDD835" opacity="0.95" />
    <circle cx={x - 1.5} cy={y - 1.5} r={2} fill="white" opacity="0.35" />
  </g>;
}

function CactusTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 82 * s, tW = Math.max(10, 19 * s);
  const aH = 42 * s, aW = Math.max(6, 13 * s);
  const topY = y - tH;

  return <g filter={`url(#${ids.softShadow})`}>
    <path d={`M${x - tW / 2} ${y} L${x - tW / 2} ${topY + tW / 2} Q${x - tW / 2} ${topY} ${x} ${topY} Q${x + tW / 2} ${topY} ${x + tW / 2} ${topY + tW / 2} L${x + tW / 2} ${y}Z`}
      fill={`url(#${ids.leafGrad})`} />
    {[-1, 0, 1].map(d => (
      <line key={d} x1={x + d * tW * 0.26} y1={y} x2={x + d * tW * 0.26} y2={topY}
        stroke="rgba(0,0,0,0.10)" strokeWidth="2.2" />
    ))}
    <path d={`M${x + tW * 0.28} ${y} L${x + tW * 0.28} ${topY + tW / 2} Q${x + tW * 0.28} ${topY + 3} ${x + tW * 0.44} ${topY + tW * 0.44}`}
      fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth={tW * 0.26} strokeLinecap="round" />
    {s > 0.35 && [0.24, 0.50, 0.74].map((ht, si) => (
      [-tW * 0.44, 0, tW * 0.44].map((dx, di) => (
        <g key={`${si}-${di}`}>
          {[-1, 0, 1].map(a => (
            <line key={a}
              x1={x + dx} y1={y - tH * ht}
              x2={x + dx + (di === 0 ? -8 : di === 2 ? 8 : 0) + a * 2.5}
              y2={y - tH * ht - 7}
              stroke="#F5F5F5" strokeWidth="1.1" strokeLinecap="round" />
          ))}
        </g>
      ))
    ))}
    {s > 0.45 && <>
      <path d={`M${x - tW / 2} ${y - tH * 0.58} Q${x - tW / 2 - aW * 1.6} ${y - tH * 0.60} ${x - tW / 2 - aW * 1.4} ${y - tH * 0.58 - aH * 0.28} Q${x - tW / 2 - aW * 1.52} ${y - tH * 0.64} ${x - tW / 2 - aW} ${y - tH * 0.64 - aH * 0.56}`}
        fill="none" stroke={sp.leafColor} strokeWidth={aW} strokeLinecap="round" />
      <path d={`M${x - tW * 0.26} ${y - tH * 0.58} Q${x - tW / 2 - aW * 1.42} ${y - tH * 0.60} ${x - tW / 2 - aW * 1.24} ${y - tH * 0.65 - aH * 0.52}`}
        fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth={aW * 0.3} strokeLinecap="round" />
      <path d={`M${x + tW / 2} ${y - tH * 0.48} Q${x + tW / 2 + aW * 1.6} ${y - tH * 0.50} ${x + tW / 2 + aW * 1.4} ${y - tH * 0.48 - aH * 0.28} Q${x + tW / 2 + aW * 1.52} ${y - tH * 0.56} ${x + tW / 2 + aW} ${y - tH * 0.56 - aH * 0.48}`}
        fill="none" stroke={sp.leafColor} strokeWidth={aW} strokeLinecap="round" />
    </>}
    {(hasFlowers || s > 0.65) && <CactusFlower x={x} y={topY - 6} />}
    {isDecember && <ellipse cx={x} cy={topY - 2} rx={tW * 0.62} ry={4.5} fill="white" opacity="0.78" />}
  </g>;
}

function BambooTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const num = s > 0.65 ? 4 : s > 0.45 ? 3 : 2;
  const H = 100 * s, tW = Math.max(5, 9 * s);
  const dxArr = num === 4 ? [-18 * s, -6 * s, 6 * s, 18 * s]
    : num === 3 ? [-14 * s, 0, 14 * s]
    : [-9 * s, 9 * s];
  const hArr = num === 4 ? [H, H * 0.88, H * 0.74, H * 0.62]
    : num === 3 ? [H, H * 0.83, H * 0.68]
    : [H, H * 0.83];

  return <g filter={`url(#${ids.softShadow})`}>
    {dxArr.map((dx, i) => {
      const h = hArr[i];
      const segs = Math.max(3, Math.floor(h / 14));
      const sx = x + dx;
      return <g key={i}>
        <rect x={sx - tW / 2} y={y - h} width={tW} height={h} rx={tW / 2} fill={`url(#${ids.leafGrad})`} />
        <rect x={sx + tW * 0.22} y={y - h + 2} width={tW * 0.26} height={h - 4} rx={tW * 0.13}
          fill="rgba(255,255,255,0.14)" />
        {Array.from({ length: segs }, (_, j) => (
          <g key={j}>
            <rect x={sx - tW / 2} y={y - h + j * (h / segs)} width={tW} height={3}
              rx="1.5" fill="rgba(0,0,0,0.22)" />
            <rect x={sx - tW / 2} y={y - h + j * (h / segs) + 3} width={tW} height={1.5}
              rx="1" fill="rgba(255,255,255,0.18)" />
          </g>
        ))}
        <ellipse cx={sx - 15 * s} cy={y - h + 8 * s} rx={12 * s} ry={4.5 * s}
          fill={sp.leafColor} opacity="0.92"
          transform={`rotate(-32,${sx - 15 * s},${y - h + 8 * s})`} />
        <ellipse cx={sx + 13 * s} cy={y - h + 4 * s} rx={12 * s} ry={4.5 * s}
          fill={sp.leafColor} opacity="0.88"
          transform={`rotate(25,${sx + 13 * s},${y - h + 4 * s})`} />
        {h > 55 * s && <>
          <ellipse cx={sx - 12 * s} cy={y - h * 0.55 + 6 * s} rx={10 * s} ry={3.8 * s}
            fill={sp.leafDark} opacity="0.72"
            transform={`rotate(-28,${sx - 12 * s},${y - h * 0.55 + 6 * s})`} />
          <ellipse cx={sx + 10 * s} cy={y - h * 0.55 + 2 * s} rx={10 * s} ry={3.8 * s}
            fill={sp.leafDark} opacity="0.68"
            transform={`rotate(22,${sx + 10 * s},${y - h * 0.55 + 2 * s})`} />
        </>}
        {isDecember && <ellipse cx={sx} cy={y - h - 2} rx={tW * 0.9} ry={2.8} fill="white" opacity="0.78" />}
      </g>;
    })}
  </g>;
}

function BaobabTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 70 * s, tW = Math.max(16, 32 * s);
  const cY = y - tH;

  const clusters = [
    [x - 30 * s, cY - 26 * s, 21 * s],
    [x + 28 * s, cY - 23 * s, 21 * s],
    [x + 5 * s, cY - 32 * s, 21 * s],
    s > 0.65 ? [x - 10 * s, cY - 42 * s, 15 * s] : null,
    s > 0.65 ? [x + 18 * s, cY - 40 * s, 13 * s] : null,
  ].filter(Boolean);

  return <g filter={`url(#${ids.softShadow})`}>
    <path d={`M${x - tW / 2} ${y} Q${x - tW * 0.58} ${y - tH * 0.5} ${x - tW * 0.28} ${y - tH} L${x + tW * 0.28} ${y - tH} Q${x + tW * 0.58} ${y - tH * 0.5} ${x + tW / 2} ${y}Z`}
      fill={`url(#${ids.trunkGrad})`} />
    <path d={`M${x + tW * 0.28} ${y} Q${x + tW * 0.58} ${y - tH * 0.5} ${x + tW / 2} ${y}Z`}
      fill="rgba(0,0,0,0.11)" />
    {s > 0.35 && [
      [x - 8, 0.1, 0.9], [x + 5, 0.06, 0.88], [x - 1, 0.14, 0.82], [x + 13, 0.09, 0.78]
    ].map(([lx, t0, t1], i) => (
      <path key={i} d={`M${lx} ${y - tH * t0} Q${lx + (i % 2 === 0 ? -3 : 4)} ${y - tH * ((t0 + t1) / 2)} ${lx + (i % 2 === 0 ? -1 : 2)} ${y - tH * t1}`}
        fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="1.8" strokeLinecap="round" />
    ))}
    {s > 0.45 && [
      [x - 30 * s, cY - 14 * s, Math.max(3.5, 6.5 * s)],
      [x + 28 * s, cY - 12 * s, Math.max(3, 5.5 * s)],
      [x + 5 * s, cY - 20 * s, Math.max(2.5, 4.5 * s)],
      s > 0.65 ? [x - 10 * s, cY - 30 * s, Math.max(2, 3.5 * s)] : null,
      s > 0.65 ? [x + 18 * s, cY - 28 * s, Math.max(2, 3 * s)] : null,
    ].filter(Boolean).map(([ex, ey, sw], i) => (
      <path key={i} d={`M${x} ${cY} Q${(x + ex) / 2} ${cY - 6} ${ex} ${ey}`}
        fill="none" stroke={sp.trunkColor} strokeWidth={sw} strokeLinecap="round" />
    ))}
    {clusters.map(([cx2, cy2, r], i) => (
      <g key={i}>
        <circle cx={cx2 + r * 0.2} cy={cy2 + r * 0.24} r={r * 0.82} fill={sp.leafDark} opacity="0.68" />
        <circle cx={cx2} cy={cy2} r={r} fill={`url(#${ids.leafGrad})`} opacity="0.96" />
        <circle cx={cx2 - r * 0.28} cy={cy2 - r * 0.3} r={r * 0.35} fill="white" opacity="0.14" />
      </g>
    ))}
    {hasFlowers && <circle cx={x} cy={cY - 44 * s} r={5.5} fill="#FFB7C5" />}
    {isDecember && clusters.map(([cx2, cy2, r], i) => (
      <ellipse key={i} cx={cx2} cy={cy2 - r * 0.7} rx={r * 0.55} ry={r * 0.2} fill="white" opacity="0.65" />
    ))}
  </g>;
}

function CherryBlossomFlower({ x, y, r = 4.5 }) {
  return <g>
    {/* Petal shadows */}
    {Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return <ellipse key={`sh${i}`}
        cx={x + Math.cos(a) * r * 0.72 + r * 0.08} cy={y + Math.sin(a) * r * 0.72 + r * 0.08}
        rx={r * 0.52} ry={r * 0.38}
        fill="#c97a8c" opacity="0.20"
        transform={`rotate(${i * 72},${x + Math.cos(a) * r * 0.72 + r * 0.08},${y + Math.sin(a) * r * 0.72 + r * 0.08})`} />;
    })}
    {/* Petals */}
    {Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r * 0.72;
      const py = y + Math.sin(a) * r * 0.72;
      return <g key={i}>
        <ellipse cx={px} cy={py} rx={r * 0.54} ry={r * 0.40}
          fill="#FFB7C5" opacity="0.96"
          transform={`rotate(${i * 72},${px},${py})`} />
        <ellipse cx={px - Math.cos(a) * r * 0.12} cy={py - Math.sin(a) * r * 0.12}
          rx={r * 0.22} ry={r * 0.16}
          fill="white" opacity="0.32"
          transform={`rotate(${i * 72},${px - Math.cos(a) * r * 0.12},${py - Math.sin(a) * r * 0.12})`} />
      </g>;
    })}
    {/* Stamens */}
    {Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2;
      return <line key={`st${i}`}
        x1={x} y1={y}
        x2={x + Math.cos(a) * r * 0.44} y2={y + Math.sin(a) * r * 0.44}
        stroke="#c97a8c" strokeWidth="0.7" strokeLinecap="round" opacity="0.70" />;
    })}
    <circle cx={x} cy={y} r={r * 0.30} fill="#FFF9C4" opacity="0.98" />
    <circle cx={x - r * 0.08} cy={y - r * 0.08} r={r * 0.12} fill="white" opacity="0.55" />
  </g>;
}

function FanTree({ sp, s, x, y, hasFlowers, isDecember, ids }) {
  const tH = 58 * s, tW = Math.max(4, 8 * s);
  const fW = 118 * s, fH = 60 * s;
  const tipY = y - tH;
  const isDragon = sp.id === 'dragon_blood';
  const isCherry = sp.id === 'cherry_blossom';
  const num = s > 0.65 ? 7 : s > 0.45 ? 5 : 3;

  return <g filter={`url(#${ids.softShadow})`}>
    <rect x={x - tW / 2} y={y - tH} width={tW} height={tH} rx={tW / 3} fill={`url(#${ids.trunkGrad})`} />
    {Array.from({ length: num }, (_, i) => {
      const t = num > 1 ? i / (num - 1) : 0.5;
      const ang = (-58 + t * 116) * Math.PI / 180;
      const bx = x + Math.cos(ang - Math.PI / 2) * fW * 0.52;
      const by = tipY + Math.sin(ang - Math.PI / 2) * fH * (isDragon ? 0.30 : 0.48);
      return <path key={i} d={`M${x} ${tipY} Q${(x + bx) / 2} ${tipY - 20 * s} ${bx} ${by}`}
        fill="none" stroke={sp.trunkColor} strokeWidth={Math.max(2.2, tW * 0.52)} strokeLinecap="round" />;
    })}
    {isDragon && <>
      <ellipse cx={x} cy={tipY - fH * 0.20} rx={fW * 0.60} ry={fH * 0.26} fill={sp.leafDark} opacity="0.88" />
      <ellipse cx={x} cy={tipY - fH * 0.30} rx={fW * 0.54} ry={fH * 0.40} fill={`url(#${ids.leafGrad})`} opacity="0.96" />
      <ellipse cx={x} cy={tipY - fH * 0.20} rx={fW * 0.50} ry={fH * 0.20} fill="rgba(0,0,0,0.20)" />
      <ellipse cx={x} cy={tipY - fH * 0.46} rx={fW * 0.38} ry={fH * 0.24} fill={`url(#${ids.leafGrad})`} opacity="0.82" />
      <ellipse cx={x} cy={tipY - fH * 0.54} rx={fW * 0.26} ry={fH * 0.14} fill="white" opacity="0.10" />
      {[[-0.3, 0], [0.3, 0], [0, -0.28]].map(([dx, dy], i) => (
        <circle key={i} cx={x + dx * fW * 0.42} cy={tipY - fH * 0.14 + dy * fH * 0.42} r={4.5} fill="#c62828" opacity="0.72" />
      ))}
    </>}
    {isCherry && <>
      <ellipse cx={x} cy={tipY - fH * 0.32} rx={fW * 0.52} ry={fH * 0.44} fill={`url(#${ids.leafGrad})`} opacity="0.75" />
      {s > 0.65 && <ellipse cx={x} cy={tipY - fH * 0.18} rx={fW * 0.44} ry={fH * 0.30} fill="rgba(255,255,255,0.12)" />}
      {Array.from({ length: Math.round(9 + s * 9) }, (_, i) => {
        const totalF = 9 + s * 9;
        const ang = (i / totalF) * Math.PI * 2;
        const rr = fW * (0.14 + ((i * 11) % 8) / 22 * 0.74) * 0.50;
        const fx = x + Math.cos(ang) * rr;
        const fy = (tipY - fH * 0.32) + Math.sin(ang) * rr * 0.70;
        return <CherryBlossomFlower key={i} x={fx} y={fy} r={3.8 + (i % 3) * 0.8} />;
      })}
    </>}
    {!isDragon && !isCherry && <>
      <ellipse cx={x} cy={tipY - fH * 0.32} rx={fW * 0.52} ry={fH * 0.42} fill={`url(#${ids.leafGrad})`} opacity="0.94" />
      {s > 0.65 && <ellipse cx={x} cy={tipY - fH * 0.18} rx={fW * 0.42} ry={fH * 0.30} fill="white" opacity="0.16" />}
    </>}
    {(hasFlowers && !isCherry) && [
      [-0.42, -0.8], [0.42, -0.8], [0, -0.5], [-0.62, -0.38], [0.62, -0.38]
    ].map(([dx, dy], i) => (
      <circle key={i} cx={x + dx * fW * 0.42} cy={tipY + dy * fH * 0.42} r={5} fill="#FFB7C5" opacity="0.97" />
    ))}
    {isDecember && !isDragon && <ellipse cx={x} cy={tipY - fH * 0.65} rx={fW * 0.3} ry={fH * 0.12} fill="white" opacity="0.75" />}
  </g>;
}

function LeafBezier({ cx, cy, size, angle, color, opacity = 0.76 }) {
  const s = size;
  return (
    <g transform={`rotate(${angle}, ${cx}, ${cy})`} opacity={opacity}>
      <path
        d={`M${cx},${cy - s * 0.97}
           C${cx + s * 0.50},${cy - s * 0.72}
            ${cx + s * 0.88},${cy - s * 0.05}
            ${cx + s * 0.26},${cy + s * 0.84}
           C${cx + s * 0.10},${cy + s * 0.96}
            ${cx - s * 0.10},${cy + s * 0.96}
            ${cx - s * 0.26},${cy + s * 0.84}
           C${cx - s * 0.88},${cy - s * 0.05}
            ${cx - s * 0.50},${cy - s * 0.72}
            ${cx},${cy - s * 0.97}Z`}
        fill={color}
      />
      <line x1={cx} y1={cy - s * 0.88} x2={cx} y2={cy + s * 0.88}
        stroke="rgba(255,255,255,0.26)" strokeWidth="0.75" strokeLinecap="round" />
      <line x1={cx} y1={cy - s * 0.28} x2={cx - s * 0.50} y2={cy + s * 0.14}
        stroke="rgba(255,255,255,0.16)" strokeWidth="0.5" strokeLinecap="round" />
      <line x1={cx} y1={cy - s * 0.28} x2={cx + s * 0.50} y2={cy + s * 0.14}
        stroke="rgba(255,255,255,0.16)" strokeWidth="0.5" strokeLinecap="round" />
      <line x1={cx} y1={cy + s * 0.15} x2={cx - s * 0.46} y2={cy + s * 0.52}
        stroke="rgba(255,255,255,0.13)" strokeWidth="0.5" strokeLinecap="round" />
      <line x1={cx} y1={cy + s * 0.15} x2={cx + s * 0.46} y2={cy + s * 0.52}
        stroke="rgba(255,255,255,0.13)" strokeWidth="0.5" strokeLinecap="round" />
      <path
        d={`M${cx},${cy - s * 0.88}
           C${cx - s * 0.14},${cy - s * 0.60}
            ${cx - s * 0.24},${cy - s * 0.08}
            ${cx - s * 0.06},${cy + s * 0.32}Z`}
        fill="rgba(255,255,255,0.12)"
      />
    </g>
  );
}

const SHAPE_MAP = {
  round: RoundTree, upright: UprightTree, drooping: DroopingTree,
  palm: PalmTree, bonsai: BonsaiTree, cactus: CactusTree,
  bamboo: BambooTree, baobab: BaobabTree, fan: FanTree,
  avocado: AvocadoTree,
};

export default function TreeSVG({
  species = 'oak', growthState = 3, decoration = 'none',
  potStyle = 'terracotta', background = 'day',
  hasFlowers = false, isDecember = false,
  width = 200, height = 280,
}) {
  const artId = useId().replace(/:/g, '');
  const ids = {
    softShadow: `tree-soft-shadow-${artId}`,
    leafGrad: `tree-leaf-grad-${artId}`,
    trunkGrad: `tree-trunk-grad-${artId}`,
    rainbowTrunk: `rainbow-trunk-${artId}`,
  };
  const sp = TREE_SPECIES.find(t => t.id === species) || TREE_SPECIES[0];
  const ShapeRenderer = SHAPE_MAP[sp.shape] || RoundTree;
  const s = GROWTH_SCALE[Math.max(1, Math.min(5, growthState))];
  const x = 100, potY = 225;
  const trunkH = 78 * s;
  const canopyR = 55 * s;

  return (
    <svg className="companion-art companion-tree-art" viewBox="0 0 200 280" width={width} height={height} xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
      <defs>
        <filter id={ids.softShadow} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#000000" floodOpacity="0.26" />
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.14" />
        </filter>
        <radialGradient id={ids.leafGrad} cx="30%" cy="22%" r="78%">
          <stop offset="0%" stopColor={adj(sp.leafColor, 70)} />
          <stop offset="16%" stopColor={adj(sp.leafColor, 42)} />
          <stop offset="44%" stopColor={sp.leafColor} />
          <stop offset="76%" stopColor={adj(sp.leafColor, -24)} />
          <stop offset="100%" stopColor={sp.leafDark || adj(sp.leafColor, -52)} />
        </radialGradient>
        <linearGradient id={ids.trunkGrad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={adj(sp.trunkColor, -45)} />
          <stop offset="16%" stopColor={adj(sp.trunkColor, -14)} />
          <stop offset="36%" stopColor={adj(sp.trunkColor, 36)} />
          <stop offset="62%" stopColor={adj(sp.trunkColor, 12)} />
          <stop offset="84%" stopColor={sp.trunkColor} />
          <stop offset="100%" stopColor={adj(sp.trunkColor, -40)} />
        </linearGradient>
      </defs>
      <Background bgId={background} artId={artId} />
      <ellipse cx="100" cy="234" rx="72" ry="18" fill="rgba(0,0,0,0.22)" />
      <ellipse cx="100" cy="234" rx="52" ry="11" fill="rgba(0,0,0,0.16)" />
      <Pot style={potStyle} x={x} y={potY} artId={artId} />
      <ShapeRenderer sp={sp} s={s} x={x} y={potY} hasFlowers={hasFlowers} isDecember={isDecember} ids={ids} />
      {decoration !== 'none' && s > 0.45 && (
        <Decoration type={decoration} x={x} y={potY} trunkH={trunkH} canopyR={canopyR} />
      )}
    </svg>
  );
}
