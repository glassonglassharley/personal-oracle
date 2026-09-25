// Growth rings: one ring per month of use, drawn as a stump cross-section.
// Pure geometry in a 0..size box so it can render at any scale.

import { makeRng, hashString } from './rng.js';
import { f } from './geometry.js';

export const MAX_RINGS = 24;

export function generateRings(months, seed = 1, size = 40) {
  const n = Math.max(0, Math.min(MAX_RINGS, Math.floor(months || 0)));
  const rng = makeRng(hashString(`rings:${seed}`));
  const c = size / 2;
  const outer = size / 2 - 1.5;
  const phaseA = rng.next() * 6.28;
  const phaseB = rng.next() * 6.28;
  const ringPath = (r, wob) => {
    const steps = 28;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const rr = r * (1 + wob * (Math.sin(t * 3 + phaseA) * 0.6 + Math.sin(t * 5 + phaseB) * 0.4));
      d += `${i ? 'L' : 'M'}${f(c + Math.cos(t) * rr)} ${f(c + Math.sin(t) * rr * 0.96)}`;
    }
    return `${d}Z`;
  };
  const rings = [];
  // Rings are spaced so the newest (outermost) sits at the bark and earlier
  // ones pack toward the pith, like real annual rings.
  for (let i = 1; i <= n; i++) {
    const r = outer * Math.pow(i / Math.max(n, 1), 0.85) * (n ? 0.94 : 0);
    rings.push(ringPath(Math.max(0.8, r), 0.035));
  }
  return { size, bark: ringPath(outer, 0.03), rings, count: n };
}
