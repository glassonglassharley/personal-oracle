// Bamboo: a clump of segmented culms. The centre culm sprouts first and
// the clump widens as new culms emerge; each culm carries leafy sprays at
// its upper nodes.

import { quadPoint, f } from '../geometry.js';
import { DEG, phase, easeOut, thin } from '../util.js';

export function buildBamboo(sp, rng) {
  const K = rng.int(5, 7);
  const culms = [];
  for (let i = 0; i < K; i++) {
    const rel = K === 1 ? 0 : (i - (K - 1) / 2) / ((K - 1) / 2);
    const sprays = [];
    const nodes = Math.floor(sp.height / sp.nodeGap);
    let side = rng.chance(0.5) ? 1 : -1;
    for (let k = 2; k < nodes; k++) {
      const hf = k / nodes;
      if (hf < 0.4) continue;
      const leaves = [];
      const n = rng.int(3, 4);
      for (let j = 0; j < n; j++) leaves.push({ a: (95 + j * 22 + rng.bell() * 10) * DEG, size: rng.range(0.8, 1.15), u: rng.next(), j: rng.next(), k: rng.next() });
      sprays.push({ hf, side, twig: rng.range(7, 12) * (1.2 - hf * 0.4), angle: side * rng.range(50, 68) * DEG, leaves });
      side = -side;
    }
    culms.push({
      x: rel * 17 + rng.bell() * 2.5,
      H: sp.height * (1 - 0.34 * Math.abs(rel)) * rng.range(0.86, 1.04),
      r: sp.radius * rng.range(0.85, 1.08) * (1 - 0.2 * Math.abs(rel)),
      lean: rel * 0.14 + rng.bell() * 0.03,
      birth: 0.55 * Math.abs(rel) * rng.range(0.75, 1),
      sprays,
    });
  }
  culms.sort((a, b) => b.birth - a.birth);
  const total = culms.reduce((s, c) => s + c.sprays.reduce((a, sp2) => a + sp2.leaves.length, 0), 0);
  if (total > sp.maxLeaves) {
    for (const c of culms) for (const s of c.sprays) s.leaves = thin(s.leaves, Math.max(2, Math.floor(s.leaves.length * sp.maxLeaves / total)));
  }
  return { kind: 'bamboo', culms };
}

export function evaluateBamboo(sp, topo, G) {
  const out = { wood: [], twigs: [], leaves: [], masses: [], flowers: [], fruits: [], extra: [], anchors: {} };
  let nodes = '';
  let nodeLight = '';
  let tallest = null;
  for (const c of topo.culms) {
    const m = phase(G, c.birth, 0.42);
    if (m <= 0.02) continue;
    const Hn = c.H * m;
    const base = { x: c.x, y: 0 };
    const top = { x: c.x + c.lean * Hn, y: -Hn };
    const ctrl = { x: c.x + c.lean * Hn * 0.2, y: -Hn * 0.5 };
    const r = c.r * (0.45 + 0.55 * easeOut(G / 0.9));
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const p = quadPoint(base, ctrl, top, t);
      pts.push({ x: p.x, y: p.y, r: Math.max(0.5, r * (1 - 0.35 * t)) });
    }
    out.wood.push({ pts, depth: 0 });
    if (!tallest || Hn > tallest.Hn) tallest = { Hn, top };
    const gap = sp.nodeGap * (0.4 + 0.6 * m);
    for (let y = gap; y < Hn - 3; y += gap) {
      const t = y / Hn;
      const p = quadPoint(base, ctrl, top, t);
      const rr = r * (1 - 0.35 * t);
      nodes += `M${f(p.x - rr)} ${f(p.y)}L${f(p.x + rr)} ${f(p.y)}`;
      nodeLight += `M${f(p.x - rr * 0.8)} ${f(p.y - 1.1)}L${f(p.x + rr * 0.2)} ${f(p.y - 1.1)}`;
    }
    for (const s of c.sprays) {
      if (s.hf * c.H > Hn - 2) continue;
      const p = quadPoint(base, ctrl, top, (s.hf * c.H) / Hn);
      const tm = Math.min(1, (Hn - s.hf * c.H) / 20);
      const tl = s.twig * tm;
      const e = { x: p.x + Math.sin(s.angle) * tl, y: p.y - Math.cos(s.angle) * tl };
      out.twigs.push({ pts: [{ x: p.x, y: p.y, r: 0.6 }, { x: e.x, y: e.y, r: 0.3 }] });
      if (s.leaves[0]) out.flowers.push({ x: e.x, y: e.y + 3, r: 2.6, a: 0, u: s.leaves[0].k });
      for (const lf of s.leaves) {
        const a = s.side > 0 ? lf.a - Math.PI / 2 : Math.PI / 2 - lf.a + Math.PI;
        out.leaves.push({ x: e.x, y: e.y, a, len: 13 * lf.size * (0.5 + 0.5 * tm), w: 1.25, form: 'lance', u: lf.u, j: lf.j, k: lf.k, tip: s.hf > 0.8 });
      }
    }
  }
  out.extra.push({ layer: 'node', z: 34, d: nodes, color: 'barkDark', opacity: 0.8, sway: 'wood', stroke: 1.1 });
  out.extra.push({ layer: 'nodeLight', z: 35, d: nodeLight, color: 'barkLight', opacity: 0.7, sway: 'wood', stroke: 0.7 });
  out.anchors.trunkTop = tallest ? { x: tallest.top.x, y: tallest.top.y } : { x: 0, y: 0 };
  out.anchors.limb = { x: 22, y: -(tallest?.Hn || 40) * 0.55 };
  out.stats = { branches: out.wood.length + out.twigs.length };
  return out;
}
