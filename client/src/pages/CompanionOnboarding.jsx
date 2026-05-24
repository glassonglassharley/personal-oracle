import { useState } from 'react';
import TreeSVG from '../companions/TreeSVG';
import CharacterSVG from '../companions/CharacterSVG';
import {
  TREE_SPECIES, CHARACTER_ARCHETYPES, SKIN_TONES, HAIR_COLORS, HAIR_STYLES,
  EYE_COLORS, BODY_TYPES, GENDER_OPTIONS, POT_STYLES, DECORATIONS, BACKGROUNDS,
  getDefaultState,
} from '../companions/companionData';
import { useApi } from '../useApi';

const STEPS = ['Choose Type', 'Pick Species', 'Customize', 'Name', 'Begin'];

function StepDots({ current }) {
  return (
    <div className="onb-dots">
      {STEPS.map((s, i) => (
        <div key={i} className={`onb-dot${i === current ? ' active' : i < current ? ' done' : ''}`} title={s} />
      ))}
    </div>
  );
}

function LivePreview({ type, state }) {
  if (!type) return <div className="onb-preview-empty">Choose a type to see your companion</div>;
  if (type === 'tree') return (
    <TreeSVG
      species={state.species || 'oak'}
      growthState={3}
      decoration={state.decoration || 'none'}
      potStyle={state.potStyle || 'terracotta'}
      background={state.background || 'day'}
      hasFlowers={false}
      isDecember={false}
      width={200}
      height={280}
    />
  );
  return (
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
      level={8}
      background={state.background || 'day'}
      width={200}
      height={280}
    />
  );
}

// Step 1: Tree vs Character
function Step1({ type, setType, onNext }) {
  return (
    <div className="onb-step">
      <h2 className="onb-title">What's your companion?</h2>
      <p className="onb-sub">Your companion grows with your progress. It's yours forever.</p>
      <div className="onb-type-cards">
        <button
          className={`onb-type-card${type === 'tree' ? ' selected' : ''}`}
          onClick={() => setType('tree')}
        >
          <div className="onb-type-icon">🌳</div>
          <div className="onb-type-name">Tree</div>
          <div className="onb-type-desc">Grows as you save money. Choose from 20 species with pots, decorations, and backgrounds.</div>
          <div className="onb-type-preview">
            <TreeSVG species="oak" growthState={4} potStyle="terracotta" background="day"
              hasFlowers decoration="fairy_lights" width={120} height={168} />
          </div>
        </button>
        <button
          className={`onb-type-card${type === 'character' ? ' selected' : ''}`}
          onClick={() => setType('character')}
        >
          <div className="onb-type-icon">⚔️</div>
          <div className="onb-type-name">Character</div>
          <div className="onb-type-desc">Levels up on clean days. Choose from 20 archetypes with full body, hair, and outfit customization.</div>
          <div className="onb-type-preview">
            <CharacterSVG archetype="warrior" skinTone="tone2" hairColor="black" hairStyle="short"
              eyeColor="blue" bodyType="athletic" outfitColor="#c62828" level={12} background="day"
              width={120} height={168} />
          </div>
        </button>
      </div>
      <button className="btn btn-primary onb-next" disabled={!type} onClick={onNext}>
        Continue →
      </button>
    </div>
  );
}

