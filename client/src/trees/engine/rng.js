// Deterministic hashing + PRNG. Everything the generator decides comes from
// these, never from Math.random, so a (species, seed) pair always yields the
// same tree on every device.

export function hashString(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const base = seed >>> 0;
  const next = mulberry32(base);
  const rng = {
    seed: base,
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: p => next() < p,
    pick: arr => arr[Math.floor(next() * arr.length)],
    // Sum of uniforms: cheap, bounded, bell-shaped in [-1, 1].
    bell: () => (next() + next() + next()) / 1.5 - 1,
    fork: label => makeRng(hashString(`${base}:${label}`)),
  };
  return rng;
}
