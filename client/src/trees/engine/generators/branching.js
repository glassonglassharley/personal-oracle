// Parametric recursive branching with per-branch birth times.
//
// Topology (every random decision) is made once per (species, seed) for the
// fully grown tree. Evaluation at growth G only reads it: a branch's length
// is len * ease((G - birth) / dur), so nothing can shrink as G rises and new
// branches, leaves and fruit appear continuously instead of in stages.

import { quadPoint } from '../geometry.js';
import { DEG, clamp01, easeOut, phase, dirOf, thin } from '../util.js';

function profile(sp, b, t) {
  let r = 1 - t * (1 - sp.taper);
  if (b.depth === 0) {
    if (sp.trunk.profile === 'bottle') {
      r = (0.72 + 0.5 * Math.sin(Math.PI * (0.1 + 0.75 * t))) * (1 - 0.38 * t);
    }
    const flare = sp.trunk.flare || 1;
    if (t < 0.14) r *= 1 + (flare - 1) * (1 - t / 0.14) ** 2;
  }
  return r;
}

export function buildBranching(sp, rng) {
  const branches = [];
  const T = sp.trunk;
  const trunk = {
    id: 0, parent: -1, depth: 0, pos: 0,
    angle: rng.bell() * T.lean,
    curl: rng.bell() * T.bend * 0.8,
    bend: rng.bell() * T.bend,
    len: T.len * rng.range(0.93, 1.07),
    r0: T.radius * rng.range(0.94, 1.06),
    birth: 0, dur: T.dur,
    terminal: true,
  };
  branches.push(trunk);

  const queue = [trunk];
  while (queue.length) {
    const b = queue.shift();
    if (b.depth >= sp.maxDepth) continue;
    const [kmin, kmax] = sp.kids[b.depth] || [1, 2];
    const n = rng.int(kmin, kmax);
    const childDepth = b.depth + 1;
    const positions = [];
    for (let k = 0; k < n; k++) {
      if (sp.forks) positions.push(1);
      else if (b.depth === 0) positions.push(rng.range(sp.crownStart, 0.97));
      else positions.push(rng.range(0.32, 0.96));
    }
    positions.sort((x, y) => x - y);
    let side = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < n; k++) {
      if (branches.length >= sp.maxBranches) break;
      const pos = positions[k];
      const leader = sp.leader && !sp.forks && k === n - 1;
      let spread;
      if (leader) spread = rng.bell() * 10 * DEG;
      else spread = side * (sp.spread[childDepth] + rng.bell() * sp.spreadSd) * DEG;
      side = -side;
      let angle = b.angle + spread + rng.bell() * sp.crooked * 0.4;
      angle *= 1 - sp.upPull;
      const lr = leader ? 0.74 : sp.lenRatio[childDepth];
      const lowBoost = b.depth === 0 && !sp.forks ? 1.08 - 0.28 * pos : 1;
      const len = b.len * lr * rng.range(0.84, 1.1) * lowBoost;
      const parentR = b.r0 * profile(sp, b, pos);
      const r0 = Math.min(parentR * 0.84, b.r0 * sp.radRatio * rng.range(0.88, 1.05));
      const birth = Math.min(0.86, b.birth + b.dur * (0.05 + 0.3 * pos) + rng.range(0, 0.03));
      const curlSign = angle >= 0 ? -1 : 1;
      const child = {
        id: branches.length, parent: b.id, depth: childDepth, pos,
        angle,
        curl: curlSign * sp.curl * DEG * rng.range(0.6, 1.3) + rng.bell() * sp.crooked * 0.5,
        bend: rng.bell() * sp.crooked,
        len, r0,
        birth, dur: Math.max(0.24, b.dur * 0.84),
        terminal: true,
      };
      b.terminal = false;
      branches.push(child);
      queue.push(child);
    }
  }

  // Foliage clusters.
  const L = sp.leaf;
  let leaves = [];
  const clusters = [];
  const strands = [];
  for (const b of branches) {
    const mature = b.depth >= L.depthMin || (b.terminal && L.perCluster > 0 && b.depth >= Math.min(L.depthMin, sp.maxDepth));
    const specs = [];
    if (mature && L.perCluster > 0) {
      const [cmin, cmax] = L.clusters;
      const count = rng.int(cmin, cmax);
      for (let i = 0; i < count; i++) specs.push({ pos: count === 1 ? 1 : 0.55 + 0.45 * (i / (count - 1)), scale: 1, n: L.perCluster });
    } else if (L.perCluster > 0 || sp.pendulous) {
      // Juvenile tip leaves: what a young tree wears before its crown exists.
      specs.push({ pos: 1, scale: 0.75, n: b.depth === 0 ? 6 : 4, juvenile: true });
    }
    for (const s of specs) {
      const c = {
        branch: b.id, pos: s.pos, scale: s.scale, juvenile: !!s.juvenile,
        tip: b.terminal && s.pos > 0.8,
        birth: b.birth + b.dur * (s.juvenile ? 0.05 : 0.35 * s.pos),
        fruit: !s.juvenile && sp.fruit && sp.fruit.kind !== 'none' && rng.chance(sp.fruit.chance)
          ? { u: rng.next(), a: rng.bell() * 0.4, dx: rng.bell() * 0.4 } : null,
        flowers: s.juvenile ? [] : [{ u: rng.next(), ox: rng.bell(), oy: rng.bell(), a: rng.next() * 6.28 }],
      };
      clusters.push(c);
      const shape = s.juvenile ? 'scatter' : L.shape;
      for (let i = 0; i < s.n; i++) {
        let ox;
        let oy;
        let ang;
        if (shape === 'rosette') {
          ang = (-90 + (i / Math.max(1, s.n - 1) - 0.5) * 200 + rng.bell() * 12) * DEG;
          ox = 0;
          oy = 0;
        } else {
          const rr = Math.sqrt(rng.next());
          const th = rng.next() * Math.PI * 2;
          ox = Math.cos(th) * rr;
          oy = Math.sin(th) * rr * (shape === 'pad' ? 0.42 : 1);
          ang = Math.atan2(oy, ox) + (L.droop * DEG) * (Math.cos(th) >= 0 ? 1 : -1) * 0.5 + rng.bell() * 0.7;
          if (shape === 'pad') ang = (Math.cos(th) >= 0 ? 0 : Math.PI) + rng.bell() * 0.6;
        }
        leaves.push({
          cluster: clusters.length - 1, ox, oy, ang,
          size: rng.range(0.8, 1.15), u: rng.next(), j: rng.next(), k: rng.next(),
          tip: c.tip && rr2(ox, oy) > 0.35,
        });
      }
    }
    if (sp.pendulous && b.depth >= sp.maxDepth - 1) {
      const P = sp.pendulous;
      const count = b.terminal ? P.strands : Math.ceil(P.strands / 2);
      for (let i = 0; i < count; i++) {
        const len = P.length * rng.range(0.6, 1.1);
        const st = {
          branch: b.id,
          pos: rng.range(0.45, 1),
          len,
          out: rng.range(0.2, 1) * P.spread,
          birth: b.birth + b.dur * 0.3 + rng.range(0, 0.08),
          dur: 0.42,
          leaves: [],
        };
        const nLeaves = Math.floor(len / P.leafGap);
        for (let k = 1; k <= nLeaves; k++) {
          st.leaves.push({ t: k / (nLeaves + 0.5), side: k % 2 ? 1 : -1, size: rng.range(0.8, 1.15), u: rng.next(), j: rng.next(), k: rng.next() });
        }
        strands.push(st);
      }
    }
  }

  leaves = thin(leaves, sp.maxLeaves);
  const strandBudget = Math.max(0, sp.maxLeaves - leaves.length);
  const strandLeafTotal = strands.reduce((s, st) => s + st.leaves.length, 0);
  if (strandLeafTotal > strandBudget) {
    for (const st of strands) st.leaves = thin(st.leaves, Math.floor(st.leaves.length * strandBudget / strandLeafTotal));
  }

  return { kind: 'branching', branches, clusters, leaves, strands };
}

