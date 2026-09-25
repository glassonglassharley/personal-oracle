// Low-level SVG geometry. All output is plain path data in tree space:
// origin at the base of the trunk, +y down (so the tree grows into -y).

// One-decimal formatter. Integer-to-string is several times faster than
// float-to-string, and this runs tens of thousands of times per tree.
export function f(n) {
  let v = Math.round(n * 10);
  if (v === 0) return '0';
  let sign = '';
  if (v < 0) { sign = '-'; v = -v; }
  const whole = (v / 10) | 0;
  const frac = v - whole * 10;
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

export function circle(cx, cy, r) {
  if (r <= 0.05) return '';
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

export function ellipse(cx, cy, rx, ry, angle = 0) {
  if (rx <= 0.05 || ry <= 0.05) return '';
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x0 = cx - rx * c;
  const y0 = cy - rx * s;
  const deg = f((angle * 180) / Math.PI);
  return `M${f(x0)} ${f(y0)}a${f(rx)} ${f(ry)} ${deg} 1 0 ${f(2 * rx * c)} ${f(2 * rx * s)}a${f(rx)} ${f(ry)} ${deg} 1 0 ${f(-2 * rx * c)} ${f(-2 * rx * s)}Z`;
}

export function quadPoint(p0, c, p1, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

// Tapered tube along a polyline of {x, y, r}. Returns { body, shade, light }
// path strings: the full silhouette, a darker strip on the side facing away
// from the light (light comes from the upper left), and a thin highlight.
export function tube(pts, { cap = true, shadeSide = 1 } = {}) {
  const n = pts.length;
  if (n < 2) return { body: '', shade: '', light: '' };
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  // Normal points to the right of travel direction; for an upward branch that
  // is screen-right, which is the shadowed side.
  const left = pts.map((p, i) => ({ x: p.x - normals[i].x * p.r, y: p.y - normals[i].y * p.r }));
  const right = pts.map((p, i) => ({ x: p.x + normals[i].x * p.r, y: p.y + normals[i].y * p.r }));

  const tip = pts[n - 1];
  const prev = pts[n - 2];
  const tdx = tip.x - prev.x;
  const tdy = tip.y - prev.y;
  const tl = Math.hypot(tdx, tdy) || 1;
  const capPt = { x: tip.x + (tdx / tl) * tip.r * 1.1, y: tip.y + (tdy / tl) * tip.r * 1.1 };

  let body = `M${f(left[0].x)} ${f(left[0].y)}`;
  for (let i = 1; i < n; i++) body += `L${f(left[i].x)} ${f(left[i].y)}`;
  if (cap) body += `Q${f(capPt.x)} ${f(capPt.y)} ${f(right[n - 1].x)} ${f(right[n - 1].y)}`;
  else body += `L${f(right[n - 1].x)} ${f(right[n - 1].y)}`;
  for (let i = n - 2; i >= 0; i--) body += `L${f(right[i].x)} ${f(right[i].y)}`;
  body += 'Z';

  const side = shadeSide >= 0 ? right : left;
  const sign = shadeSide >= 0 ? 1 : -1;
  const inner = pts.map((p, i) => ({ x: p.x + sign * normals[i].x * p.r * 0.15, y: p.y + sign * normals[i].y * p.r * 0.15 }));
  let shade = `M${f(inner[0].x)} ${f(inner[0].y)}`;
  for (let i = 1; i < n; i++) shade += `L${f(inner[i].x)} ${f(inner[i].y)}`;
  for (let i = n - 1; i >= 0; i--) shade += `L${f(side[i].x)} ${f(side[i].y)}`;
  shade += 'Z';

  const lo = pts.map((p, i) => ({ x: p.x - sign * normals[i].x * p.r * 0.78, y: p.y - sign * normals[i].y * p.r * 0.78 }));
  const li = pts.map((p, i) => ({ x: p.x - sign * normals[i].x * p.r * 0.5, y: p.y - sign * normals[i].y * p.r * 0.5 }));
  let light = '';
  if (pts[0].r > 1.2) {
    light = `M${f(lo[0].x)} ${f(lo[0].y)}`;
    for (let i = 1; i < n - 1; i++) light += `L${f(lo[i].x)} ${f(lo[i].y)}`;
    for (let i = n - 2; i >= 0; i--) light += `L${f(li[i].x)} ${f(li[i].y)}`;
    light += 'Z';
  }
  return { body, shade, light };
}

// Leaf templates: unit length along +x, petiole at the origin.
// Each command is [op, ...coords]; coords are (x, y) pairs.
export const LEAF_TEMPLATES = {
  oval: [['M', 0, 0], ['C', 0.22, -0.34, 0.72, -0.36, 1, 0], ['C', 0.72, 0.36, 0.22, 0.34, 0, 0]],
  broad: [['M', 0, 0], ['C', 0.18, -0.46, 0.7, -0.5, 1, 0], ['C', 0.7, 0.5, 0.18, 0.46, 0, 0]],
  lance: [['M', 0, 0], ['C', 0.25, -0.16, 0.7, -0.14, 1, 0], ['C', 0.7, 0.14, 0.25, 0.16, 0, 0]],
  needle: [['M', 0, 0], ['C', 0.3, -0.07, 0.7, -0.06, 1, 0], ['C', 0.7, 0.06, 0.3, 0.07, 0, 0]],
  sickle: [['M', 0, 0], ['C', 0.3, -0.24, 0.72, -0.22, 1, 0.12], ['C', 0.68, -0.02, 0.3, 0.06, 0, 0]],
  oak: [
    ['M', 0, 0],
    ['Q', 0.16, -0.3, 0.36, -0.2], ['Q', 0.56, -0.38, 0.72, -0.18], ['Q', 1.04, -0.14, 1, 0],
    ['Q', 1.04, 0.14, 0.72, 0.18], ['Q', 0.56, 0.38, 0.36, 0.2], ['Q', 0.16, 0.3, 0, 0],
  ],
  maple: [
    ['M', 0, 0], ['L', 0.3, -0.1], ['L', 0.22, -0.46], ['L', 0.46, -0.3], ['L', 0.58, -0.52],
    ['L', 0.68, -0.18], ['L', 1, 0], ['L', 0.68, 0.18], ['L', 0.58, 0.52], ['L', 0.46, 0.3],
    ['L', 0.22, 0.46], ['L', 0.3, 0.1], ['L', 0, 0],
  ],
  paddle: [['M', 0, 0], ['C', 0.08, -0.3, 0.75, -0.34, 1, -0.02], ['C', 0.75, 0.28, 0.08, 0.26, 0, 0]],
  // Conifer spray: smooth top edge, needle-serrated underside.
  bough: [
    ['M', 0, 0], ['C', 0.3, -0.2, 0.72, -0.22, 1, -0.02],
    ['L', 0.9, 0.06], ['L', 0.93, 0.14], ['L', 0.8, 0.12], ['L', 0.78, 0.24], ['L', 0.64, 0.16],
    ['L', 0.58, 0.28], ['L', 0.46, 0.18], ['L', 0.38, 0.28], ['L', 0.28, 0.16], ['L', 0.16, 0.22],
    ['L', 0.1, 0.08], ['L', 0, 0],
  ],
};

export function stamp(template, x, y, angle, len, width = 1) {
  const c = Math.cos(angle) * len;
  const s = Math.sin(angle) * len;
  const ws = width * s;
  const wc = width * c;
  let d = '';
  for (let k = 0; k < template.length; k++) {
    const cmd = template[k];
    d += cmd[0];
    for (let i = 1; i < cmd.length; i += 2) {
      const u = cmd[i];
      const v = cmd[i + 1];
      if (i > 1) d += ' ';
      d += `${f(x + u * c - v * ws)} ${f(y + u * s + v * wc)}`;
    }
  }
  return `${d}Z`;
}

// Five-petal flower centred on (x, y): one closed path whose quadratic
// segments bulge out into rounded petals between shallow notches.
export function flower(x, y, r, angle = 0, petals = 5) {
  const step = (Math.PI * 2) / petals;
  const notch = r * 0.28;
  const reach = r * 1.55;
  let d = `M${f(x + Math.cos(angle) * notch)} ${f(y + Math.sin(angle) * notch)}`;
  for (let i = 0; i < petals; i++) {
    const a0 = angle + i * step;
    const mid = a0 + step / 2;
    const a1 = a0 + step;
    d += `Q${f(x + Math.cos(mid) * reach)} ${f(y + Math.sin(mid) * reach)} ${f(x + Math.cos(a1) * notch)} ${f(y + Math.sin(a1) * notch)}`;
  }
  return `${d}Z`;
}
