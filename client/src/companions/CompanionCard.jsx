import { useCallback, useMemo, useState } from 'react';
import TreeArt from '../trees/TreeArt';
import RingSeal from '../trees/RingSeal';
import { treeSeed } from '../trees/growth';
import CharacterSVG from './CharacterSVG';
import { TREE_SPECIES, CHARACTER_ARCHETYPES, getLevelTier, getProgressionName } from './companionData';
import { useApi } from '../useApi';

function HistoryModal({ milestones, name, onClose }) {
  return (
    <div className="comp-modal-backdrop" onClick={onClose}>
      <div className="comp-modal" onClick={e => e.stopPropagation()}>
        <div className="comp-modal-head">
          <span className="comp-modal-title">{name}'s Journey</span>
          <button className="comp-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="comp-timeline">
          {milestones.length === 0 ? (
            <p className="comp-timeline-empty">Start logging to build your history.</p>
          ) : milestones.map((m, i) => (
            <div key={i} className="comp-timeline-item">
              <div className="comp-timeline-dot" />
              <div className="comp-timeline-text">
                {m.text}
                {m.at && <span className="comp-timeline-date">{new Date(m.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const fmtMoney = n => `$${Math.round(n || 0).toLocaleString()}`;

export default function CompanionCard({ companion, growth, onEditCompanion, xpData }) {
  const api = useApi();
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acked, setAcked] = useState(() => new Set());

  const tree = growth?.tree || null;
  const pending = useMemo(
    () => (tree?.pendingCelebrations || []).filter(p => !acked.has(p.key)),
    [tree, acked],
  );
  const current = pending.length ? [pending[0]] : null;

  const handleCelebrated = useCallback(keys => {
    setAcked(prev => new Set([...prev, ...keys]));
    api('/api/companion/celebrated', { method: 'POST', body: JSON.stringify({ keys }) }).catch(() => {});
  }, [api]);

  if (!companion?.companion_type) return null;

  const { companion_type, companion_state } = companion;
  const g = growth || {};
  const state = companion_state || {};
  const name = state.name || (companion_type === 'tree' ? 'My Tree' : 'My Hero');

  const isTree = companion_type === 'tree';
  const tier = getLevelTier(g.charLevel || 1);

  const speciesData = TREE_SPECIES.find(s => s.id === state.species);
  const archetypeData = CHARACTER_ARCHETYPES.find(a => a.id === state.archetype);
  const label = isTree
    ? (speciesData?.name || 'Tree')
    : (archetypeData?.name || 'Hero');

  const growthValue = tree?.growth ?? 0;
  const growthPct = Math.round(growthValue * 100);
  const maturity = tree?.maturity || { name: 'Seedling', next: null };
  const features = tree?.features || {};
  const resting = tree ? tree.health < 0.5 : false;
  const months = tree?.monthsActive || 0;
  const progressionName = getProgressionName(g.charLevel || 1, companion_type, state.archetype);

  const shareText = isTree
    ? [
        `🌳 ${name} the ${label}`,
        `${maturity.name} · ${growthPct}% grown`,
        `${fmtMoney(tree?.moneyMoved)} moved · ${tree?.loggedDays || 0} days logged`,
        'Built with Vice Spending',
      ].join('\n')
    : [
        `⚔️ ${name} the ${label}`,
        `Level ${g.charLevel || 1} (${tier})`,
        `${g.cleanDays || 0} clean days · ${g.streak || 0}-day streak`,
        'Built with Vice Spending',
      ].join('\n');

  const handleShare = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div className="comp-card">
      <div className="comp-card-head">
        <div>
          <span className="comp-card-name">{name}</span>
          <span className="comp-card-label">{label}</span>
        </div>
        <div className="comp-card-actions">
          <button className="comp-btn-ghost" title="Edit companion" onClick={onEditCompanion}>✏</button>
          <button className="comp-btn-ghost" title="Journey history" onClick={() => setShowHistory(true)}>📜</button>
          <button className="comp-btn-ghost" title="Share" onClick={handleShare}>
            {copied ? '✓' : '⬆'}
          </button>
        </div>
      </div>

      <div className="comp-card-body">
        <div className="comp-svg-wrap">
          {isTree ? (
            <TreeArt
              species={state.species || 'oak'}
              seed={treeSeed(tree?.seedBase, state.species || 'oak')}
              growth={growthValue}
              health={tree?.health ?? 1}
              features={features}
              decoration={state.decoration || 'none'}
              potStyle={state.potStyle || 'terracotta'}
              background={state.background || 'day'}
              celebrate={current}
              onCelebrated={handleCelebrated}
              title={`${name}, a ${maturity.name.toLowerCase()} ${label.toLowerCase()}, ${growthPct}% grown${resting ? ', resting' : ''}`}
              width={184}
              height={258}
            />
          ) : (
            <CharacterSVG
              archetype={state.archetype || 'warrior'}
              gender={state.gender || 'masculine'}
              skinTone={state.skinTone || 'tone2'}
              hairColor={state.hairColor || 'black'}
              hairStyle={state.hairStyle || 'short'}
              eyeColor={state.eyeColor || 'brown'}
              beard={state.beard || false}
              freckles={state.freckles || false}
              glasses={state.glasses || false}
              bodyType={state.bodyType || 'average'}
              outfitColor={state.outfitColor || '#c62828'}
              level={g.charLevel || 1}
              background={state.background || 'day'}
              width={184}
              height={258}
            />
          )}
        </div>

        <div className="comp-card-stats">
          {isTree ? (
            <>
              <div className="comp-stage-header">
                <span className="comp-stage-title">{maturity.name}</span>
                <span className="comp-stage-frac">{growthPct}% grown</span>
              </div>

              {/* Growth: real money moved + consistency, never shrinks */}
              <div className="comp-progress-wrap">
                <div className="comp-progress-bar">
                  <div className="comp-progress-fill" style={{ width: `${growthPct}%` }} />
                </div>
                <div className="comp-progress-foot">
                  <span>{fmtMoney(tree?.moneyMoved)} moved · {tree?.loggedDays || 0} days logged</span>
                  {maturity.next && <span>→ {maturity.next.name}</span>}
                </div>
              </div>

              <div className="comp-chips">
                {features.blossom > 0 && <span className="comp-chip">🌸 {features.blossom >= 1 ? 'Full bloom' : 'Blossoming'}</span>}
                {features.fruit > 0 && <span className="comp-chip">🍎 {features.fruit >= 1 ? 'Full harvest' : 'Bearing fruit'}</span>}
                {features.newGrowth && <span className="comp-chip">🌿 New growth</span>}
                {resting && <span className="comp-chip comp-chip-rest" title="Log today and it wakes back up. Growth is never lost.">💤 Resting · log to wake it</span>}
                <span className="comp-chip tree-rings" title="One ring for every month together">
                  <RingSeal months={months} seed={tree?.seedBase} size={14} />
                  {months} {months === 1 ? 'ring' : 'rings'}
                </span>
              </div>

              {xpData && (
                <div className="comp-xp-row">
                  <div className="comp-xp-row-head">
                    <span className="comp-xp-row-name">
                      {xpData.level_icon} Activity Level {xpData.level}
                    </span>
                    <span className="comp-xp-row-total">{xpData.total_xp.toLocaleString()} XP</span>
                  </div>
                  <div className="comp-progress-bar comp-progress-bar-gold">
                    <div className="comp-progress-fill-gold" style={{ width: `${xpData.progress_percent || 0}%` }} />
                  </div>
                  {xpData.xp_to_next_level > 0 && (
                    <span className="comp-xp-row-next">
                      {xpData.xp_to_next_level.toLocaleString()} XP to next level
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="comp-stage-header">
                <span className="comp-stage-title">{progressionName}</span>
                <span className="comp-stage-frac">Lv {g.charLevel || 1}</span>
              </div>

              {xpData ? (
                <div className="comp-progress-wrap">
                  <div className="comp-progress-bar comp-progress-bar-gold">
                    <div className="comp-progress-fill-gold" style={{ width: `${xpData.progress_percent || 0}%` }} />
                  </div>
                  <div className="comp-progress-foot">
                    <span>
                      {xpData.total_xp.toLocaleString()} / {(xpData.total_xp + xpData.xp_to_next_level).toLocaleString()} XP
                    </span>
                    {xpData.next_level_name && (
                      <span>→ {xpData.next_level_name} {xpData.next_level_icon}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="comp-progress-wrap">
                  <div className="comp-progress-bar">
                    <div className="comp-progress-fill" style={{ width: `${Math.round((g.charXp || 0) * 100)}%` }} />
                  </div>
                  <div className="comp-progress-foot"><span>{Math.round((g.charXp || 0) * 100)}% to next</span></div>
                </div>
              )}

              <div className="comp-chips">
                {(g.streak || 0) > 0 && (
                  <span className="comp-chip comp-chip-hot">🔥 {g.streak}-day streak</span>
                )}
                {tier === 'legendary' && (
                  <span className="comp-chip comp-chip-gold">✨ Legendary</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showHistory && (
        <HistoryModal
          milestones={g.milestones || []}
          name={name}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
