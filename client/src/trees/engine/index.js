// Tree engine: pure functions, no React, no DOM.
//
//   generateTree({ species, seed, growth, health, season, features })
//     -> { layers, fit, bounds, anchors, particles, stats }
//
// growth   0..1  continuous maturity (server-computed, monotonic)
// health   0..1  current vitality; low = dormant (sparser, muted), never dead
// season   'spring' | 'summer' | 'autumn' | 'winter'
// features { blossom 0..1, fruit 0..1, newGrowth bool }

import { makeRng, hashString } from './rng.js';
import { getSpecies } from './species.js';
import { circle, ellipse, stamp, flower, tube, LEAF_TEMPLATES, f } from './geometry.js';
import { mix, adjust, desaturate } from './color.js';
import { clamp01, offsetPts } from './util.js';
import { buildBranching, evaluateBranching } from './generators/branching.js';
import { buildConifer, evaluateConifer } from './generators/conifer.js';
import { buildPalm, evaluatePalm } from './generators/palm.js';
import { buildCactus, evaluateCactus } from './generators/cactus.js';
import { buildBamboo, evaluateBamboo } from './generators/bamboo.js';

export { SPECIES, SPECIES_IDS, getSpecies } from './species.js';
export { hashString } from './rng.js';
export { generateRings } from './rings.js';

const GENERATORS = {
  branching: [buildBranching, evaluateBranching],
  conifer: [buildConifer, evaluateConifer],
  palm: [buildPalm, evaluatePalm],
  cactus: [buildCactus, evaluateCactus],
  bamboo: [buildBamboo, evaluateBamboo],
};

// Frame the tree is fitted into: viewBox 200x280, trunk base at (100, BASE_Y).
export const FRAME = { width: 200, height: 280, baseX: 100, baseY: 226, halfWidth: 93 };

// Seedlings still need something to look at, so growth 0 evaluates at G0.
const G0 = 0.1;

const topoCache = new Map();
const TOPO_CACHE_MAX = 48;

function getTopology(sp, seed) {
  const key = `${sp.id}:${seed}`;
  const hit = topoCache.get(key);
  if (hit) return hit;
  const [build, evaluate] = GENERATORS[sp.generator];
  const rng = makeRng(hashString(key));
  const topo = build(sp, rng);
  // Fit is computed once, at full growth, so the same scale is used for every
  // growth value: a young tree is visibly smaller, and a grown one never clips.
  const full = evaluate(sp, topo, 1);
  const b = boundsOf(full);
  const heightBudget = sp.frameHeight * (0.93 + 0.07 * makeRng(hashString(`${key}:h`)).next());
  const scale = Math.min(
    FRAME.halfWidth / Math.max(1, -b.minX, b.maxX),
    heightBudget / Math.max(1, -b.minY),
  );
  topo.fit = { scale };
  if (topoCache.size >= TOPO_CACHE_MAX) topoCache.delete(topoCache.keys().next().value);
  topoCache.set(key, topo);
  return topo;
}

function boundsOf(raw) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  const add = (x, y, r = 0) => {
    if (x - r < minX) minX = x - r;
    if (x + r > maxX) maxX = x + r;
    if (y - r < minY) minY = y - r;
    if (y + r > maxY) maxY = y + r;
  };
  for (const w of raw.wood) for (const p of w.pts) add(p.x, p.y, p.r);
  for (const w of raw.twigs || []) for (const p of w.pts) add(p.x, p.y, p.r);
  for (const l of raw.leaves) add(l.x, l.y, l.len);
  for (const m of raw.masses) add(m.x, m.y, Math.max(m.rx, m.ry));
  for (const b of raw.bodies || []) for (const p of b.pts) add(p.x, p.y, p.r);
  if (minX === Infinity) return { minX: -1, maxX: 1, minY: -1, maxY: 0 };
  return { minX, maxX, minY, maxY };
}

function seasonTone(col, season, evergreen) {
  if (season === 'spring') return adjust(col, { dl: 0.03, ds: 0.04 });
  if (season === 'autumn') return evergreen ? mix(col, '#b08a3e', 0.1) : col;
  if (season === 'winter') return mix(col, '#8fa3b5', 0.14);
  return col;
}

function vital(col, health, dormant) {
  const k = (1 - health) * 0.62;
  return desaturate(mix(col, dormant, k), (1 - health) * 0.12);
}

