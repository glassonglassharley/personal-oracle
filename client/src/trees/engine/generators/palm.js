// Palms (coconut palm, banana): an unbranched stem topped by a crown of
// large compound leaves. Coconut fronds are pinnate (rachis + leaflets);
// banana leaves are broad paddles built along a curved midrib.

import { quadPoint, f } from '../geometry.js';
import { DEG, clamp01, easeOut, phase, dirOf, thin } from '../util.js';

export function buildPalm(sp, rng) {
  const banana = sp.variant === 'banana';
  const H = sp.height * rng.range(0.92, 1.06);
  const lean = (rng.chance(0.5) ? 1 : -1) * rng.range(banana ? 0.02 : 0.1, banana ? 0.06 : 0.22);
  const fronds = [];
  for (let i = 0; i < sp.fronds; i++) {
    const t = sp.fronds === 1 ? 0.5 : i / (sp.fronds - 1);
    const angle = (-150 + 300 * t + rng.bell() * 10) * DEG;
    const leaflets = [];
    if (!banana) {
      const n = 17;
      for (let k = 1; k <= n; k++) {
        for (const side of [-1, 1]) leaflets.push({ t: k / (n + 1), side, size: rng.range(0.85, 1.12), u: rng.next(), j: rng.next(), k: rng.next() });
      }
    }
    fronds.push({
      angle,
      len: sp.frondLen * rng.range(0.82, 1.08) * (banana ? 1 : 1 - 0.12 * Math.abs(t - 0.5)),
      // Upright (central) fronds are newest; they unfurl last.
      birth: 0.02 + 0.5 * (1 - Math.abs(t - 0.5) * 2) * rng.range(0.7, 1),
      arch: rng.range(0.7, 1.15),
      leaflets,
      tears: banana ? [rng.range(0.3, 0.5), rng.range(0.55, 0.8)] : [],
      u: rng.next(), j: rng.next(), k: rng.next(),
    });
  }
  fronds.sort((a, b) => Math.abs(b.angle) - Math.abs(a.angle));
  let total = fronds.reduce((s, fr) => s + fr.leaflets.length, 0);
  if (total > sp.maxLeaves) {
    for (const fr of fronds) fr.leaflets = thin(fr.leaflets, Math.floor(fr.leaflets.length * sp.maxLeaves / total));
    total = sp.maxLeaves;
  }
  const nuts = [];
  for (let i = 0; i < (banana ? 1 : 5); i++) nuts.push({ dx: rng.bell() * 0.9, dy: rng.range(0.1, 0.7), u: rng.next() * 0.9 });
  return { kind: 'palm', banana, H, lean, fronds, nuts };
}

function midrib(start, angle, len, arch) {
  // Leaf leaves the crown at `angle` and arcs toward the ground; sideways
  // leaves arch more than upright ones.
  const side = Math.sin(angle) >= 0 ? 1 : -1;
  const droop = (0.45 + 0.7 * Math.abs(Math.sin(angle))) * arch;
  const d0 = dirOf(angle);
  const a1 = angle + side * droop * 1.25;
  const d1 = dirOf(a1);
  const c = { x: start.x + d0.x * len * 0.55, y: start.y + d0.y * len * 0.55 };
  const e = { x: c.x + d1.x * len * 0.5, y: c.y + d1.y * len * 0.5 };
  return { c, e };
}

