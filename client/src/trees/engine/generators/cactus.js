// Columnar cactus (saguaro form): a ribbed column that thickens and rises,
// plus arms that bud from the sides at seeded growth points, run outward,
// elbow, and turn upward.

import { f } from '../geometry.js';
import { easeOut, phase, offsetPts, clamp01 } from '../util.js';

export function buildCactus(sp, rng) {
  const H = sp.height * rng.range(0.9, 1.06);
  const W = sp.width * rng.range(0.92, 1.08);
  const nArms = rng.int(2, 4);
  const arms = [];
  let side = rng.chance(0.5) ? 1 : -1;
  const births = [0.3, 0.48, 0.64, 0.8].slice(0, nArms);
  for (let i = 0; i < nArms; i++) {
    arms.push({
      side,
      hf: rng.range(0.34, 0.6),
      out: rng.range(0.9, 1.5),
      up: rng.range(0.24, 0.4),
      r: rng.range(0.62, 0.74),
      birth: births[i] + rng.range(-0.03, 0.03),
      flowerU: rng.next(),
    });
    side = -side;
  }
  const wob = [rng.bell(), rng.bell()];
  const tops = [{ dx: 0, u: rng.next() * 0.5 }, { dx: -0.45, u: rng.next() }, { dx: 0.45, u: rng.next() }];
  return { kind: 'cactus', H, W, arms, wob, tops };
}

function armPath(x0, y0, side, ox, er, up, frac) {
  const pts = [];
  const N = 14;
  // Horizontal run, a quarter-circle elbow, then straight up.
  const runLen = ox;
  const elbowLen = (Math.PI / 2) * er;
  const total = runLen + elbowLen + up;
  const target = total * frac;
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * target;
    let x;
    let y;
    if (s <= runLen) {
      x = x0 + side * s;
      y = y0;
    } else if (s <= runLen + elbowLen) {
      const a = (s - runLen) / er;
      x = x0 + side * (runLen + Math.sin(a) * er);
      y = y0 - (1 - Math.cos(a)) * er;
    } else {
      x = x0 + side * (runLen + er);
      y = y0 - er - (s - runLen - elbowLen);
    }
    pts.push({ x, y });
  }
  return pts;
}

export function evaluateCactus(sp, topo, G) {
  const out = { wood: [], twigs: [], leaves: [], masses: [], flowers: [], fruits: [], extra: [], bodies: [], anchors: {} };
  const Hn = topo.H * (0.1 + 0.9 * easeOut(G / 0.82));
  const Wn = topo.W * (0.55 + 0.45 * easeOut(G / 0.6));

  const bodies = [];
  for (const arm of topo.arms) {
    const m = phase(G, arm.birth, 0.3);
    if (m <= 0.02) continue;
    const r = Wn * arm.r;
    const y0 = -arm.hf * Hn;
    const x0 = arm.side * Wn * 0.6;
    const ox = arm.out * Wn;
    const er = r * 1.25;
    const up = arm.up * Hn;
    const path = armPath(x0, y0, arm.side, ox, er, up, m);
    const pts = path.map((p, i) => ({ ...p, r: r * (i === 0 ? 0.92 : 1) * (0.55 + 0.45 * m) }));
    bodies.push({ pts, top: m > 0.9 ? pts[pts.length - 1] : null, flowerU: arm.flowerU });
  }
  const colPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const wob = Math.sin(t * Math.PI) * topo.wob[0] * Wn * 0.25;
    colPts.push({ x: wob, y: -Hn * t + (i === 10 ? Wn * 0.6 : 0), r: Wn * (i === 0 ? 0.92 : 1) });
  }
  bodies.push({ pts: colPts, top: colPts[colPts.length - 1], column: true });

  let body = '';
  let shade = '';
  let light = '';
  let ribs = '';
  let spines = '';
  let spineCount = 0;
  for (const b of bodies) {
    body += tubeBody(b.pts);
    const sh = offsetPts(b.pts, 0.55, 0.45);
    shade += tubeBody(sh, false);
    const li = offsetPts(b.pts, -0.5, 0.2);
    light += tubeBody(li.slice(0, -1), false);
    for (const o of [-0.62, -0.2, 0.22, 0.64]) {
      const rib = offsetPts(b.pts, o, 0.05);
      ribs += tubeBody(rib.slice(0, -1), false);
      for (let i = 1 + (spineCount % 2); i < rib.length - 1 && spineCount < 160; i += 2) {
        const p = rib[i];
        spines += `M${f(p.x - 0.8)} ${f(p.y - 0.5)}l1.6 1M${f(p.x + 0.8)} ${f(p.y - 0.5)}l-1.6 1`;
        spineCount++;
      }
    }
    out.bodies.push({ pts: b.pts });
    if (b.top) {
      const u = b.column ? topo.tops[0].u : b.flowerU;
      out.flowers.push({ x: b.top.x, y: b.top.y - b.pts[0].r * 0.55, r: Wn * 0.55, a: 0.3, u });
      if (b.column) {
        for (const t of topo.tops.slice(1)) out.flowers.push({ x: b.top.x + t.dx * Wn * 1.2, y: b.top.y - b.pts[0].r * 0.2, r: Wn * 0.45, a: 1.1, u: t.u });
      }
    }
  }

  out.extra.push({ layer: 'cactusBody', z: 30, d: body, color: 'leaf', vital: true, sway: 'wood' });
  out.extra.push({ layer: 'cactusShade', z: 31, d: shade, color: 'leafDark', vital: true, opacity: 0.75, sway: 'wood' });
  out.extra.push({ layer: 'cactusRib', z: 32, d: ribs, color: 'mass', vital: true, opacity: 0.45, sway: 'wood' });
  out.extra.push({ layer: 'cactusLight', z: 33, d: light, color: 'highlight', vital: true, opacity: 0.55, sway: 'wood' });
  out.extra.push({ layer: 'spine', z: 36, d: spines, color: 'spine', opacity: clamp01(0.2 + G * 0.45), sway: 'wood', stroke: 0.4 });

  out.anchors.trunkTop = { x: 0, y: -Hn };
  out.anchors.limb = { x: Wn * 1.8, y: -Hn * 0.6 };
  out.stats = { branches: bodies.length };
  return out;
}

function tubeBody(pts, cap = true) {
  const n = pts.length;
  if (n < 2) return '';
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    left.push([pts[i].x - nx * pts[i].r, pts[i].y - ny * pts[i].r]);
    right.push([pts[i].x + nx * pts[i].r, pts[i].y + ny * pts[i].r]);
  }
  let d = `M${f(left[0][0])} ${f(left[0][1])}`;
  for (let i = 1; i < n; i++) d += `L${f(left[i][0])} ${f(left[i][1])}`;
  if (cap) {
    const t = pts[n - 1];
    const p = pts[n - 2];
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    d += `C${f(left[n - 1][0] + (dx / l) * t.r * 1.3)} ${f(left[n - 1][1] + (dy / l) * t.r * 1.3)} ${f(right[n - 1][0] + (dx / l) * t.r * 1.3)} ${f(right[n - 1][1] + (dy / l) * t.r * 1.3)} ${f(right[n - 1][0])} ${f(right[n - 1][1])}`;
  } else {
    d += `L${f(right[n - 1][0])} ${f(right[n - 1][1])}`;
  }
  for (let i = n - 2; i >= 0; i--) d += `L${f(right[i][0])} ${f(right[i][1])}`;
  return `${d}Z`;
}
