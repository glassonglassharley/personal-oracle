import { memo, useMemo } from 'react';
import { generateRings } from './engine/index.js';

// Stump cross-section with one ring per month of use.
function RingSeal({ months = 0, seed = 1, size = 22, title }) {
  const r = useMemo(() => generateRings(months, seed, 40), [months, seed]);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={title || `${r.count} growth ring${r.count === 1 ? '' : 's'}`}>
      <path d={r.bark} fill="#7a5a3e" stroke="#4a3526" strokeWidth="2" />
      <path d={r.bark} fill="#e7cf9f" transform="translate(20 20) scale(0.86) translate(-20 -20)" />
      {r.rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#a9794b" strokeWidth={i === r.rings.length - 1 ? 1.1 : 0.7}
          opacity={0.55 + 0.45 * ((i + 1) / r.rings.length)} transform="translate(20 20) scale(0.86) translate(-20 -20)" />
      ))}
      <circle cx="20" cy="20" r="1.2" fill="#8a6440" />
    </svg>
  );
}

export default memo(RingSeal);