function fruitShape(fr) {
  const { x, y, r, a } = fr;
  switch (fr.kind) {
    case 'lemon': return { body: ellipse(x, y, r * 1.2, r * 0.85, a), light: circle(x - r * 0.35, y - r * 0.3, r * 0.28) };
    case 'drop': return { body: ellipse(x, y + r * 0.3, r * 1.2, r * 0.8, Math.PI / 2 + a * 0.5), light: circle(x - r * 0.25, y - r * 0.1, r * 0.25) };
    case 'bell': return { body: '', light: '', accent: ellipse(x, y, r * 1.2, r * 0.75, Math.PI / 2) };
    case 'olive': return { body: ellipse(x, y, r * 0.7, r, a), light: circle(x - r * 0.2, y - r * 0.35, r * 0.2) };
    case 'pear': return { body: circle(x, y + r * 0.35, r) + circle(x, y - r * 0.55, r * 0.62), light: circle(x - r * 0.35, y, r * 0.25) };
    case 'cherry': return { body: circle(x - r * 0.9, y, r) + circle(x + r * 0.9, y + r * 0.3, r), light: circle(x - r * 1.2, y - r * 0.35, r * 0.3) };
    case 'acorn': return { body: ellipse(x, y + r * 0.3, r * 0.7, r * 0.95), light: ellipse(x, y - r * 0.35, r * 0.8, r * 0.45) };
    case 'cone': return { body: ellipse(x, y + r * 0.6, r * 0.55, r * 1.2), light: ellipse(x - r * 0.15, y + r * 0.3, r * 0.2, r * 0.6) };
    case 'pod': return { body: ellipse(x, y + r * 0.9, r * 0.5, r * 1.4), light: '' };
    case 'coconut': return { body: circle(x, y, r), light: circle(x - r * 0.35, y - r * 0.35, r * 0.3) };
    case 'banana': return { body: ellipse(x, y, r * 1.1, r * 0.42, a), light: '' };
    case 'berry':
    case 'round':
    default: return { body: circle(x, y, r), light: circle(x - r * 0.35, y - r * 0.35, r * 0.3) };
  }
}

