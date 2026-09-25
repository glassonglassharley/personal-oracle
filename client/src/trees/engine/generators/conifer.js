// Conifers (pine, redwood): a single excurrent trunk with whorls of branches.
// Whorl i is born when the trunk first reaches its height, so the crown
// fills in from the bottom and the triangular silhouette emerges on its own.

import { quadPoint } from '../geometry.js';
import { DEG, easeOut, phase, dirOf, thin } from '../util.js';

const TRUNK_DUR = 0.82;

function trunkBirthAt(hf) {
  // Inverse of easeOut: when does trunk length reach fraction hf of H?
  return TRUNK_DUR * (1 - Math.sqrt(Math.max(0, 1 - hf)));
}

export function buildConifer(sp, rng) {
  const H = sp.height * rng.range(0.93, 1.05);
  const lean = rng.bell() * 0.035;
  const whorls = [];
  for (let i = 0; i < sp.whorls; i++) {
    const hf = sp.bare + (1 - sp.bare) * ((i + 0.35 + rng.range(-0.15, 0.15)) / sp.whorls);
    if (hf > 0.97) continue;
    const reach = sp.spread * Math.pow(1 - hf, sp.shapePow) * rng.range(0.82, 1.14) + sp.minLen;
    const branches = [];
    const sides = [-1, 1];
    if (rng.chance(0.6)) sides.push(rng.chance(0.5) ? -0.35 : 0.35);
    for (const s of sides) {
      const angle = Math.sign(s) * (sp.branchAngle + rng.bell() * 10) * DEG;
      const len = reach * Math.abs(s) ** 0.5 * rng.range(0.85, 1.1);
      const pads = [];
      const nPads = Math.max(3, Math.round(len / 6));
      for (let k = 0; k < nPads; k++) {
        pads.push({ t: 0.25 + 0.75 * (k / Math.max(1, nPads - 1)), size: rng.range(0.85, 1.15), u: rng.next(), j: rng.next(), k: rng.next(), off: rng.bell() * 0.3 });
      }
      branches.push({ angle, len, pads, curl: -Math.sign(s) * sp.tipUp * DEG * rng.range(0.6, 1.3), cone: rng.next(), coneU: rng.next() });
    }
    whorls.push({ hf, birth: trunkBirthAt(hf) + 0.015, branches });
  }
  const top = [];
  for (let k = 0; k < 5; k++) top.push({ a: (-90 + (k - 2) * 24 + rng.bell() * 6) * DEG, size: rng.range(0.8, 1.1), u: rng.next() * 0.25, j: rng.next(), k: rng.next() });
  const totalPads = whorls.reduce((s, w) => s + w.branches.reduce((a, b) => a + b.pads.length, 0), 0);
  if (totalPads > sp.maxLeaves) {
    for (const w of whorls) for (const b of w.branches) b.pads = thin(b.pads, Math.max(2, Math.floor(b.pads.length * sp.maxLeaves / totalPads)));
  }
  return { kind: 'conifer', H, lean, whorls, top };
}

