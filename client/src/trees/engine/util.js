export const DEG = Math.PI / 180;

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export function easeOut(x) {
  const k = clamp01(x);
  return 1 - (1 - k) * (1 - k);
}

// 0 at t<=birth, 1 at t>=birth+dur, eased in between. Non-decreasing in t,
// which is the whole basis of monotonic growth.
export function phase(t, birth, dur) {
  return easeOut((t - birth) / dur);
}

export function dirOf(angle) {
  // angle 0 = straight up, positive = clockwise (towards +x).
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

// Deterministically thin a list down to `max` entries, spreading the cut
// evenly instead of truncating the tail (which would strip one side).
export function thin(list, max) {
  if (list.length <= max) return list;
  const keep = Math.max(0, max) / list.length;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (Math.floor((i + 1) * keep) > Math.floor(i * keep)) out.push(list[i]);
  }
  return out;
}

export function offsetPts(pts, frac, width) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return { x: p.x + nx * p.r * frac, y: p.y + ny * p.r * frac, r: p.r * width };
  });
}
