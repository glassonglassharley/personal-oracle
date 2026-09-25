// Decorations hang off the generated tree's real anchor points, in tree
// space, so they move with the tree and stay attached as it grows.

const LIGHTS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BFF', '#FF9F43'];

export default function Decoration({ type, tree }) {
  if (!type || type === 'none' || !tree) return null;
  const { anchors, bounds } = tree;
  const top = anchors.trunkTop || { x: 0, y: -60 };
  const limb = anchors.limb || { x: 20, y: top.y + 10 };

  if (type === 'fairy_lights') {
    const y0 = (bounds.minY + top.y) / 2 + 6;
    const x0 = bounds.minX * 0.72;
    const x1 = bounds.maxX * 0.72;
    const swags = 3;
    const w = (x1 - x0) / swags;
    let d = `M${x0} ${y0}`;
    const bulbs = [];
    let ys = y0;
    for (let i = 0; i < swags; i++) {
      const a = x0 + i * w;
      const ye = y0 + (i % 2 ? -6 : 4);
      const cy = Math.max(ys, ye) + 12;
      d += ` Q${a + w / 2} ${cy} ${a + w} ${ye}`;
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const by = (1 - t) * (1 - t) * ys + 2 * (1 - t) * t * cy + t * t * ye;
        bulbs.push({ x: a + w * t, y: by + 1.5, c: LIGHTS[(i * 3 + k) % LIGHTS.length] });
      }
      ys = ye;
    }
    return (
      <g className="tree-deco">
        <path d={d} fill="none" stroke="#3b3b2e" strokeWidth="0.7" opacity="0.8" />
        {bulbs.map((b, i) => (
          <g key={i}>
            <circle cx={b.x} cy={b.y} r="5" fill={b.c} opacity="0.18" />
            <circle cx={b.x} cy={b.y} r="2.2" fill={b.c} />
          </g>
        ))}
      </g>
    );
  }

  if (type === 'tire_swing') {
    const drop = Math.min(38, Math.max(18, -limb.y - 14));
    return (
      <g className="tree-deco">
        <line x1={limb.x} y1={limb.y} x2={limb.x} y2={limb.y + drop} stroke="#5d4037" strokeWidth="1.4" />
        <ellipse cx={limb.x} cy={limb.y + drop + 5} rx="8" ry="5.5" fill="none" stroke="#1f1f1f" strokeWidth="4" />
        <ellipse cx={limb.x - 1} cy={limb.y + drop + 4} rx="7" ry="4.5" fill="none" stroke="#4a4a4a" strokeWidth="1" />
      </g>
    );
  }

  if (type === 'treehouse') {
    const x = top.x;
    const y = top.y + 4;
    return (
      <g className="tree-deco">
        <rect x={x - 14} y={y - 2} width="28" height="3" fill="#6d4c41" />
        <rect x={x - 11} y={y - 18} width="22" height="16" fill="#8d6e63" rx="1.5" />
        <polygon points={`${x - 14},${y - 18} ${x},${y - 30} ${x + 14},${y - 18}`} fill="#a1453a" />
        <rect x={x - 3.5} y={y - 13} width="7" height="7" fill="#FFE082" />
      </g>
    );
  }

  if (type === 'birds_nest') {
    const x = limb.x * 0.6 + top.x * 0.4;
    const y = limb.y * 0.6 + top.y * 0.4 - 2;
    return (
      <g className="tree-deco">
        <path d={`M${x - 8} ${y} Q${x} ${y + 7} ${x + 8} ${y}Z`} fill="#8d6e63" />
        <path d={`M${x - 8} ${y} Q${x} ${y + 4} ${x + 8} ${y}`} fill="none" stroke="#a1887f" strokeWidth="1.2" />
        {[-3.5, 0, 3.5].map((dx, i) => <ellipse key={i} cx={x + dx} cy={y - 0.8} rx="2" ry="2.4" fill={i === 1 ? '#d7e9f0' : '#b9d4de'} />)}
      </g>
    );
  }

  if (type === 'hammock') {
    const y = limb.y + 6;
    const xa = top.x;
    const xb = limb.x;
    return (
      <g className="tree-deco">
        <line x1={xa} y1={y - 6} x2={xa} y2={y} stroke="#5d4037" strokeWidth="1" />
        <line x1={xb} y1={limb.y} x2={xb} y2={y} stroke="#5d4037" strokeWidth="1" />
        <path d={`M${xa} ${y} Q${(xa + xb) / 2} ${y + 14} ${xb} ${y}`} fill="none" stroke="#F57F17" strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}
