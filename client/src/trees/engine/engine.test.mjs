// Run: node --test client/src/trees/engine/engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateTree, SPECIES_IDS, SPECIES, clearTopologyCache, generateRings, hashString, FRAME } from './index.js';

const LEGACY_FLOORS = JSON.parse(readFileSync(new URL('../../../../server/lib/legacyTreeFloors.json', import.meta.url), 'utf8'));

const GROWTHS = Array.from({ length: 21 }, (_, i) => i / 20);
const SEEDS = [1, 12345, 987654321];

function woodExtent(t) {
  // Height/width of the tree from its drawn geometry: parse every number
  // pair out of the wood + leaf layers.
  let minY = 0; let minX = 0; let maxX = 0;
  for (const l of t.layers) {
    const nums = l.d.match(/-?\d+(\.\d+)?/g) || [];
    // Absolute M/L/C/Q coordinates dominate; arcs use relative offsets but
    // start from an absolute M, so this is a conservative envelope.
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (y < minY) minY = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  return { height: -minY, width: maxX - minX };
}

test('same inputs produce identical geometry (determinism)', () => {
  for (const species of SPECIES_IDS) {
    const a = generateTree({ species, seed: 42, growth: 0.63, health: 0.7, season: 'autumn', features: { blossom: 1, fruit: 1 } });
    clearTopologyCache();
    const b = generateTree({ species, seed: 42, growth: 0.63, health: 0.7, season: 'autumn', features: { blossom: 1, fruit: 1 } });
    assert.deepEqual(a.layers, b.layers, `${species} not deterministic`);
    assert.deepEqual(a.fit, b.fit);
  }
});

test('different seeds give different trees of the same species', () => {
  for (const species of SPECIES_IDS) {
    const a = generateTree({ species, seed: 1, growth: 1 });
    const b = generateTree({ species, seed: 2, growth: 1 });
    const same = a.layers.map(l => l.d).join('') === b.layers.map(l => l.d).join('');
    assert.equal(same, false, `${species}: seeds 1 and 2 are identical`);
  }
});

test('seed hashing is stable across releases', () => {
  // Changing the hash would silently give every user a different tree.
  assert.equal(hashString('oak:12345'), 2847684292);
});

test('node, leaf and path-size budgets hold for every species and growth', () => {
  for (const species of SPECIES_IDS) {
    for (const seed of SEEDS) {
      for (const growth of GROWTHS) {
        const t = generateTree({ species, seed, growth, features: { blossom: 1, fruit: 1, newGrowth: true } });
        assert.ok(t.stats.leaves <= (SPECIES[species].maxLeaves || 0) + 1, `${species} leaves ${t.stats.leaves}`);
        assert.ok(t.stats.nodes <= 1600, `${species} nodes ${t.stats.nodes}`);
        assert.ok(t.stats.elements <= 32, `${species} elements ${t.stats.elements}`);
        assert.ok(t.stats.pathBytes <= 260000, `${species} bytes ${t.stats.pathBytes}`);
      }
    }
  }
});

test('growth is monotonic: size, branches and leaves never decrease', () => {
  for (const species of SPECIES_IDS) {
    for (const seed of SEEDS) {
      let prev = null;
      for (const growth of GROWTHS) {
        const t = generateTree({ species, seed, growth });
        const ext = woodExtent(t);
        const cur = { growth, height: ext.height, width: ext.width, branches: t.stats.branches, leaves: t.stats.leaves, fit: t.fit.scale };
        if (prev) {
          assert.ok(cur.height >= prev.height - 0.6, `${species}/${seed} height shrank ${prev.height}->${cur.height} at g=${growth}`);
          assert.ok(cur.branches >= prev.branches, `${species}/${seed} lost branches at g=${growth}`);
          assert.ok(cur.leaves >= prev.leaves, `${species}/${seed} lost leaves ${prev.leaves}->${cur.leaves} at g=${growth}`);
          assert.equal(cur.fit, prev.fit, 'fit scale must not depend on growth');
        }
        prev = cur;
      }
      const first = generateTree({ species, seed, growth: 0 });
      const last = generateTree({ species, seed, growth: 1 });
      assert.ok(woodExtent(last).height > woodExtent(first).height * 2, `${species}: full tree is not clearly bigger than a seedling`);
    }
  }
});

test('grown trees fit the frame (no clipping)', () => {
  for (const species of SPECIES_IDS) {
    for (const seed of SEEDS) {
      const t = generateTree({ species, seed, growth: 1, features: { blossom: 1, fruit: 1 } });
      const k = t.fit.scale;
      assert.ok(t.bounds.minX * k >= -100, `${species} clips left`);
      assert.ok(t.bounds.maxX * k <= 100, `${species} clips right`);
      assert.ok(-t.bounds.minY * k <= FRAME.baseY - 4, `${species} clips top`);
    }
  }
});

test('dormant trees are sparser and muted but never bare', () => {
  for (const species of SPECIES_IDS) {
    if (!SPECIES[species].maxLeaves) continue;
    const healthy = generateTree({ species, seed: 7, growth: 0.8, health: 1 });
    const dormant = generateTree({ species, seed: 7, growth: 0.8, health: 0 });
    const leafFill = t => t.layers.filter(l => /^leaf/.test(l.key)).map(l => l.fill).join();
    if (SPECIES[species].dormantKeepsLeaves) {
      assert.notEqual(leafFill(dormant), leafFill(healthy), `${species} dormancy has no visible effect`);
    } else {
      assert.ok(dormant.stats.leaves < healthy.stats.leaves, `${species} dormancy has no visible effect`);
    }
    assert.ok(dormant.stats.leaves >= healthy.stats.leaves * 0.18, `${species} dormant tree looks dead`);
    // Same structure: dormancy never removes permanent progress.
    assert.equal(dormant.stats.branches, healthy.stats.branches);
  }
});

test('health does not change size', () => {
  const a = generateTree({ species: 'oak', seed: 9, growth: 0.6, health: 1 });
  const b = generateTree({ species: 'oak', seed: 9, growth: 0.6, health: 0.1 });
  assert.equal(a.layers.find(l => l.key === 'wood').d, b.layers.find(l => l.key === 'wood').d);
});

test('unknown species and bad numbers fall back safely', () => {
  const t = generateTree({ species: 'nope', seed: 3, growth: NaN, health: 5 });
  assert.equal(t.species, 'oak');
  assert.ok(t.layers.length > 0);
});

test('continuity: legacy floors keep every tree at least as tall as its old stage art', () => {
  // Height above the pot rim of each retired stage renderer, per unit of its
  // stage scale s = [0.28, 0.48, 0.68, 0.85, 1.0].
  const OLD = { round: 168.75, avocado: 180, upright: 180, redwood: 208, drooping: 90, palm: 116, bonsai: 85, cactus: 88, bamboo: 108, baobab: 127, fan: 106 };
  const SHAPE = {
    oak: 'round', maple: 'round', apple: 'round', lemon: 'round', mango: 'round', olive: 'round', rainbow_eucalyptus: 'round',
    avocado: 'avocado', pine: 'upright', redwood: 'redwood', willow: 'drooping', weeping_willow: 'drooping', palm: 'palm',
    banana: 'palm', bonsai: 'bonsai', cactus: 'cactus', bamboo: 'bamboo', baobab: 'baobab', cherry_blossom: 'fan', dragon_blood: 'fan',
  };
  const S = [0.28, 0.48, 0.68, 0.85, 1.0];
  for (const species of SPECIES_IDS) {
    const floors = LEGACY_FLOORS[species];
    assert.ok(floors, `${species} has no legacy floor row`);
    S.forEach((s, i) => {
      const old = OLD[SHAPE[species]] * s;
      // At the 0.9 cap a little height is traded for a much fuller crown.
      const need = floors[i] >= 0.9 ? 0.85 : 0.9;
      for (const seed of [1, 2, 3, 4, 5]) {
        const t = generateTree({ species, seed, growth: floors[i] });
        const hNow = -t.bounds.minY * t.fit.scale;
        assert.ok(hNow >= old * need, `${species} stage ${i + 1} seed ${seed}: ${hNow.toFixed(0)} < ${(old * need).toFixed(0)}`);
      }
    });
  }
});

test('growth rings: one per month, capped', () => {
  assert.equal(generateRings(0, 1).count, 0);
  assert.equal(generateRings(5, 1).rings.length, 5);
  assert.equal(generateRings(400, 1).count, 24);
});

test('generation is fast enough for a mid-range phone', () => {
  generateTree({ species: 'oak', seed: 5, growth: 0.9 });
  const t0 = performance.now();
  const N = 40;
  for (let i = 0; i < N; i++) generateTree({ species: 'oak', seed: 5, growth: 0.9 - i * 0.001 });
  const avg = (performance.now() - t0) / N;
  // Desktop is ~4x a mid-range phone; 12ms here keeps phones under ~50ms.
  assert.ok(avg < 12, `avg ${avg.toFixed(2)}ms`);
});