export function evaluateConifer(sp, topo, G) {
  const out = { wood: [], twigs: [], leaves: [], masses: [], flowers: [], fruits: [], extra: [], snow: [], anchors: {} };
  const Hn = topo.H * easeOut(G / TRUNK_DUR);
  const girth = 0.2 + 0.8 * easeOut(G / 1.05);
  const R = sp.trunkRadius * girth;
  const base = { x: 0, y: 0 };
  const topPt = { x: topo.lean * Hn, y: -Hn };
  const ctrl = { x: topo.lean * Hn * 0.2, y: -Hn * 0.5 };
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const p = quadPoint(base, ctrl, topPt, t);
    const flare = t < 0.1 ? 1 + 0.4 * (1 - t / 0.1) ** 2 : 1;
    pts.push({ x: p.x, y: p.y, r: Math.max(0.35, R * (1 - 0.92 * t) * flare) });
  }
  out.wood.push({ pts, depth: 0 });

  if (sp.fissures && R > 2) {
    let d = '';
    for (const o of [-0.45, 0, 0.42]) {
      for (let i = 0; i < 7; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        d += `M${(a.x + a.r * o).toFixed(1)} ${a.y.toFixed(1)}L${(b.x + b.r * o).toFixed(1)} ${b.y.toFixed(1)}`;
      }
    }
    out.extra.push({ layer: 'fissure', z: 34, d, color: 'barkDark', opacity: 0.55, sway: 'wood', stroke: 0.9 });
  }

  const trunkAt = hf => {
    const t = Math.min(1, (hf * topo.H) / Math.max(1, Hn));
    const p = quadPoint(base, ctrl, topPt, t);
    return { p, r: Math.max(0.35, R * (1 - 0.92 * t)) };
  };

  for (const w of topo.whorls) {
    const m = phase(G, w.birth, 0.36);
    if (m <= 0.01 || w.hf * topo.H > Hn) continue;
    const { p: start, r: tr } = trunkAt(w.hf);
    for (const br of w.branches) {
      const len = br.len * m;
      const a1 = br.angle + br.curl * m;
      const d0 = dirOf(br.angle);
      const d1 = dirOf(a1);
      const c = { x: start.x + d0.x * len * 0.5, y: start.y + d0.y * len * 0.5 };
      const end = { x: c.x + d1.x * len * 0.5, y: c.y + d1.y * len * 0.5 };
      const bpts = [];
      for (let i = 0; i < 3; i++) {
        const t = i / 2;
        const p = quadPoint(start, c, end, t);
        bpts.push({ x: p.x, y: p.y, r: Math.max(0.3, Math.min(tr * 0.6, 2.2 * m) * (1 - 0.7 * t)) });
      }
      out.wood.push({ pts: bpts, depth: 1, limb: true });
      for (const pad of br.pads) {
        if (pad.t > m + 0.05) continue;
        const p = quadPoint(start, c, end, Math.min(1, pad.t));
        const q = quadPoint(start, c, end, Math.min(1, pad.t + 0.05));
        const tang = Math.atan2(q.y - p.y, q.x - p.x);
        const plen = Math.max(6, len * 0.58) * pad.size;
        const toward = Math.cos(tang) >= 0 ? 1 : -1;
        out.leaves.push({
          x: p.x - Math.cos(tang) * plen * 0.45, y: p.y + pad.off * 4,
          a: tang + toward * (0.1 + pad.off * 0.35), len: plen, w: sp.boughWidth * 3.1,
          form: 'bough', u: pad.u, j: pad.j, k: pad.k, tip: pad.t > 0.75,
        });
        if (pad.t > 0.5 && pad.j > 0.72) out.snow.push({ x: p.x, y: p.y - plen * 0.1, rx: plen * 0.3 });
        if (pad.t > 0.8) out.flowers.push({ x: p.x + Math.cos(tang) * plen * 0.3, y: p.y - 1, r: 3.2, a: 0, u: pad.k });
      }
      if (m > 0.8 && sp.fruit) {
        const p = quadPoint(start, c, end, 0.55 + br.cone * 0.35);
        out.fruits.push({ x: p.x, y: p.y + 2.5, r: sp.fruit.size, a: 0, u: br.coneU, kind: sp.fruit.kind });
      }
    }
    // Backing silhouette so the tiers read as a solid cone, not a lattice.
    const reachNow = Math.max(...w.branches.map(b => b.len)) * m;
    out.masses.push({ x: start.x, y: start.y + 3, rx: reachNow * 0.72, ry: Math.max(3.5, reachNow * 0.36) });
  }

  // Leader tuft at the crown tip.
  const tipLen = Math.max(7, 12 * easeOut(G * 1.6));
  for (const t of topo.top) {
    out.leaves.push({ x: topPt.x, y: topPt.y + tipLen * 0.25, a: t.a, len: tipLen * t.size, w: sp.boughWidth * 1.6, form: 'bough', u: t.u, j: t.j, k: t.k, tip: true });
  }
  out.snow.push({ x: topPt.x, y: topPt.y + 1, rx: tipLen * 0.3 });

  out.anchors.trunkTop = { x: topPt.x, y: topPt.y };
  const low = topo.whorls.find(w => w.hf * topo.H <= Hn && phase(G, w.birth, 0.36) > 0.5);
  if (low) {
    const { p } = trunkAt(low.hf);
    out.anchors.limb = { x: p.x + low.branches[0].len * 0.4 * Math.sign(Math.sin(low.branches[0].angle)), y: p.y + 3 };
  }
  out.stats = { branches: out.wood.length };
  return out;
}