function rr2(x, y) { return Math.hypot(x, y); }

export function evaluateBranching(sp, topo, G) {
  const out = { wood: [], twigs: [], leaves: [], masses: [], flowers: [], fruits: [], extra: [], anchors: {} };
  const state = new Array(topo.branches.length);
  const L = sp.leaf;

  for (const b of topo.branches) {
    const a = (G - b.birth) / b.dur;
    const ps = b.parent >= 0 ? state[b.parent] : null;
    if (a <= 0 || (b.parent >= 0 && !ps)) { state[b.id] = null; continue; }
    const m = easeOut(a);
    const len = b.len * m;
    // Girth lags length: saplings are slender, old trees keep thickening.
    const girth = 0.14 + 0.86 * Math.pow(Math.max(0, Math.min(1, (G - b.birth) / (b.dur * 1.9))), 1.25);
    let start = { x: 0, y: 0 };
    let r0 = Math.max(0.35, b.r0 * girth);
    if (ps) {
      start = quadPoint(ps.start, ps.c, ps.end, b.pos);
      r0 = Math.max(0.35, Math.min(r0, ps.r0 * profile(sp, topo.branches[b.parent], b.pos) * 0.9));
    }
    const a1 = b.angle + b.curl * m;
    const d0 = dirOf(b.angle);
    const d1 = dirOf(a1);
    const perp = { x: -d0.y, y: d0.x };
    const c = { x: start.x + d0.x * len * 0.5 + perp.x * b.bend * len, y: start.y + d0.y * len * 0.5 + perp.y * b.bend * len };
    const end = { x: c.x + d1.x * len * 0.5, y: c.y + d1.y * len * 0.5 };
    const st = { start, c, end, r0, len, m, b };
    state[b.id] = st;

    const samples = b.depth === 0 ? 10 : r0 > 2 ? 5 : 3;
    const pts = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const p = quadPoint(start, c, end, t);
      pts.push({ x: p.x, y: p.y, r: Math.max(0.3, r0 * profile(sp, b, t)) });
    }
    out.wood.push({ pts, depth: b.depth });
  }

  const cstate = topo.clusters.map(cl => {
    const st = state[cl.branch];
    if (!st) return null;
    const m = phase(G, cl.birth, 0.22) * st.m;
    if (m <= 0.02) return null;
    const p = quadPoint(st.start, st.c, st.end, cl.pos);
    const R = L.clusterR * cl.scale * (0.35 + 0.65 * m);
    return { x: p.x, y: p.y, R, m, cl, st };
  });

  for (const lf of topo.leaves) {
    const cs = cstate[lf.cluster];
    if (!cs) continue;
    const len = cs.cl.juvenile
      ? L.len * lf.size * 1.15 * (0.75 + 0.25 * cs.m)
      : L.len * lf.size * (0.5 + 0.5 * cs.m);
    let x = cs.x + lf.ox * cs.R;
    let y = cs.y + lf.oy * cs.R;
    if (L.shape === 'rosette' && !cs.cl.juvenile) {
      x = cs.x;
      y = cs.y;
    }
    const juv = cs.cl.juvenile && L.juvenileForm;
    out.leaves.push({ x, y, a: lf.ang, len: juv ? len * 1.1 : len, w: juv ? 1 : L.width, form: juv ? L.juvenileForm : L.form, u: cs.cl.juvenile ? lf.u * 0.35 : lf.u, j: lf.j, k: lf.k, tip: lf.tip, juv: !!juv });
  }

  if (sp.mass > 0) {
    for (const cs of cstate) {
      if (!cs || cs.cl.juvenile) continue;
      const r = cs.R * 0.85 * sp.mass;
      if (sp.massShape === 'umbrella') out.masses.push({ x: cs.x, y: cs.y - r * 0.15, rx: r * 1.25, ry: r * 0.7 });
      else if (L.shape === 'pad') out.masses.push({ x: cs.x, y: cs.y, rx: r * 1.1, ry: r * 0.5 });
      else out.masses.push({ x: cs.x, y: cs.y, rx: r, ry: r });
    }
  }

  for (const cs of cstate) {
    if (!cs || cs.m < 0.5) continue;
    for (const fl of cs.cl.flowers) {
      out.flowers.push({ x: cs.x + fl.ox * cs.R * 0.8, y: cs.y + fl.oy * cs.R * 0.7, r: L.len * 0.42, a: fl.a, u: fl.u });
    }
    if (cs.cl.fruit && cs.m > 0.7) {
      const fr = cs.cl.fruit;
      out.fruits.push({ x: cs.x + fr.dx * cs.R, y: cs.y + cs.R * 0.55, r: sp.fruit.size, a: fr.a, u: fr.u, kind: sp.fruit.kind });
    }
  }

  // Pendulous strands (willows).
  for (const s of topo.strands) {
    const st = state[s.branch];
    if (!st) continue;
    const m = phase(G, s.birth, s.dur) * st.m;
    if (m <= 0.02) continue;
    const p0 = quadPoint(st.start, st.c, st.end, s.pos);
    const side = Math.sign(p0.x - 0.0001) || 1;
    let len = s.len * m;
    const drop = len * 0.95;
    const floor = -3;
    if (p0.y + drop > floor) len *= Math.max(0.1, (floor - p0.y) / drop);
    const c = { x: p0.x + side * len * (0.18 + s.out), y: p0.y - len * 0.12 };
    const e = { x: p0.x + side * len * (0.1 + s.out * 0.8), y: p0.y + len * 0.95 };
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const p = quadPoint(p0, c, e, t);
      pts.push({ x: p.x, y: p.y, r: 0.55 - 0.3 * t });
    }
    out.twigs.push({ pts });
    for (const lf of s.leaves) {
      const p = quadPoint(p0, c, e, lf.t);
      const q = quadPoint(p0, c, e, Math.min(1, lf.t + 0.02));
      const tang = Math.atan2(q.y - p.y, q.x - p.x);
      out.leaves.push({
        x: p.x, y: p.y, a: tang + lf.side * 0.55, len: L.len * lf.size * (0.6 + 0.4 * m), w: L.width,
        form: L.form, u: lf.u, j: lf.j, k: lf.k, tip: lf.t > 0.8,
      });
    }
  }

  // Rainbow eucalyptus bark streaks.
  if (sp.stripes) {
    out.wood.filter(w => w.depth <= 1).forEach(w => { w.stripes = sp.stripes; });
  }

  const trunk = state[0];
  out.anchors.trunkTop = trunk ? { x: trunk.end.x, y: trunk.end.y } : { x: 0, y: 0 };
  let best = null;
  for (const st of state) {
    if (!st || st.b.depth !== 1 || st.len < 14) continue;
    const horiz = Math.abs(Math.sin(st.b.angle));
    if (!best || horiz > best.h) best = { h: horiz, st };
  }
  if (best) {
    const p = quadPoint(best.st.start, best.st.c, best.st.end, 0.62);
    out.anchors.limb = { x: p.x, y: p.y };
  }
  out.stats = { branches: state.filter(Boolean).length };
  return out;
}

export { clamp01 };
