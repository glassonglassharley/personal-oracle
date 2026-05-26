import { useState } from 'react';
import TreeSVG from './TreeSVG';
import CharacterSVG from './CharacterSVG';
import { TREE_SPECIES, CHARACTER_ARCHETYPES, getLevelTier } from './companionData';

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
              <div className="comp-timeline-text">{m.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CompanionCard({ companion, growth, onEditCompanion }) {
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const shareText = isTree
    ? [
        `🌳 ${name} the ${label}`,
        `Growth Stage: ${g.treeGrowthState || 1}/5`,
        `$${(g.totalSaved || 0).toFixed(0)} saved · ${g.cleanDays || 0} clean days`,
        g.streak > 0 ? `🔥 ${g.streak}-day streak` : '',
        'Built with Vice Spending',
      ].filter(Boolean).join('\n')
    : [
        `⚔️ ${name} the ${label}`,
        `Level ${g.charLevel || 1} (${tier})`,
        `${g.cleanDays || 0} clean days · ${g.streak || 0}-day streak`,
        'Built with Vice Spending',
      ].filter(Boolean).join('\n');

  const handleShare = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const xp = g.charXp || 0;
  const growthPct = isTree ? (((g.treeGrowthState || 1) - 1) / 4) * 100 : xp * 100;

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
            <TreeSVG
              species={state.species || 'oak'}
              growthState={g.treeGrowthState || 1}
              decoration={state.decoration || 'none'}
              potStyle={state.potStyle || 'terracotta'}
              background={state.background || 'day'}
              hasFlowers={g.hasFlowers}
              isDecember={g.isDecember}
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
              <div className="comp-stat-row">
                <span className="comp-stat-label">Growth</span>
                <span className="comp-stat-val">Stage {g.treeGrowthState || 1}/5</span>
              </div>
              <div className="comp-progress-wrap">
                <div className="comp-progress-bar">
                  <div className="comp-progress-fill" style={{ width: `${growthPct}%` }} />
                </div>
              </div>
              <div className="comp-stat-row">
                <span className="comp-stat-label">Saved</span>
                <span className="comp-stat-val comp-money">${(g.totalSaved || 0).toFixed(0)}</span>
              </div>
              <div className="comp-stat-row">
                <span className="comp-stat-label">Clean days</span>
                <span className="comp-stat-val">{g.cleanDays || 0}</span>
              </div>
              {(g.streak || 0) > 0 && (
                <div className="comp-stat-row">
                  <span className="comp-stat-label">Streak</span>
                  <span className="comp-stat-val comp-streak">🔥 {g.streak}</span>
                </div>
              )}
              {g.hasFlowers && (
                <div className="comp-badge">🌸 Blooming</div>
              )}
              {g.isDecember && (
                <div className="comp-badge">❄️ Winter</div>
              )}
            </>
          ) : (
            <>
              <div className="comp-stat-row">
                <span className="comp-stat-label">Level</span>
                <span className="comp-stat-val">{g.charLevel || 1}</span>
              </div>
              <div className="comp-progress-wrap">
                <div className="comp-progress-bar">
                  <div className="comp-progress-fill" style={{ width: `${growthPct}%` }} />
                </div>
                <span className="comp-xp-label">{Math.round(growthPct)}% to next</span>
              </div>
              <div className="comp-stat-row">
                <span className="comp-stat-label">Tier</span>
                <span className={`comp-stat-val comp-tier-${tier}`}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
              </div>
              <div className="comp-stat-row">
                <span className="comp-stat-label">Clean days</span>
                <span className="comp-stat-val">{g.cleanDays || 0}</span>
              </div>
              {(g.streak || 0) > 0 && (
                <div className="comp-stat-row">
                  <span className="comp-stat-label">Streak</span>
                  <span className="comp-stat-val comp-streak">🔥 {g.streak}</span>
                </div>
              )}
              {tier === 'legendary' && (
                <div className="comp-badge comp-badge-legendary">✨ Legendary</div>
              )}
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
