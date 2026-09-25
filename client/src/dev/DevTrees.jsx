// Dev-only contact sheet for the tree engine. Mounted by main.jsx only when
// import.meta.env.DEV, so it is not part of production builds.
//   /dev/trees?theme=mint&bg=theme&species=oak,pine&animate=1
import { useEffect, useMemo, useState } from 'react';
import TreeArt from '../trees/TreeArt.jsx';
import { SPECIES_IDS, generateTree } from '../trees/engine/index.js';
import { treeSeed } from '../trees/growth.js';
import { TREE_SPECIES } from '../companions/companionData';
import RingSeal from '../trees/RingSeal.jsx';

const THEMES = ['emerald', 'mint', 'plum', 'noir', 'red', 'orange', 'pink', 'neon'];
const GROWTHS = [0, 0.1, 0.25, 0.5, 0.75, 1];
const SEEDS = [101, 202, 303];

function useParams() {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

function Cell({ label, ...props }) {
  return (
    <figure className="dev-tree-cell">
      <div className="comp-svg-wrap dev-tree-frame">
        <TreeArt width={112} height={157} {...props} />
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function DevTrees() {
  const params = useParams();
  const theme = params.get('theme') || 'emerald';
  const bg = params.get('bg') || 'theme';
  const animate = params.get('animate') === '1';
  const only = (params.get('species') || '').split(',').filter(Boolean);
  const species = only.length ? SPECIES_IDS.filter(s => only.includes(s)) : SPECIES_IDS;
  const [perf, setPerf] = useState(null);
  const [celebrate, setCelebrate] = useState([{ key: 'first_bloom', text: 'First blossoms: a 7-day clean streak' }]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    document.title = `Trees · ${theme}`;
  }, [theme]);

  useEffect(() => {
    const rows = [];
    for (const id of SPECIES_IDS) {
      generateTree({ species: id, seed: 1, growth: 1 });
      const t0 = performance.now();
      let s;
      for (let i = 0; i < 10; i++) s = generateTree({ species: id, seed: 1, growth: 1 - i * 0.001 }).stats;
      rows.push({ id, ms: (performance.now() - t0) / 10, leaves: s.leaves, nodes: s.nodes, elements: s.elements, kb: s.pathBytes / 1024 });
    }
    setPerf(rows);
    window.__treePerf = rows;
  }, []);

  const nameOf = id => TREE_SPECIES.find(s => s.id === id)?.name || id;

  return (
    <div className="dev-trees">
      <style>{DEV_CSS}</style>
      <header className="dev-trees-head">
        <h1>Tree companions · contact sheet</h1>
        <nav>
          {THEMES.map(t => (
            <a key={t} className={t === theme ? 'on' : ''} href={`?theme=${t}&bg=${bg}${only.length ? `&species=${only.join(',')}` : ''}`}>{t}</a>
          ))}
          <a href={`?theme=${theme}&bg=${bg === 'theme' ? 'day' : 'theme'}`}>bg: {bg}</a>
        </nav>
      </header>

      <section className="dev-tree-demo" data-shot="demo">
        <Cell label="milestone animation" species="cherry_blossom" seed={treeSeed(7, 'cherry_blossom')} growth={0.7} features={{ blossom: 0.55 }} background={bg} animate={animate}
          celebrate={celebrate} onCelebrated={() => setTimeout(() => setCelebrate(null), 400)} />
        <Cell label="decor: tire swing" species="oak" seed={treeSeed(7, 'oak')} growth={0.8} background="day" decoration="tire_swing" animate={animate} />
        <Cell label="decor: lights" species="maple" seed={treeSeed(7, 'maple')} growth={0.8} background="night_stars" decoration="fairy_lights" animate={animate} />
        <Cell label="decor: treehouse" species="mango" seed={treeSeed(7, 'mango')} growth={0.9} background="sunset" potStyle="wooden_barrel" decoration="treehouse" animate={animate} />
        <Cell label="winter" species="apple" seed={treeSeed(7, 'apple')} growth={0.9} season="winter" background={bg} animate={animate} />
        <Cell label="spring + new growth" species="oak" seed={treeSeed(8, 'oak')} growth={0.7} season="spring" features={{ newGrowth: true }} background={bg} animate={animate} />
        <figure className="dev-tree-cell dev-rings">
          <div className="dev-rings-row">
            {[0, 1, 3, 6, 12, 24].map(m => <RingSeal key={m} months={m} seed={7} size={30} />)}
          </div>
          <figcaption>growth rings 0 · 1 · 3 · 6 · 12 · 24 months</figcaption>
        </figure>
      </section>

      {species.map(id => (
        <section key={id} className="dev-tree-species" data-shot={id}>
          <h2>{nameOf(id)} <code>{id}</code></h2>
          <div className="dev-tree-row">
            {GROWTHS.map(g => <Cell key={`h${g}`} label={`g ${g} · healthy`} species={id} seed={treeSeed(1, id)} growth={g} health={1} season="summer" background={bg} animate={animate} />)}
          </div>
          <div className="dev-tree-row">
            {GROWTHS.map(g => <Cell key={`d${g}`} label={`g ${g} · dormant`} species={id} seed={treeSeed(1, id)} growth={g} health={0.25} season="summer" background={bg} animate={animate} />)}
          </div>
          <div className="dev-tree-row">
            {SEEDS.map(sd => <Cell key={sd} label={`seed ${sd} · g 0.85`} species={id} seed={treeSeed(sd, id)} growth={0.85} season="summer" background={bg} animate={animate} />)}
            <Cell label="bloom + fruit" species={id} seed={treeSeed(1, id)} growth={1} season="summer" features={{ blossom: 1, fruit: 1 }} background={bg} animate={animate} />
            <Cell label="autumn" species={id} seed={treeSeed(1, id)} growth={1} season="autumn" background={bg} animate={animate} />
            <Cell label="winter" species={id} seed={treeSeed(1, id)} growth={1} season="winter" background={bg} animate={animate} />
          </div>
        </section>
      ))}

      {perf && (
        <section className="dev-tree-perf" data-shot="perf">
          <h2>Generation cost (this device, warm, growth 1)</h2>
          <table>
            <thead><tr><th>species</th><th>ms</th><th>leaves</th><th>nodes</th><th>paths</th><th>KB</th></tr></thead>
            <tbody>
              {perf.map(r => (
                <tr key={r.id}><td>{r.id}</td><td>{r.ms.toFixed(2)}</td><td>{r.leaves}</td><td>{r.nodes}</td><td>{r.elements}</td><td>{r.kb.toFixed(0)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const DEV_CSS = `
body { background: var(--paper); color: var(--ink); margin: 0; font-family: var(--sans); }
.dev-trees { padding: 16px; max-width: 1400px; margin: 0 auto; }
.dev-trees-head h1 { font-size: 18px; margin: 0 0 8px; }
.dev-trees-head nav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.dev-trees-head a { color: var(--ink-3); font-size: 12px; padding: 3px 8px; border: 1px solid var(--rule-2); border-radius: 999px; text-decoration: none; }
.dev-trees-head a.on { color: var(--ink); border-color: var(--money); }
.dev-tree-demo { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
.dev-tree-species { margin-bottom: 18px; padding-top: 6px; border-top: 1px solid var(--rule); }
.dev-tree-species h2 { font-size: 14px; margin: 4px 0 8px; }
.dev-tree-species code { font-size: 11px; color: var(--ink-3); font-weight: 400; }
.dev-tree-row { display: grid; grid-template-columns: repeat(6, 112px); gap: 10px; margin-bottom: 8px; }
.dev-tree-cell { margin: 0; }
.dev-tree-frame { width: 112px; height: 157px; border-radius: 12px; }
.dev-tree-cell figcaption { font-size: 10px; color: var(--ink-3); margin-top: 3px; font-family: var(--mono); }
.dev-rings { display: flex; flex-direction: column; justify-content: flex-end; }
.dev-rings-row { display: flex; gap: 6px; color: var(--ink-2); }
.dev-tree-perf { overflow-x: auto; }
.dev-tree-perf table { font-size: 12px; border-collapse: collapse; font-family: var(--mono); }
.dev-tree-perf td, .dev-tree-perf th { padding: 2px 10px; border-bottom: 1px solid var(--rule); text-align: right; }
.dev-tree-perf td:first-child, .dev-tree-perf th:first-child { text-align: left; }
@media (max-width: 760px) {
  .dev-trees { padding: 10px; }
  .dev-tree-row { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .dev-tree-frame { width: 100%; height: auto; aspect-ratio: 200 / 280; }
  .dev-tree-frame .tree-art { width: 100% !important; height: 100% !important; }
}
`;
