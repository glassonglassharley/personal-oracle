import { memo, useEffect, useId, useMemo, useState } from 'react';
import { generateTree, FRAME } from './engine/index.js';
import { seasonFor } from './growth.js';
import { Background, PotBack, PotLip } from './scenery.jsx';
import Decoration from './decorations.jsx';
import './trees.css';

function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

function Layers({ layers }) {
  return layers.map(l => (l.stroke
    ? <path key={l.key} d={l.d} fill="none" stroke={l.fill} strokeWidth={l.stroke} strokeLinecap="round" opacity={l.opacity} />
    : <path key={l.key} d={l.d} fill={l.fill} opacity={l.opacity} />));
}

const PETAL = 'M0 -3 C2.2 -3 2.6 0 0 3 C-2.6 0 -2.2 -3 0 -3Z';
const LEAF = 'M0 -3.4 C2.4 -2 2.4 2 0 3.4 C-2.4 2 -2.4 -2 0 -3.4Z';

function TreeArt({
  species = 'oak', seed = 1, growth = 0.5, health = 1, season, features,
  potStyle = 'terracotta', background = 'day', decoration = 'none',
  width = 200, height = 280, animate = true, celebrate = null, onCelebrated,
  className = '', title,
}) {
  const artId = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const s = season || seasonFor();
  const blossom = features?.blossom || 0;
  const fruit = features?.fruit || 0;
  const newGrowth = !!features?.newGrowth;

  // Round inputs so tiny server-side float noise doesn't regenerate.
  const g = Math.round((growth || 0) * 1000) / 1000;
  const h = Math.round((health ?? 1) * 100) / 100;
  const tree = useMemo(
    () => generateTree({ species, seed, growth: g, health: h, season: s, features: { blossom, fruit, newGrowth } }),
    [species, seed, g, h, s, blossom, fruit, newGrowth],
  );

  const woodLayers = tree.layers.filter(l => l.sway === 'wood');
  const leafLayers = tree.layers.filter(l => l.sway !== 'wood');
  const transform = `translate(${FRAME.baseX} ${FRAME.baseY}) scale(${tree.fit.scale})`;
  const motion = animate && !reduced;
  const celebrating = !!(celebrate && celebrate.length);

  useEffect(() => {
    if (!celebrating) return undefined;
    const keys = celebrate.map(c => c.key);
    const t = setTimeout(() => onCelebrated?.(keys), reduced ? 2600 : 3400);
    return () => clearTimeout(t);
  }, [celebrating, celebrate, onCelebrated, reduced]);

  // Falling leaves only on a thriving tree: leaves dropping off a dormant
  // tree would read as dying.
  const particles = motion && h >= 0.5 && g >= 0.25 ? tree.particles : [];
  const toPct = (x, y) => ({
    left: `${((FRAME.baseX + x * tree.fit.scale) / FRAME.width) * 100}%`,
    top: `${((FRAME.baseY + y * tree.fit.scale) / FRAME.height) * 100}%`,
  });
  const fallPx = y => Math.max(8, ((FRAME.baseY + 6 - (FRAME.baseY + y * tree.fit.scale)) / FRAME.height) * height);

  return (
    <div
      className={`tree-art${motion ? ' is-animated' : ''}${celebrating ? ' is-celebrating' : ''} ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={title || `${species.replace(/_/g, ' ')} tree`}
    >
      <svg className="tree-svg" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} width={width} height={height} aria-hidden="true">
        <Background bgId={background} artId={artId} />
        <PotBack style={potStyle} artId={artId} />
      </svg>
      {celebrating && motion && <div className="tree-glow" />}
      <div className="tree-pop">
        <svg className="tree-svg tree-sway tree-sway-wood" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} width={width} height={height} aria-hidden="true">
          <g transform={transform}><Layers layers={woodLayers} /></g>
        </svg>
        <svg className="tree-svg tree-sway tree-sway-leaf" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} width={width} height={height} aria-hidden="true">
          <g transform={transform}>
            <Layers layers={leafLayers} />
            {g >= 0.35 && <Decoration type={decoration} tree={tree} />}
          </g>
        </svg>
      </div>
      <svg className="tree-svg" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} width={width} height={height} aria-hidden="true">
        <PotLip style={potStyle} />
      </svg>
      {particles.map((p, i) => (
        <svg
          key={i}
          className="tree-particle"
          viewBox="-4 -4 8 8"
          width={Math.max(5, p.size * tree.fit.scale * (width / FRAME.width))}
          height={Math.max(5, p.size * tree.fit.scale * (width / FRAME.width))}
          style={{
            ...toPct(p.x, p.y),
            '--fall': `${fallPx(p.y)}px`,
            '--drift': `${p.drift * (width / FRAME.width)}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
          aria-hidden="true"
        >
          <path d={p.form === 'petal' ? PETAL : LEAF} fill={p.color} />
        </svg>
      ))}
      {celebrating && (
        <div className="tree-milestone" role="status">
          <span className="tree-milestone-mark" aria-hidden="true">✦</span>
          {celebrate[0].text}
        </div>
      )}
      {celebrating && motion && (
        <div className="tree-sparkles" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
        </div>
      )}
    </div>
  );
}

export default memo(TreeArt);