// Step 2: Pick species or archetype
function Step2({ type, state, setState, onNext, onBack }) {
  const items = type === 'tree' ? TREE_SPECIES : CHARACTER_ARCHETYPES;
  const key = type === 'tree' ? 'species' : 'archetype';
  const selected = state[key];

  return (
    <div className="onb-step">
      <h2 className="onb-title">{type === 'tree' ? 'Pick your tree' : 'Choose your archetype'}</h2>
      <p className="onb-sub">{type === 'tree' ? '20 species, each with its own shape and personality.' : '20 archetypes — from warriors to astronauts.'}</p>
      <div className="onb-grid">
        {items.map(item => (
          <button
            key={item.id}
            className={`onb-grid-item${selected === item.id ? ' selected' : ''}`}
            onClick={() => setState(s => ({ ...s, [key]: item.id }))}
          >
            <span className="onb-grid-emoji">{item.emoji}</span>
            <span className="onb-grid-name">{item.name}</span>
          </button>
        ))}
      </div>
      <div className="onb-footer">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" disabled={!selected} onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

// Step 3: Customize — Tree tabs
function TreeCustomize({ state, setState }) {
  const [tab, setTab] = useState('pot');
  const tabs = [
    { id: 'pot', label: 'Pot' },
    { id: 'decoration', label: 'Decoration' },
    { id: 'background', label: 'Background' },
  ];

  return (
    <div className="onb-customize">
      <div className="onb-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`onb-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'pot' && (
        <div className="onb-option-grid">
          {POT_STYLES.map(p => (
            <button key={p.id}
              className={`onb-opt${state.potStyle === p.id ? ' selected' : ''}`}
              onClick={() => setState(s => ({ ...s, potStyle: p.id }))}>
              <span className="onb-opt-swatch" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'decoration' && (
        <div className="onb-option-grid">
          {DECORATIONS.map(d => (
            <button key={d.id}
              className={`onb-opt${state.decoration === d.id ? ' selected' : ''}`}
              onClick={() => setState(s => ({ ...s, decoration: d.id }))}>
              {d.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'background' && (
        <div className="onb-option-grid">
          {BACKGROUNDS.map(b => (
            <button key={b.id}
              className={`onb-opt${state.background === b.id ? ' selected' : ''}`}
              onClick={() => setState(s => ({ ...s, background: b.id }))}>
              <span className="onb-opt-swatch" style={{ background: `linear-gradient(${b.sky1}, ${b.sky2})` }} />
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Step 3: Customize — Character tabs
function CharacterCustomize({ state, setState }) {
  const [tab, setTab] = useState('body');
  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'hair', label: 'Hair' },
    { id: 'face', label: 'Face' },
    { id: 'style', label: 'Style' },
    { id: 'background', label: 'Scene' },
  ];

  return (
    <div className="onb-customize">
      <div className="onb-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`onb-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'body' && (
        <div>
          <div className="onb-section-label">Gender Presentation</div>
          <div className="onb-option-grid">
            {GENDER_OPTIONS.map(g => (
              <button key={g.id}
                className={`onb-opt${state.gender === g.id ? ' selected' : ''}`}
                onClick={() => setState(s => ({ ...s, gender: g.id }))}>
                {g.name}
              </button>
            ))}
          </div>
          <div className="onb-section-label">Skin Tone</div>
          <div className="onb-tone-row">
            {SKIN_TONES.map(t => (
              <button key={t.id}
                className={`onb-tone${state.skinTone === t.id ? ' selected' : ''}`}
                style={{ background: t.color }}
                title={t.name}
                onClick={() => setState(s => ({ ...s, skinTone: t.id }))}
              />
            ))}
          </div>
          <div className="onb-section-label">Body Type</div>
          <div className="onb-option-grid">
            {BODY_TYPES.map(b => (
              <button key={b.id}
                className={`onb-opt${state.bodyType === b.id ? ' selected' : ''}`}
                onClick={() => setState(s => ({ ...s, bodyType: b.id }))}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'hair' && (
        <div>
          <div className="onb-section-label">Hair Style</div>
          <div className="onb-option-grid">
            {HAIR_STYLES.map(hs => (
              <button key={hs.id}
                className={`onb-opt${state.hairStyle === hs.id ? ' selected' : ''}`}
                onClick={() => setState(s => ({ ...s, hairStyle: hs.id }))}>
                {hs.name}
              </button>
            ))}
          </div>
          <div className="onb-section-label">Hair Color</div>
          <div className="onb-color-grid">
            {HAIR_COLORS.map(hc => (
              <button key={hc.id}
                className={`onb-color-swatch${state.hairColor === hc.id ? ' selected' : ''}`}
                title={hc.name}
                style={{
                  background: hc.color === 'rainbow'
                    ? 'linear-gradient(90deg,#e53935,#f9a825,#43a047,#1e88e5,#8e24aa)'
                    : hc.color
                }}
                onClick={() => setState(s => ({ ...s, hairColor: hc.id }))}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'face' && (
        <div>
          <div className="onb-section-label">Eye Color</div>
          <div className="onb-color-grid">
            {EYE_COLORS.map(ec => (
              <button key={ec.id}
                className={`onb-color-swatch${state.eyeColor === ec.id ? ' selected' : ''}`}
                title={ec.name}
                style={{
                  background: ec.id === 'heterochromia'
                    ? 'linear-gradient(90deg, #1565c0 50%, #388e3c 50%)'
                    : ec.color
                }}
                onClick={() => setState(s => ({ ...s, eyeColor: ec.id }))}
              />
            ))}
          </div>
          <div className="onb-section-label">Extras</div>
          <div className="onb-toggle-row">
            {[
              { key: 'beard', label: 'Beard / Stubble' },
              { key: 'freckles', label: 'Freckles' },
              { key: 'glasses', label: 'Glasses' },
            ].map(({ key, label }) => (
              <button key={key}
                className={`onb-toggle${state[key] ? ' on' : ''}`}
                onClick={() => setState(s => ({ ...s, [key]: !s[key] }))}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'style' && (
        <div>
          <div className="onb-section-label">Outfit / Armor Color</div>
          <div className="onb-color-pick-row">
            {['#c62828','#1565c0','#2e7d32','#f57f17','#6a1b9a','#0277bd','#00838f','#212121','#880e4f','#37474f'].map(col => (
              <button key={col}
                className={`onb-color-swatch${state.outfitColor === col ? ' selected' : ''}`}
                style={{ background: col }}
                title={col}
                onClick={() => setState(s => ({ ...s, outfitColor: col }))}
              />
            ))}
          </div>
          <div className="onb-section-label">Custom Color</div>
          <div className="onb-hex-row">
            <input type="color" value={state.outfitColor || '#c62828'}
              onChange={e => setState(s => ({ ...s, outfitColor: e.target.value }))}
              className="onb-color-picker"
            />
            <span className="onb-hex-val">{state.outfitColor || '#c62828'}</span>
          </div>
        </div>
      )}

      {tab === 'background' && (
        <div className="onb-option-grid">
          {BACKGROUNDS.map(b => (
            <button key={b.id}
              className={`onb-opt${state.background === b.id ? ' selected' : ''}`}
              onClick={() => setState(s => ({ ...s, background: b.id }))}>
              <span className="onb-opt-swatch" style={{ background: `linear-gradient(${b.sky1}, ${b.sky2})` }} />
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Step3({ type, state, setState, onNext, onBack }) {
  return (
    <div className="onb-step">
      <h2 className="onb-title">Make it yours</h2>
      <p className="onb-sub">Customize every detail. The preview updates live.</p>
      {type === 'tree'
        ? <TreeCustomize state={state} setState={setState} />
        : <CharacterCustomize state={state} setState={setState} />}
      <div className="onb-footer">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

function Step4({ type, state, setState, onNext, onBack }) {
  const nameKey = 'name';
  const maxLen = 20;
  const val = state[nameKey] || '';
  const placeholder = type === 'tree' ? 'e.g. Old Faithful' : 'e.g. Blaze';

  return (
    <div className="onb-step onb-name-step">
      <h2 className="onb-title">Name your companion</h2>
      <p className="onb-sub">Give {type === 'tree' ? 'your tree' : 'your hero'} a name they'll carry forever.</p>
      <div className="onb-name-wrap">
        <input
          className="form-input onb-name-input"
          maxLength={maxLen}
          value={val}
          placeholder={placeholder}
          onChange={e => setState(s => ({ ...s, name: e.target.value }))}
          autoFocus
        />
        <span className="onb-name-count">{val.length}/{maxLen}</span>
      </div>
      <div className="onb-footer">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" disabled={!val.trim()} onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

function Step5({ type, state, onBegin, saving }) {
  const name = state.name || (type === 'tree' ? 'My Tree' : 'My Hero');
  return (
    <div className="onb-step onb-final-step">
      <h2 className="onb-title">Meet {name}!</h2>
      <p className="onb-sub">
        {type === 'tree'
          ? 'Every dollar you save makes them grow. Log entries to watch them flourish.'
          : `Every clean day earns experience. Reach level 20 to unlock legendary gear.`}
      </p>
      <div className="onb-final-preview">
        {type === 'tree' ? (
          <TreeSVG
            species={state.species || 'oak'}
            growthState={1}
            decoration={state.decoration || 'none'}
            potStyle={state.potStyle || 'terracotta'}
            background={state.background || 'day'}
            width={200}
            height={280}
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
            level={1}
            background={state.background || 'day'}
            width={200}
            height={280}
          />
        )}
      </div>
      <button className="btn btn-primary onb-begin-btn" onClick={onBegin} disabled={saving}>
        {saving ? 'Saving…' : `Begin the journey →`}
      </button>
    </div>
  );
}

export default function CompanionOnboarding({ onComplete, existingType }) {
  const api = useApi();
  const [step, setStep] = useState(existingType ? 2 : 0);
  const [type, setType] = useState(existingType || null);
  const [state, setState] = useState(existingType ? getDefaultState(existingType) : {});
  const [saving, setSaving] = useState(false);

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const selectType = (t) => {
    setType(t);
    setState(getDefaultState(t));
  };

  const handleBegin = async () => {
    setSaving(true);
    try {
      await api('/api/companion', {
        method: 'PUT',
        body: JSON.stringify({ companion_type: type, companion_state: state }),
      });
      onComplete({ companion_type: type, companion_state: state });
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div className="onb-overlay">
      <div className="onb-container">
        <div className="onb-layout">
          {/* Live preview panel */}
          <div className="onb-preview-panel">
            <div className="onb-preview-inner">
              <LivePreview type={type} state={state} />
            </div>
            {type && step >= 1 && (
              <div className="onb-preview-label">
                {type === 'tree'
                  ? (TREE_SPECIES.find(s => s.id === state.species)?.name || 'Tree')
                  : (CHARACTER_ARCHETYPES.find(a => a.id === state.archetype)?.name || 'Hero')}
              </div>
            )}
          </div>

          {/* Step panel */}
          <div className="onb-step-panel">
            <StepDots current={step} />

            {step === 0 && <Step1 type={type} setType={selectType} onNext={next} />}
            {step === 1 && <Step2 type={type} state={state} setState={setState} onNext={next} onBack={back} />}
            {step === 2 && <Step3 type={type} state={state} setState={setState} onNext={next} onBack={back} />}
            {step === 3 && <Step4 type={type} state={state} setState={setState} onNext={next} onBack={back} />}
            {step === 4 && <Step5 type={type} state={state} onBegin={handleBegin} saving={saving} />}
          </div>
        </div>
      </div>
    </div>
  );
}
