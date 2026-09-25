// Regenerate server/lib/legacyTreeFloors.json from the current engine.
//
// For each species and each retired savings stage, find the smallest growth
// at which the procedural tree is at least as tall as the old stage art
// (within tolerance) for every calibration seed. Run after tuning species
// parameters; the engine continuity test enforces the result.
//
//   node scripts/calibrate-tree-floors.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { generateTree, SPECIES_IDS } from '../client/src/trees/engine/index.js';

// Old renderer: height above the pot rim per unit of stage scale.
const OLD = { round: 168.75, avocado: 180, upright: 180, redwood: 208, drooping: 90, palm: 116, bonsai: 85, cactus: 88, bamboo: 108, baobab: 127, fan: 106 };
const SHAPE = {
  oak: 'round', maple: 'round', apple: 'round', lemon: 'round', mango: 'round', olive: 'round', rainbow_eucalyptus: 'round',
  avocado: 'avocado', pine: 'upright', redwood: 'redwood', willow: 'drooping', weeping_willow: 'drooping', palm: 'palm',
  banana: 'palm', bonsai: 'bonsai', cactus: 'cactus', bamboo: 'bamboo', baobab: 'baobab', cherry_blossom: 'fan', dragon_blood: 'fan',
};
const STAGE_SCALE = [0.28, 0.48, 0.68, 0.85, 1.0];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const CAP = 0.9;
// The old stage names (Seedling, Sprout, Sapling, Young Tree, Rooted) map to
// these maturity thresholds; a floor never lands on a younger-sounding name.
const MATURITY_FLOOR = [0, 0.1, 0.25, 0.45, 0.65];
const TOL = 0.92;

const heightAt = (species, seed, growth) => {
  const t = generateTree({ species, seed, growth });
  return -t.bounds.minY * t.fit.scale;
};

const path = new URL('../server/lib/legacyTreeFloors.json', import.meta.url);
const prev = JSON.parse(readFileSync(path, 'utf8'));
const out = { _comment: prev._comment };
for (const species of SPECIES_IDS) {
  out[species] = STAGE_SCALE.map(s => {
    const target = OLD[SHAPE[species]] * s * TOL;
    let g = 0;
    while (g < CAP && SEEDS.some(seed => heightAt(species, seed, g) < target)) g = Math.round((g + 0.01) * 100) / 100;
    return Math.max(g, MATURITY_FLOOR[STAGE_SCALE.indexOf(s)]);
  });
  // Floors must be non-decreasing across stages.
  for (let i = 1; i < 5; i++) out[species][i] = Math.max(out[species][i], out[species][i - 1]);
  console.log(species.padEnd(20), out[species].join('  '));
}
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log('wrote', path.pathname);
