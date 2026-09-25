import { hashString } from './engine/index.js';

// Northern-hemisphere meteorological seasons from the real date.
export function seasonFor(date = new Date()) {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function treeSeed(seedBase, species) {
  return hashString(`${seedBase ?? 'guest'}:${species || 'oak'}`);
}