export function evaluatePalm(sp, topo, G) {
  const out = { wood: [], twigs: [], leaves: [], masses: [], flowers: [], fruits: [], extra: [], anchors: {} };
  const trunkM = phase(G, 0.1, 0.78);
  const Hn = topo.H * trunkM;
  const girth = 0.35 + 0.65 * easeOut(G / 0.9);
  const R = sp.trunkRadius * girth;
  const base = { x: 0, y: 0 };
  const top = { x: topo.lean * Hn, y: -Hn };
  const ctrl = { x: topo.lean * Hn * 0.1, y: -Hn * 0.55 };

  let crown = { x: 0, y: -2 };
  if (Hn > 2) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const p = quadPoint(base, ctrl, top, t);
      const bulge = topo.banana ? 1 - 0.18 * t : (t < 0.12 ? 1 + 0.5 * (1 - t / 0.12) ** 2 : 1 - 0.22 * t);
      pts.push({ x: p.x, y: p.y, r: Math.max(0.6, R * bulge) });
    }
    out.wood.push({ pts, depth: 0 });
    crown = top;
    // Leaf-scar rings across the trunk.
    let rings = '';
    const step = topo.banana ? 12 : 5.5;
    const n = Math.floor(Hn / step);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = quadPoint(base, ctrl, top, t);
      const q = quadPoint(base, ctrl, top, Math.min(1, t + 0.01));
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
      const r = pts[Math.min(9, Math.round(t * 9))].r * 0.95;
      const cx = Math.cos(ang) * r;
      const cy = Math.sin(ang) * r;
      rings += `M${f(p.x - cx)} ${f(p.y - cy)}Q${f(p.x)} ${f(p.y + 1.6)} ${f(p.x + cx)} ${f(p.y + cy)}`;
    }
    out.extra.push({ layer: 'scar', z: 34, d: rings, color: 'barkDark', opacity: 0.55, sway: 'wood', stroke: topo.banana ? 0.6 : 0.9 });
  }

  let massPts = 0;
  for (const fr of topo.fronds) {
    const m = phase(G, fr.birth, 0.42);
    if (m <= 0.02) continue;
    const len = fr.len * m * (Hn > 2 ? 1 : 0.55);
    // Seedlings hold their leaves upright; the arch develops with the crown.
    const angle = fr.angle * (0.45 + 0.55 * trunkM);
    const { c, e } = midrib(crown, angle, len, fr.arch * (0.4 + 0.6 * trunkM));
    if (topo.banana) {
      bananaLeaf(out, crown, c, e, len, fr);
    } else {
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const p = quadPoint(crown, c, e, t);
        pts.push({ x: p.x, y: p.y, r: Math.max(0.3, 1.3 * (1 - 0.75 * t) * (0.5 + 0.5 * m)) });
      }
      out.twigs.push({ pts });
      for (const lf of fr.leaflets) {
        if (lf.t > m + 0.1) continue;
        const p = quadPoint(crown, c, e, lf.t);
        const q = quadPoint(crown, c, e, Math.min(1, lf.t + 0.02));
        const tang = Math.atan2(q.y - p.y, q.x - p.x);
        const llen = len * 0.3 * Math.pow(Math.sin(Math.PI * Math.min(0.96, lf.t + 0.06)), 0.7) * lf.size;
        // Leaflets hang: rotate their angle toward straight down.
        let a = tang + lf.side * 1.05;
        const down = Math.PI / 2;
        a += (down - a) * 0.28 * (Math.abs(Math.sin(a)) < 0.9 ? 1 : 0);
        out.leaves.push({ x: p.x, y: p.y, a, len: Math.max(2, llen), w: 0.72, form: 'lance', u: lf.u, j: lf.j, k: lf.k, tip: lf.t > 0.7 });
      }
      massPts++;
    }
  }

  if (Hn > 12) {
    // Inflorescences hang just under the crown.
    for (const n of topo.nuts) out.flowers.push({ x: crown.x + n.dx * 7, y: crown.y + 6 + n.dy * 5, r: 3, a: 0, u: n.u });
  }
  if (!topo.banana && Hn > 20) {
    const r = sp.fruit.size * (0.6 + 0.4 * trunkM);
    for (const n of topo.nuts) {
      out.fruits.push({ x: crown.x + n.dx * r * 1.6, y: crown.y + r * (0.6 + n.dy * 1.4), r, a: 0, u: n.u, kind: 'coconut' });
    }
    out.masses.push({ x: crown.x, y: crown.y + 2, rx: sp.trunkRadius * 1.4 * trunkM, ry: sp.trunkRadius * 1.1 * trunkM });
  }
  if (topo.banana && Hn > 20) {
    // Hanging bunch: hands of bananas stacked under a purple bell.
    const u = topo.nuts[0].u;
    for (let i = 0; i < 5; i++) {
      out.fruits.push({ x: crown.x + 6 + (i % 2 ? 2 : -2), y: crown.y + 8 + i * 4.2, r: 3.4 - i * 0.25, a: (i % 2 ? 0.25 : -0.25), u, kind: 'banana' });
    }
    out.fruits.push({ x: crown.x + 6, y: crown.y + 31, r: 3.2, a: 0, u, kind: 'bell' });
  }

  out.anchors.trunkTop = { x: crown.x, y: crown.y };
  out.anchors.limb = { x: crown.x + (topo.lean >= 0 ? 16 : -16) * trunkM, y: crown.y + 10 };
  out.stats = { branches: out.wood.length + out.twigs.length };
  return out;
}

function bananaLeaf(out, s, c, e, len, fr) {
  // Blade built along the midrib; the two halves become separate "leaves"
  // entries so they pick up different light tones.
  const N = 9;
  const mid = [];
  for (let i = 0; i <= N; i++) mid.push(quadPoint(s, c, e, i / N));
  const W = len * 0.2;
  const half = sideSign => {
    let d = `M${f(mid[1].x)} ${f(mid[1].y)}`;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const a = mid[Math.max(0, i - 1)];
      const b = mid[Math.min(N, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const nx = (-dy / l) * sideSign;
      const ny = (dx / l) * sideSign;
      let w = W * Math.pow(Math.sin(Math.PI * clamp01(t * 0.98 + 0.02)), 0.55);
      if (fr.tears.some(tt => Math.abs(tt - t) < 0.04) && sideSign > 0) w *= 0.35;
      d += `L${f(mid[i].x + nx * w)} ${f(mid[i].y + ny * w)}`;
    }
    for (let i = N; i >= 1; i--) d += `L${f(mid[i].x)} ${f(mid[i].y)}`;
    return `${d}Z`;
  };
  out.leaves.push({ raw: half(-1), x: c.x, y: c.y - 6, u: fr.u, j: 0.95, k: fr.k, tip: false, len });
  out.leaves.push({ raw: half(1), x: c.x, y: c.y + 6, u: fr.u, j: 0.15, k: fr.k, tip: false, len });
  let rib = '';
  for (let i = 1; i <= N; i++) rib += `${i === 1 ? 'M' : 'L'}${f(mid[i].x)} ${f(mid[i].y)}`;
  out.extra.push({ layer: 'midrib', z: 47, d: rib, color: 'highlight', opacity: 0.7, sway: 'leaf', stroke: 0.9, vital: true });
}