export function generateTree({
  species = 'oak', seed = 1, growth = 0.5, health = 1, season = 'summer',
  features = {},
} = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const sp = getSpecies(species);
  const topo = getTopology(sp, seed >>> 0);
  const g = clamp01(Number.isFinite(growth) ? growth : 0);
  const h = clamp01(Number.isFinite(health) ? health : 1);
  const G = G0 + (1 - G0) * g;
  const raw = GENERATORS[sp.generator][1](sp, topo, G);
  const pal = sp.palette;
  const evergreen = !sp.deciduous;
  const blossom = clamp01(features.blossom || 0);
  const fruitLevel = clamp01(features.fruit || 0);

  const layers = new Map();
  const put = (key, z, d, fill, opts = {}) => {
    if (!d) return;
    const L = layers.get(key);
    if (L) L.d += d;
    else layers.set(key, { key, z, d, fill, opacity: opts.opacity ?? 1, sway: opts.sway || (z >= 40 ? 'leaf' : 'wood'), stroke: opts.stroke });
  };
  const tone = col => (col ? seasonTone(vital(col, h, pal.dormant || '#8a8a5c'), season, evergreen) : '#000000');

  // Canopy volume.
  const massScale = 0.55 + 0.45 * h;
  let massD = '';
  for (const m of raw.masses) massD += ellipse(m.x, m.y, m.rx * massScale, m.ry * massScale);
  put('mass', 10, massD, tone(pal.mass), { opacity: 0.94, sway: 'wood' });

  // Wood.
  let wood = '';
  let woodShade = '';
  let woodLight = '';
  const stripes = [];
  let limbs = '';
  for (const w of raw.wood) {
    const t = tube(w.pts);
    if (w.limb) { limbs += t.body; continue; }
    wood += t.body;
    woodShade += t.shade;
    woodLight += t.light;
    if (w.stripes) {
      w.stripes.forEach((col, k) => {
        const o = -0.62 + (1.24 * k) / Math.max(1, w.stripes.length - 1);
        const sp2 = offsetPts(w.pts, o, 0.16);
        stripes[k] = (stripes[k] || '') + tube(sp2, { cap: false }).body;
      });
    }
  }
  put('limb', 15, limbs, pal.barkDark, { sway: 'wood' });
  put('wood', 30, wood, pal.bark, { sway: 'wood' });
  stripes.forEach((d, k) => put(`stripe${k}`, 31, d, sp.stripes[k], { opacity: 0.8, sway: 'wood' }));
  put('woodShade', 32, woodShade, pal.barkDark, { opacity: 0.55, sway: 'wood' });
  put('woodLight', 33, woodLight, pal.barkLight, { opacity: 0.45, sway: 'wood' });

  let twig = '';
  for (const w of raw.twigs || []) twig += tube(w.pts).body;
  put('twig', 25, twig, tone(pal.twig || pal.barkDark), { opacity: 0.9, sway: 'wood' });

  // Generator-specific bodies (cactus pads, palm trunks, bamboo culms).
  for (const e of raw.extra || []) {
    const fill = e.color ? (pal[e.color] ? (e.vital ? tone(pal[e.color]) : pal[e.color]) : e.color) : 'none';
    put(e.layer, e.z, e.d, fill, { opacity: e.opacity ?? 1, sway: e.sway, stroke: e.stroke });
  }

  // Leaves: tone by position relative to the light (upper left).
  const visible = raw.leaves;
  let lx0 = Infinity; let lx1 = -Infinity; let ly0 = Infinity; let ly1 = -Infinity;
  for (const l of visible) {
    if (l.x < lx0) lx0 = l.x; if (l.x > lx1) lx1 = l.x;
    if (l.y < ly0) ly0 = l.y; if (l.y > ly1) ly1 = l.y;
  }
  const cx = (lx0 + lx1) / 2;
  const cy = (ly0 + ly1) / 2;
  const hw = Math.max(8, (lx1 - lx0) / 2);
  const hh = Math.max(8, (ly1 - ly0) / 2);
  const winterThin = season === 'winter' && sp.deciduous ? 0.72 : 1;
  // Species with only a handful of big leaves (banana) go dormant by colour
  // alone: dropping half their leaves reads as damage, not rest.
  const density = sp.dormantKeepsLeaves ? 1 : (0.3 + 0.7 * h) * winterThin;
  const autumnShare = season === 'autumn' && sp.deciduous ? (sp.id === 'maple' ? 0.75 : 0.42) : 0;
  const toneCols = [pal.leafDark, pal.leaf, pal.leafLight, pal.highlight].map(tone);
  const buckets = ['', '', '', ''];
  const juvBuckets = ['', ''];
  let fresh = '';
  const autumn = ['', '', ''];
  let leafCount = 0;
  const particleSeeds = [];
  for (const l of visible) {
    if (l.u >= density) continue;
    leafCount++;
    const nx = (l.x - cx) / hw;
    const ny = (l.y - cy) / hh;
    const score = -(nx * 0.5 + ny * 0.8) + (l.j - 0.5) * 0.9;
    const bucket = score < -0.4 ? 0 : score < 0.2 ? 1 : score < 0.8 ? 2 : 3;
    const d = l.raw
      ? l.raw
      : l.form === 'blossom'
        ? flower(l.x, l.y, l.len * 0.62, l.a)
        : stamp(LEAF_TEMPLATES[l.form] || LEAF_TEMPLATES.oval, l.x, l.y, l.a, l.len, l.w);
    if (l.juv) juvBuckets[bucket < 2 ? 0 : 1] += d;
    else if (features.newGrowth && l.tip && l.k > 0.45 && bucket > 0) fresh += d;
    else if (l.k < autumnShare) autumn[Math.floor(l.j * 3) % 3] += d;
    else buckets[bucket] += d;
    if (particleSeeds.length < 40 && l.k > 0.8 && ny > -0.2) particleSeeds.push(l);
  }
  put('leaf0', 20, buckets[0], toneCols[0], { sway: 'wood' });
  put('leaf1', 40, buckets[1], toneCols[1]);
  put('leaf2', 41, buckets[2], toneCols[2]);
  put('leaf3', 42, buckets[3], toneCols[3]);
  put('fresh', 43, fresh, pal.fresh || toneCols[3]);
  if (pal.juvenile) {
    put('juv0', 38, juvBuckets[0], tone(pal.juvenile[0]));
    put('juv1', 39, juvBuckets[1], tone(pal.juvenile[1]));
  }
  if (autumnShare) (sp.palette.autumn || []).forEach((col, i) => put(`autumn${i}`, 44 + i, autumn[i], vital(col, h, pal.dormant || '#8a8a5c')));

  // Milestone blossoms.
  let flowers = '';
  let centers = '';
  const bloomCut = blossom * (0.35 + 0.65 * h);
  const flowerScale = sp.flowerScale ?? 1;
  let flowerCount = 0;
  for (const fl of raw.flowers) {
    if (fl.u >= bloomCut || flowerCount >= 40) continue;
    flowerCount++;
    const r = fl.r * flowerScale;
    if (sp.flowerForm === 'catkin') {
      flowers += ellipse(fl.x, fl.y + r * 0.9, r * 0.32, r * 1.1, 0.15);
    } else if (sp.flowerForm === 'candle') {
      flowers += ellipse(fl.x, fl.y - r * 0.8, r * 0.3, r * 0.95);
    } else {
      flowers += flower(fl.x, fl.y, r, fl.a);
      centers += circle(fl.x, fl.y, r * 0.26);
    }
  }
  put('flower', 50, flowers, pal.flower || '#ffffff', { opacity: 0.96 });
  put('flowerCenter', 51, centers, pal.flowerCenter || '#f2c14e');

  // Milestone fruit.
  let fruit = '';
  let fruitLight = '';
  let fruitAccent = '';
  const fruitCut = fruitLevel * (0.5 + 0.5 * h);
  // A handful of fruit reads as abundance; dozens read as a yellow blob.
  const fruitMax = Math.round((sp.fruit?.max ?? 14) * (0.4 + 0.6 * fruitLevel));
  let fruitCount = 0;
  for (const fr of raw.fruits) {
    if (fr.u >= fruitCut || fruitCount >= fruitMax) continue;
    fruitCount++;
    const s = fruitShape(fr);
    fruit += s.body;
    fruitLight += s.light;
    fruitAccent += s.accent || '';
  }
  put('fruit', 55, fruit, pal.fruit);
  put('fruitLight', 56, fruitLight, pal.fruitLight, { opacity: 0.8 });
  put('fruitAccent', 57, fruitAccent, '#6b2a4a');

  // Winter snow on the upper side of the canopy.
  if (season === 'winter') {
    // Soft caps resting on the upper side of the crown: a dome with a flat
    // underside, so it reads as settled snow rather than a stroke.
    let snow = '';
    const spots = raw.snow || raw.masses
      .filter((m, i) => i % 3 === 0 && m.y < cy - hh * 0.1)
      .map(m => ({ x: m.x, y: m.y - m.ry * 0.62, rx: m.rx * 0.42 }));
    for (const s of spots.slice(0, 18)) {
      const r = Math.max(1.2, s.rx);
      snow += `M${f(s.x - r)} ${f(s.y)}Q${f(s.x - r * 0.9)} ${f(s.y - r * 0.55)} ${f(s.x)} ${f(s.y - r * 0.6)}Q${f(s.x + r * 0.9)} ${f(s.y - r * 0.55)} ${f(s.x + r)} ${f(s.y)}Q${f(s.x)} ${f(s.y + r * 0.22)} ${f(s.x - r)} ${f(s.y)}Z`;
    }
    put('snow', 60, snow, '#f2f6f9', { opacity: 0.92 });
  }

  const sorted = [...layers.values()].sort((a, b) => a.z - b.z);
  const bounds = boundsOf(raw);
  const pr = makeRng(hashString(`${sp.id}:${seed}:particles`));
  const particles = [];
  const petal = sp.leaf?.form === 'blossom' || blossom > 0.5;
  if (particleSeeds.length && sp.generator !== 'cactus') {
    for (let i = 0; i < 3; i++) {
      const src = particleSeeds[Math.floor(pr.next() * particleSeeds.length)];
      particles.push({
        x: src.x, y: src.y,
        color: petal ? (pal.flower && sp.leaf?.form !== 'blossom' ? pal.flower : toneCols[2]) : (autumnShare ? sp.palette.autumn[i % 3] : toneCols[1 + (i % 2)]),
        form: petal ? 'petal' : 'leaf',
        size: Math.max(2.4, (src.len || 6) * 0.8),
        delay: pr.range(0, 12),
        duration: pr.range(9, 14),
        drift: pr.range(-18, 18),
      });
    }
  }

  const pathBytes = sorted.reduce((s, l) => s + l.d.length, 0);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    species: sp.id,
    layers: sorted,
    fit: topo.fit,
    bounds,
    anchors: raw.anchors || {},
    particles,
    stats: {
      elements: sorted.length,
      branches: raw.stats?.branches ?? raw.wood.length,
      leaves: leafCount,
      nodes: raw.wood.length + (raw.twigs || []).length + raw.leaves.length + raw.flowers.length + raw.fruits.length,
      pathBytes,
      ms: t1 - t0,
    },
  };
}

export function clearTopologyCache() { topoCache.clear(); }

export const _internal = { f };
