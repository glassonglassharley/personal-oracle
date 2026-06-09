import { useState } from 'react';
import TreeSVG from './TreeSVG';
import CharacterSVG from './CharacterSVG';
import { TREE_SPECIES, CHARACTER_ARCHETYPES, getLevelTier, getProgressionName } from './companionData';

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

const TREE_THRESHOLDS = [0, 50, 150, 500, 1500, Infinity];

export default function CompanionCard({ companion, growth, onEditCompanion, xpData }) {
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

  const treeState = g.treeGrowthState || 1;
  const treeSaved = g.totalSaved || 0;
  const stageStart = TREE_THRESHOLDS[treeState - 1];
  const stageEnd = TREE_THRESHOLDS[treeState];
  const treeProgressPct = treeState >= 5
    ? 100
    : Math.min(100, Math.max(0, ((treeSaved - stageStart) / (stageEnd - stageStart)) * 100));

  const progressionName = getProgressionName(
    isTree ? treeState : (g.charLevel || 1),
    companion_type,
    state.archetype
  );
  const nextProgressionName = isTree && treeState < 5
    ? getProgressionName(treeState + 1, companion_type, state.archetype)
    : null;

  const shareText = isTree
    ? [
        `🌳 ${name} the ${label}`,
        `Growth Stage: ${treeState}/5 — ${progressionName}`,
        `$${Math.round(treeSaved)} saved · ${g.cleanDays || 0} clean days`,
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

  const growthPct = isTree ? treeProgressPct : (xpData?.progress_percent || 0);

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
              {/* Stage header */}
              <div className="comp-stage-header">
                <span className="comp-stage-title">{progressionName}</span>
                <span className="comp-stage-frac">Stage {treeState} / 5</span>
              </div>

              {/* Growth progress bar */}
              <div className="comp-progress-wrap">
                <div className="comp-progress-bar">
                  <div className="comp-progress-fill" style={{ width: `${treeProgressPct}%` }} />
                </div>
                <div className="comp-progress-foot">
                  <span>${Math.round(treeSaved)}{treeState < 5 ? ` / $${stageEnd} saved` : ' · max stage'}</span>
                  {nextProgressionName && <span>→ {nextProgressionName}</span>}
                </div>
              </div>

              {/* Stat chips */}
              <div className="comp-chips">
                <span className="comp-chip">📅 {g.cleanDays || 0} days</span>
                {g.hasFlowers && <span className="comp-chip">🌸 Blooming</span>}
                {g.isDecember && <span className="comp-chip">❄️ Winter</span>}
              </div>

              {/* XP level strip — show level number only, not name, to avoid
                  conflicting with tree stage names (both use Seedling/Sprout/…) */}
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
              {/* Rank + level header */}
              <div className="comp-stage-header">
                <span className="comp-stage-title">{progressionName}</span>
                <span className="comp-stage-frac">Lv {g.charLevel || 1}</span>
              </div>

              {/* XP progress bar */}
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
                    <div className="comp-progress-fill" style={{ width: `${growthPct}%` }} />
                  </div>
                  <div className="comp-progress-foot"><span>{Math.round(growthPct)}% to next</span></div>
                </div>
              )}

              {/* Stat chips */}
              <div className="comp-chips">
                <span className="comp-chip">📅 {g.cleanDays || 0} days</span>
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
